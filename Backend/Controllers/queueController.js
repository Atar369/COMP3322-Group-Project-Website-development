const db = require('../db');
const { isLastOrderCutoffReached } = require('../utils/orderingWindow');

function getGroupPrefix(party_size) {
  if (party_size <= 2) return 'A';
  if (party_size <= 6) return 'B';
  return 'C';
}

function isQueueGroup(group) {
  return ['A', 'B', 'C'].includes(group);
}

// GET /api/queue — all non-cancelled entries
async function listAll(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT q.queue_id, q.user_id, q.party_size, q.queue_number, q.queue_date, q.joined_at,
              q.status, q.table_id, seated_table.table_number,
              q.reserved_table_id, reserved_table.table_number AS assigned_table_number,
              q.called_at, q.served_at, q.rejoin_count
       FROM queue_entries q
       LEFT JOIN restaurant_tables seated_table ON seated_table.table_id = q.table_id
       LEFT JOIN restaurant_tables reserved_table ON reserved_table.table_id = q.reserved_table_id
       ORDER BY q.queue_number ASC, q.joined_at ASC, q.queue_id ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('listAll queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/queue/manager/history — queue records for manager review
async function managerHistory(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT q.queue_id, q.user_id, u.name AS customer_name, q.party_size,
              q.queue_number, q.queue_date, q.joined_at, q.status, q.table_id,
              seated_table.table_number, q.reserved_table_id,
              reserved_table.table_number AS assigned_table_number,
              q.called_at, q.served_at, q.rejoin_count
       FROM queue_entries q
       LEFT JOIN users u ON u.user_id = q.user_id
       LEFT JOIN restaurant_tables seated_table ON seated_table.table_id = q.table_id
       LEFT JOIN restaurant_tables reserved_table ON reserved_table.table_id = q.reserved_table_id
       ORDER BY q.joined_at DESC, q.queue_id DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('manager queue history error:', err);
    return res.status(500).json({ error: 'Unable to load queue history. Please try again later.' });
  }
}

// POST /api/queue — customer joins queue
async function join(req, res) {
  const user_id = req.user.user_id; 
  const { party_size } = req.body;

  if (!party_size) return res.status(400).json({ error: 'party_size required.' });

  const prefix = getGroupPrefix(party_size);
  const today = new Date().toISOString().slice(0, 10);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Check if customer already has an active queue entry today
    const [existing] = await conn.query(
      `SELECT queue_id FROM queue_entries WHERE user_id = ? AND DATE(created_at) = ? AND status IN ('queued','called','serving')`,
      [user_id, today]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already have an active queue number today.' });
    }

    // Check if customer has missed once (rejoin limit: 1)
    const [missedCheck] = await conn.query(
      `SELECT COUNT(*) as miss_count FROM queue_entries WHERE user_id = ? AND DATE(created_at) = ? AND status = 'missed'`,
      [user_id, today]
    );
    if (missedCheck[0].miss_count >= 1) {
      await conn.rollback();
      return res.status(403).json({
        error: 'You have already missed your turn once. Please see the manager to rejoin.',
      });
    }

    // Use FOR UPDATE to prevent race conditions when generating queue numbers
    const [lastRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE DATE(created_at) = ? AND queue_number LIKE ?
       ORDER BY queue_number DESC LIMIT 1 FOR UPDATE`,
      [today, `${prefix}%`]
    );
    
    let nextNum = 1;
    if (lastRows.length > 0) {
      const lastNum = parseInt(lastRows[0].queue_number.slice(1), 10);
      nextNum = lastNum >= 999 ? 1 : lastNum + 1;
    }
    const queue_number = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, status, rejoin_count) VALUES (?, ?, ?, 'queued', 0)`,
      [user_id, party_size, queue_number]
    );
    
    await conn.commit();
    return res.status(201).json({ queueId: result.insertId, queueNumber: queue_number });
  } catch (err) {
    await conn.rollback();
    console.error('join queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// GET /api/queue/user/:user_id — queue entries for one customer
async function listByUser(req, res) {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT q.queue_id, q.user_id, q.party_size, q.queue_number, q.queue_date, q.joined_at,
              q.status, q.table_id, seated_table.table_number,
              q.reserved_table_id, reserved_table.table_number AS assigned_table_number,
              q.called_at, q.served_at, q.rejoin_count
       FROM queue_entries q
       LEFT JOIN restaurant_tables seated_table ON seated_table.table_id = q.table_id
       LEFT JOIN restaurant_tables reserved_table ON reserved_table.table_id = q.reserved_table_id
       WHERE q.user_id = ? ORDER BY q.joined_at DESC`,
      [user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listByUser queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/call — manager calls a queue entry
async function call(req, res) {
  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Queue calling is closed for the day after 21:00.' });
  }
  const { id } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const [entry] = await conn.query(
      `SELECT queue_id, party_size FROM queue_entries WHERE queue_id = ? AND status = 'queued' FOR UPDATE`,
      [id]
    );
    if (entry.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not found or not in queued state.' });
    }

    const td = new Date().toISOString().slice(0, 10);
    const prefix = getGroupPrefix(entry[0].party_size);

    // Auto-mark previous called as missed
    await conn.query(
      `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
       WHERE DATE(created_at) = ? AND queue_number LIKE ? AND status = 'called'`,
      [td, `${prefix}%`]
    );

    // Call the new entry
    await conn.query(
      `UPDATE queue_entries SET status = 'called', called_at = NOW() WHERE queue_id = ? AND status = 'queued'`,
      [id]
    );

    await conn.commit();
    return res.json({ message: 'Queue entry called.' });
  } catch (err) {
    await conn.rollback();
    console.error('call queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/queue/:id/checkin — manager confirms customer arrival → serving
async function checkin(req, res) {
  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Queue seating is closed for the day after 21:00.' });
  }
  const { id } = req.params;
  
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'serving', served_at = NOW()
       WHERE queue_id = ? AND status = 'called'`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Queue entry not found or not in called state.' });
    return res.json({ message: 'Queue entry now serving.' });
  } catch (err) {
    console.error('checkin queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

async function autoCallSettings(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT group_code, enabled, updated_at
       FROM queue_auto_call_settings ORDER BY group_code`
    );
    return res.json(rows);
  } catch (err) {
    console.error('load auto-call settings error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

async function setAutoCall(req, res) {
  const { group } = req.params;
  const { enabled } = req.body;
  if (!isQueueGroup(group) || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'A valid group and boolean enabled value are required.' });
  }
  if (enabled && isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Automatic queue calls are closed for the day after 21:00.' });
  }
  try {
    await db.query(
      `UPDATE queue_auto_call_settings SET enabled = ? WHERE group_code = ?`,
      [enabled, group]
    );
    return res.json({ group, enabled });
  } catch (err) {
    console.error('update auto-call settings error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

async function findAvailableTable(conn, partySize) {
  const [tables] = await conn.query(
    `SELECT t.table_id, t.table_number, t.capacity
     FROM restaurant_tables t
     WHERE t.status = 'available' AND t.capacity >= ?
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.table_id = t.table_id AND b.status IN ('serving', 'finished')
       )
       AND NOT EXISTS (
         SELECT 1 FROM queue_entries q
         WHERE (q.table_id = t.table_id AND q.status IN ('serving', 'finished'))
            OR (q.reserved_table_id = t.table_id AND q.status = 'called')
       )
     ORDER BY t.capacity ASC, t.table_number ASC
     LIMIT 1 FOR UPDATE`,
    [partySize]
  );
  return tables[0] || null;
}

async function seat(req, res) {
  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Queue seating is closed for the day after 21:00.' });
  }
  const { id } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const [entries] = await conn.query(
      `SELECT queue_id, party_size, table_id, reserved_table_id
       FROM queue_entries WHERE queue_id = ? AND status = 'called' FOR UPDATE`,
      [id]
    );
    if (!entries.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'There is no current called ticket to seat.' });
    }

    const entry = entries[0];
    let table = entry.reserved_table_id
      ? { table_id: entry.reserved_table_id }
      : await findAvailableTable(conn, entry.party_size);
      
    if (!table) {
      await conn.rollback();
      return res.status(409).json({ error: 'No available table can seat this party right now.' });
    }
    
    if (entry.reserved_table_id) {
      const [available] = await conn.query(
        `SELECT t.table_id FROM restaurant_tables t
         WHERE t.table_id = ? AND t.status = 'available' AND t.capacity >= ?
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.table_id = t.table_id AND b.status IN ('serving', 'finished')
           )
           AND NOT EXISTS (
             SELECT 1 FROM queue_entries q
             WHERE q.queue_id <> ? AND (
               (q.table_id = t.table_id AND q.status IN ('serving', 'finished'))
               OR (q.reserved_table_id = t.table_id AND q.status = 'called')
             )
           )
         FOR UPDATE`,
        [entry.reserved_table_id, entry.party_size, entry.queue_id]
      );
      if (!available.length) {
        await conn.rollback();
        return res.status(409).json({ error: 'The assigned table is no longer available.' });
      }
    }

    await conn.query(
      `UPDATE queue_entries
       SET status = 'serving', table_id = ?, reserved_table_id = NULL, served_at = NOW()
       WHERE queue_id = ? AND status = 'called'`,
      [table.table_id, entry.queue_id]
    );
    
    await conn.commit();
    return res.json({ message: 'Queue customer seated.', table_id: table.table_id });
  } catch (err) {
    await conn.rollback();
    console.error('seat queue customer error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

async function processAutoCallGroup(group) {
  if (!isQueueGroup(group)) throw new Error(`Invalid queue group: ${group}`);
  if (isLastOrderCutoffReached()) return;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const [settings] = await conn.query(
      `SELECT enabled FROM queue_auto_call_settings WHERE group_code = ? FOR UPDATE`,
      [group]
    );
    if (!settings.length || !settings[0].enabled) {
      await conn.commit();
      return;
    }
    if (isLastOrderCutoffReached()) {
      await conn.commit();
      return;
    }

    const prefix = `${group}%`;
    const [called] = await conn.query(
      `SELECT queue_id, called_at FROM queue_entries
       WHERE DATE(created_at) = CURDATE() AND queue_number LIKE ? AND status = 'called'
       ORDER BY called_at DESC, queue_id DESC LIMIT 1 FOR UPDATE`,
      [prefix]
    );
    
    if (called.length) {
      const elapsed = Date.now() - new Date(called[0].called_at).getTime();
      if (elapsed < 10_000) { // 10 seconds
        await conn.commit();
        return;
      }
      await conn.query(
        `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
         WHERE queue_id = ? AND status = 'called'`,
        [called[0].queue_id]
      );
    }

    const [waiting] = await conn.query(
      `SELECT queue_id, party_size FROM queue_entries
       WHERE DATE(created_at) = CURDATE() AND queue_number LIKE ? AND status = 'queued'
       ORDER BY queue_number ASC, joined_at ASC, queue_id ASC FOR UPDATE`,
      [prefix]
    );
    
    for (const entry of waiting) {
      if (isLastOrderCutoffReached()) break;
      const table = await findAvailableTable(conn, entry.party_size);
      if (!table) continue;
      
      await conn.query(
        `UPDATE queue_entries
         SET status = 'called', called_at = NOW(), reserved_table_id = ?
         WHERE queue_id = ? AND status = 'queued'`,
        [table.table_id, entry.queue_id]
      );
      break;
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function autoCallCycle() {
  if (isLastOrderCutoffReached()) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
         WHERE DATE(created_at) = CURDATE() AND status = 'called'`
      );
      await conn.query(
        `UPDATE queue_auto_call_settings SET enabled = FALSE WHERE enabled = TRUE`
      );
      await conn.commit();
      return;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  await Promise.all(['A', 'B', 'C'].map(processAutoCallGroup));
}

// PATCH /api/queue/:id/finish — auto or manual finish after 1h
async function finish(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'finished' WHERE queue_id = ? AND status = 'serving'`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Queue entry not serving.' });
    return res.json({ message: 'Queue entry finished.' });
  } catch (err) {
    console.error('finish queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/pay — manager marks as paid
async function pay(req, res) {
  const { id } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const [entries] = await conn.query(
      `SELECT queue_id FROM queue_entries WHERE queue_id = ? AND status = 'finished' FOR UPDATE`,
      [id]
    );
    if (!entries.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not finished.' });
    }
    
    await conn.query(
      `UPDATE queue_entries SET status = 'paid' WHERE queue_id = ?`,
      [id]
    );
    await conn.query(
      `UPDATE orders SET payment_status = 'paid' WHERE queue_id = ? AND payment_status = 'unpaid'`,
      [id]
    );
    
    await conn.commit();
    return res.json({ message: 'Queue entry paid.' });
  } catch (err) {
    await conn.rollback();
    console.error('pay queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/queue/:id/cancel
async function cancel(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'cancelled' WHERE queue_id = ? AND status IN ('queued','called')`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Cannot cancel this queue entry.' });
    return res.json({ message: 'Queue entry cancelled.' });
  } catch (err) {
    console.error('cancel queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/reissue — manager reissues a new ticket to a missed customer
async function reissue(req, res) {
  const { id } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Get the missed entry
    const [entry] = await conn.query(
      `SELECT user_id, party_size, DATE(created_at) AS queue_date FROM queue_entries WHERE queue_id = ? AND status = 'missed' FOR UPDATE`,
      [id]
    );
    if (entry.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not found or not missed.' });
    }

    const { user_id, party_size, queue_date } = entry[0];
    const prefix = getGroupPrefix(party_size);

    // Check if user already has an active ticket
    const [active] = await conn.query(
      `SELECT queue_id FROM queue_entries WHERE user_id = ? AND DATE(created_at) = ? AND status IN ('queued', 'called', 'serving')`,
      [user_id, queue_date]
    );
    if (active.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Customer already has an active ticket.' });
    }

    // Get the last queue number
    const [lastRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE DATE(created_at) = ? AND queue_number LIKE ? AND status IN ('queued', 'called', 'serving', 'missed')
       ORDER BY queue_number DESC LIMIT 1 FOR UPDATE`,
      [queue_date, `${prefix}%`]
    );
    
    let nextNum = 1;
    if (lastRows.length > 0) {
      const lastNum = parseInt(lastRows[0].queue_number.slice(1), 10);
      nextNum = lastNum >= 999 ? 1 : lastNum + 1;
    }
    const new_queue_number = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Create a new queue entry. Do NOT change the old one from 'missed' (keeps audit history accurate)
    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, status, rejoin_count) VALUES (?, ?, ?, 'queued', ?)`,
      [user_id, party_size, new_queue_number, 1]
    );

    await conn.commit();
    return res.status(201).json({
      message: 'New queue ticket reissued',
      queueId: result.insertId,
      queueNumber: new_queue_number,
    });
  } catch (err) {
    await conn.rollback();
    console.error('reissue queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// POST /api/queue/:id/rejoin — customer rejoins 15 numbers after the current call
async function customerRejoin(req, res) {
  const { id } = req.params;
  const userId = req.user.user_id;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const [missedRows] = await conn.query(
      `SELECT queue_id, user_id, party_size, queue_number, DATE(created_at) AS queue_date, rejoin_count
       FROM queue_entries
       WHERE queue_id = ? AND user_id = ? AND status = 'missed'
       FOR UPDATE`,
      [id, userId]
    );
    if (!missedRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Missed queue entry not found.' });
    }

    const missed = missedRows[0];
    if (missed.rejoin_count > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'This missed ticket has already been rejoined.' });
    }

    const prefix = getGroupPrefix(missed.party_size);
    
    // Get current called number
    const [calledRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE DATE(created_at) = ? AND queue_number LIKE ? AND status = 'called'
       ORDER BY called_at DESC, queue_id DESC LIMIT 1`,
      [missed.queue_date, `${prefix}%`]
    );
    if (!calledRows.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'There is no current call for your queue group yet.' });
    }

    const missedNumber = Number(missed.queue_number.slice(1));
    const currentNumber = Number(calledRows[0].queue_number.slice(1));
    
    if (missedNumber > currentNumber || missedNumber < currentNumber - 35) {
      await conn.rollback();
      return res.status(409).json({ error: 'You can rejoin when your missed number is no more than 35 numbers behind the current call.' });
    }

    // Check if user already has an active ticket
    const [activeRows] = await conn.query(
      `SELECT queue_id FROM queue_entries
       WHERE user_id = ? AND DATE(created_at) = ? AND status IN ('queued', 'called', 'serving')
       FOR UPDATE`,
      [userId, missed.queue_date]
    );
    if (activeRows.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already have an active queue ticket.' });
    }

    // Calculate target number (current + 15)
    const [assignedRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE DATE(created_at) = ? AND queue_number LIKE ?`,
      [missed.queue_date, `${prefix}%`]
    );
    const assigned = new Set(assignedRows.map(row => Number(row.queue_number.slice(1))));
    
    let targetNumber = currentNumber + 15;
    if (targetNumber > 999) {
      await conn.rollback();
      return res.status(409).json({ error: 'The queue number 15 after the current call is outside today’s number range.' });
    }
    
    // Find the next available number if the exact +15 is taken
    while (assigned.has(targetNumber)) {
      targetNumber++;
      if (targetNumber > 999) {
        targetNumber = 1;
      }
    }

    const queueNumber = `${prefix}${String(targetNumber).padStart(3, '0')}`;
    
    await conn.query(
      `UPDATE queue_entries SET rejoin_count = 1 WHERE queue_id = ?`,
      [missed.queue_id]
    );
    
    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, status, rejoin_count)
       VALUES (?, ?, ?, 'queued', 1)`,
      [userId, missed.party_size, queueNumber]
    );
    
    await conn.commit();
    return res.status(201).json({
      message: 'You have rejoined the queue.',
      queueId: result.insertId,
      queueNumber,
    });
  } catch (err) {
    await conn.rollback();
    console.error('customer rejoin queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listAll,
  managerHistory,
  join,
  listByUser,
  call,
  checkin,
  seat,
  autoCallSettings,
  setAutoCall,
  autoCallCycle,
  finish,
  pay,
  cancel,
  reissue,
  customerRejoin,
};