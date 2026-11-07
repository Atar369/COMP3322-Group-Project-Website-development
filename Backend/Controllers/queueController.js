const db = require('../db');
const { isLastOrderCutoffReached } = require('../utils/orderingWindow');
const { getRestaurantDateKey, parseUtcDateTime } = require('../utils/restaurantTime');

let socketIo = null;
function setSocketIo(io) {
  socketIo = io;
}

const QUEUE_GROUPS = ['A', 'B', 'C'];
const MAX_QUEUE_NUMBER = 999;
const AUTO_CALL_MISSED_AFTER_MS = 10_000; // unseated call -> missed
const DINING_SESSION_MS = 60 * 60 * 1000; // 1 hour hardcoded

function getGroupPrefix(party_size) {
  if (party_size <= 2) return 'A';
  if (party_size <= 6) return 'B';
  return 'C';
}

function isQueueGroup(group) {
  return QUEUE_GROUPS.includes(group);
}

function isValidPartySize(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

// Emit helper: never let a socket failure break a DB transaction
function emit(req, payload) {
  try {
    const io = req ? req.app.get('io') : socketIo;
    if (!io) return;
    
    io.to('queue:public').emit('queue:update', payload);
    io.to('queue:manager').emit('queue:manager-update', payload);
    if (payload.calledUserId) {
      io.to(`queue:user:${payload.calledUserId}`).emit('queue:called', {
        queueId: payload.calledQueueId,
        queueNumber: payload.calledQueueNumber,
        message: 'You are being called. Please proceed to the host stand.',
        calledAt: payload.calledAt || new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('queue socket emit failed:', error);
  }
}

// GET /api/queue — public board, no PII (no user_id)
async function listAll(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT q.queue_id, q.party_size, q.queue_number, q.queue_date, q.joined_at,
              q.status, q.table_id, seated_table.table_number,
              q.reserved_table_id, reserved_table.table_number AS assigned_table_number,
              q.called_at, q.served_at, q.rejoin_count
       FROM queue_entries q
       LEFT JOIN restaurant_tables seated_table ON seated_table.table_id = q.table_id
       LEFT JOIN restaurant_tables reserved_table ON reserved_table.table_id = q.reserved_table_id
       WHERE q.status <> 'cancelled'
       ORDER BY q.queue_number ASC, q.joined_at ASC, q.queue_id ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('listAll queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/queue/manager/history — manager-only, includes customer names
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

  if (!isValidPartySize(party_size)) {
    return res.status(400).json({ error: 'Party size must be a whole number between 1 and 12.' });
  }
  const partySize = Number(party_size);

  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'The restaurant stops accepting new queue entries at 21:00.' });
  }

  const prefix = getGroupPrefix(partySize);
  const today = getRestaurantDateKey();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `SELECT group_code FROM queue_auto_call_settings WHERE group_code = ? FOR UPDATE`,
      [prefix]
    );

    const [existing] = await conn.query(
      `SELECT queue_id FROM queue_entries
       WHERE user_id = ? AND queue_date = ? AND status IN ('queued','called','serving')
       FOR UPDATE`,
      [user_id, today]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already have an active queue number today.' });
    }

    const [missedCheck] = await conn.query(
      `SELECT COUNT(*) AS miss_count FROM queue_entries
       WHERE user_id = ? AND queue_date = ? AND status = 'missed'`,
      [user_id, today]
    );
    if (missedCheck[0].miss_count >= 1) {
      await conn.rollback();
      return res.status(403).json({
        error: 'You already have a missed ticket today. Use Rejoin Queue if your ticket meets the rejoin requirements.',
      });
    }

    const [bookingConflict] = await conn.query(
      `SELECT booking_id FROM bookings
       WHERE user_id = ? AND DATE(booking_date) = ? AND status IN ('booked','serving')
       FOR UPDATE`,
      [user_id, today]
    );

    if (bookingConflict.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'You cannot join the queue while you have an active booking for the same date.' });
    }

    const [lastRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ?
       ORDER BY queue_number DESC LIMIT 1 FOR UPDATE`,
      [today, `${prefix}%`]
    );

    let nextNum = 1;
    if (lastRows.length > 0) {
      const lastNum = parseInt(lastRows[0].queue_number.slice(1), 10);
      if (lastNum >= MAX_QUEUE_NUMBER) {
        await conn.rollback();
        return res.status(409).json({
          error: 'This queue group has reached its daily ticket limit (999). Please see the manager.',
        });
      }
      nextNum = lastNum + 1;
    }
    const queue_number = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, queue_date, status, rejoin_count)
       VALUES (?, ?, ?, ?, 'queued', 0)`,
      [user_id, partySize, queue_number, today]
    );

    await conn.commit();
    emit(req, { action: 'join', queueId: result.insertId, queueNumber: queue_number });
    return res.status(201).json({ queueId: result.insertId, queueNumber: queue_number });
  } catch (err) {
    await conn.rollback();
    console.error('join queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// GET /api/queue/user/:user_id — customer can only read own; manager can read any
async function listByUser(req, res) {
  const targetId = Number(req.params.user_id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }
  if (req.user.role !== 'manager' && req.user.user_id !== targetId) {
    return res.status(403).json({ error: 'You can only view your own queue entries.' });
  }

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
      [targetId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listByUser queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/call — manager calls a specific queued entry
async function call(req, res) {
  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Queue calling is closed for the day after 21:00.' });
  }
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [entry] = await conn.query(
      `SELECT queue_id, user_id, party_size, queue_number
       FROM queue_entries WHERE queue_id = ? AND status = 'queued' FOR UPDATE`,
      [id]
    );
    if (entry.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not found or not in queued state.' });
    }

    const target = entry[0];
    const prefix = getGroupPrefix(target.party_size);

    const [calledRows] = await conn.query(
      `SELECT queue_id FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ? AND status = 'called'
       ORDER BY called_at ASC, queue_id ASC LIMIT 1 FOR UPDATE`,
      [getRestaurantDateKey(), `${prefix}%`]
    );
    if (calledRows.length > 0) {
      await conn.query(
        `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
         WHERE queue_id = ? AND status = 'called'`,
        [calledRows[0].queue_id]
      );
    }

    await conn.query(
      `UPDATE queue_entries SET status = 'called', called_at = UTC_TIMESTAMP() WHERE queue_id = ? AND status = 'queued'`,
      [id]
    );

    await conn.commit();
    emit(req, {
      action: 'call',
      queueId: target.queue_id,
      queueNumber: target.queue_number,
      calledUserId: target.user_id,
      calledQueueId: target.queue_id,
      calledQueueNumber: target.queue_number,
      calledAt: new Date().toISOString(),
    });
    return res.json({ message: 'Queue entry called.' });
  } catch (err) {
    await conn.rollback();
    console.error('call queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/queue/:id/checkin — manager confirms arrival (called -> serving)
async function checkin(req, res) {
  if (isLastOrderCutoffReached()) {
    return res.status(409).json({ error: 'Queue seating is closed for the day after 21:00.' });
  }
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'serving', served_at = UTC_TIMESTAMP()
       WHERE queue_id = ? AND status = 'called'`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(400).json({ error: 'Queue entry not found or not in called state.' });
    }
    emit(req, { action: 'checkin', queueId: Number(id) });
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
    emit(req, { action: 'auto-call', group, enabled });
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
       SET status = 'serving', table_id = ?, reserved_table_id = NULL, served_at = UTC_TIMESTAMP()
       WHERE queue_id = ? AND status = 'called'`,
      [table.table_id, entry.queue_id]
    );

    await conn.commit();
    emit(req, { action: 'seat', queueId: entry.queue_id, tableId: table.table_id });
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
  const queueDate = getRestaurantDateKey();
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
       WHERE queue_date = ? AND queue_number LIKE ? AND status = 'called'
       ORDER BY called_at DESC, queue_id DESC LIMIT 1 FOR UPDATE`,
      [queueDate, prefix]
    );

    if (called.length) {
      const elapsed = Date.now() - parseUtcDateTime(called[0].called_at);
      if (elapsed < AUTO_CALL_MISSED_AFTER_MS) {
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
      `SELECT queue_id, user_id, party_size, queue_number FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ? AND status = 'queued'
       ORDER BY queue_number ASC, joined_at ASC, queue_id ASC FOR UPDATE`,
      [queueDate, prefix]
    );

    for (const entry of waiting) {
      if (isLastOrderCutoffReached()) break;
      const table = await findAvailableTable(conn, entry.party_size);
      if (!table) continue;

      await conn.query(
        `UPDATE queue_entries
         SET status = 'called', called_at = UTC_TIMESTAMP(), reserved_table_id = ?
         WHERE queue_id = ? AND status = 'queued'`,
        [table.table_id, entry.queue_id]
      );
      await conn.commit();
      emit(null, { action: 'auto-call', queueId: entry.queue_id, queueNumber: entry.queue_number, calledUserId: entry.user_id, calledQueueId: entry.queue_id, calledQueueNumber: entry.queue_number });
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
         WHERE queue_date = ? AND status = 'called'`,
        [getRestaurantDateKey()]
      );
      await conn.query(`UPDATE queue_auto_call_settings SET enabled = FALSE WHERE enabled = TRUE`);
      await conn.commit();
      return;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  await Promise.all(QUEUE_GROUPS.map(processAutoCallGroup));
}

async function autoFinishServing() {
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'finished'
       WHERE status = 'serving' AND served_at IS NOT NULL
         AND served_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)`
    );
    return result.affectedRows;
  } catch (err) {
    console.error('autoFinishServing error:', err);
    throw err;
  }
}

// PATCH /api/queue/:id/finish — manual finish
async function finish(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'finished' WHERE queue_id = ? AND status = 'serving'`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(400).json({ error: 'Queue entry not serving.' });
    }
    emit(req, { action: 'finish', queueId: Number(id) });
    return res.json({ message: 'Queue entry finished.' });
  } catch (err) {
    console.error('finish queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/pay — manager marks finished -> paid + sync orders
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

    await conn.query(`UPDATE queue_entries SET status = 'paid' WHERE queue_id = ?`, [id]);
    await conn.query(
      `UPDATE orders SET payment_status = 'paid' WHERE queue_id = ? AND payment_status = 'unpaid'`,
      [id]
    );

    await conn.commit();
    emit(req, { action: 'pay', queueId: Number(id) });
    return res.json({ message: 'Queue entry paid.' });
  } catch (err) {
    await conn.rollback();
    console.error('pay queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/queue/:id/cancel — customer can cancel own; manager can cancel any
async function cancel(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT user_id FROM queue_entries WHERE queue_id = ? AND status IN ('queued','called')`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Cannot cancel this queue entry.' });
    }
    if (req.user.role !== 'manager' && rows[0].user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'You can only cancel your own queue entry.' });
    }

    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'cancelled'
       WHERE queue_id = ? AND status IN ('queued','called')`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(400).json({ error: 'Cannot cancel this queue entry.' });
    }
    emit(req, { action: 'cancel', queueId: Number(id) });
    return res.json({ message: 'Queue entry cancelled.' });
  } catch (err) {
    console.error('cancel queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/reissue — manager issues a new ticket for a missed entry
async function reissue(req, res) {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [entry] = await conn.query(
      `SELECT user_id, party_size, DATE_FORMAT(queue_date, '%Y-%m-%d') AS queue_date
       FROM queue_entries WHERE queue_id = ? AND status = 'missed' FOR UPDATE`,
      [id]
    );
    if (entry.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not found or not missed.' });
    }

    const { user_id, party_size, queue_date } = entry[0];
    const prefix = getGroupPrefix(party_size);

    await conn.query(
      `SELECT group_code FROM queue_auto_call_settings WHERE group_code = ? FOR UPDATE`,
      [prefix]
    );

    const [active] = await conn.query(
      `SELECT queue_id FROM queue_entries
       WHERE user_id = ? AND queue_date = ? AND status IN ('queued','called','serving')`,
      [user_id, queue_date]
    );
    if (active.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Customer already has an active ticket.' });
    }

    const [lastRows] = await conn.query(
      `SELECT queue_number FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ?
       ORDER BY queue_number DESC LIMIT 1 FOR UPDATE`,
      [queue_date, `${prefix}%`]
    );

    let nextNum = 1;
    if (lastRows.length > 0) {
      const lastNum = parseInt(lastRows[0].queue_number.slice(1), 10);
      if (lastNum >= MAX_QUEUE_NUMBER) {
        await conn.rollback();
        return res.status(409).json({ error: 'This queue group has reached its daily ticket limit (999).' });
      }
      nextNum = lastNum + 1;
    }
    const new_queue_number = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, queue_date, status, rejoin_count)
       VALUES (?, ?, ?, ?, 'queued', ?)`,
      [user_id, party_size, new_queue_number, queue_date, 1]
    );

    await conn.commit();
    emit(req, { action: 'reissue', queueId: result.insertId, queueNumber: new_queue_number });
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

async function getCustomerRejoinPreview(conn, missed, userId) {
  if (missed.queue_date !== getRestaurantDateKey()) {
    return { status: 409, error: 'Only today’s missed ticket can rejoin the queue.' };
  }
  if (Number(missed.rejoin_count) > 0) {
    return { status: 409, error: 'You have already rejoined the queue today.' };
  }

  const [rejoinedRows] = await conn.query(
    `SELECT queue_id FROM queue_entries
     WHERE user_id = ? AND queue_date = ? AND rejoin_count > 0
     LIMIT 1`,
    [userId, missed.queue_date]
  );
  if (rejoinedRows.length) {
    return { status: 409, error: 'You have already rejoined the queue today.' };
  }

  const prefix = getGroupPrefix(missed.party_size);
  const [calledRows] = await conn.query(
    `SELECT queue_number FROM queue_entries
     WHERE queue_date = ? AND queue_number LIKE ? AND status = 'called'
     ORDER BY called_at DESC, queue_id DESC LIMIT 1`,
    [missed.queue_date, `${prefix}%`]
  );
  if (!calledRows.length) {
    return { status: 409, error: 'There is no current call for your queue group yet.' };
  }

  const missedNumber = Number(missed.queue_number.slice(1));
  const currentNumber = Number(calledRows[0].queue_number.slice(1));
  if (missedNumber > currentNumber || missedNumber < currentNumber - 35) {
    return {
      status: 409,
      error: 'You can rejoin when your missed number is no more than 35 numbers behind the current call.',
    };
  }

  const [activeRows] = await conn.query(
    `SELECT queue_id FROM queue_entries
     WHERE user_id = ? AND queue_date = ? AND status IN ('queued','called','serving')
     LIMIT 1`,
    [userId, missed.queue_date]
  );
  if (activeRows.length) {
    return { status: 409, error: 'You already have an active queue ticket.' };
  }

  const [assignedRows] = await conn.query(
    `SELECT queue_number, status FROM queue_entries
     WHERE queue_date = ? AND queue_number LIKE ?`,
    [missed.queue_date, `${prefix}%`]
  );
  const assignedNumbers = assignedRows
    .map(row => Number(String(row.queue_number || '').slice(1)))
    .filter(number => Number.isInteger(number) && number > 0);
  const targetNumber = Math.max(0, ...assignedNumbers) + 1;
  if (targetNumber > MAX_QUEUE_NUMBER) {
    return {
      status: 409,
      error: 'This queue group has reached its daily ticket limit (999). Please try again tomorrow.',
    };
  }

  const groupsAhead = assignedRows.filter(row => (
    ['queued', 'called'].includes(row.status)
    && Number(String(row.queue_number || '').slice(1)) < targetNumber
  )).length;

  return {
    queueNumber: `${prefix}${String(targetNumber).padStart(3, '0')}`,
    groupsAhead,
    queueDate: missed.queue_date,
  };
}

// GET /api/queue/:id/rejoin-preview — validate eligibility and preview the next ticket
async function customerRejoinPreview(req, res) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const [missedRows] = await db.query(
      `SELECT queue_id, user_id, party_size, queue_number,
              DATE_FORMAT(queue_date, '%Y-%m-%d') AS queue_date, rejoin_count
       FROM queue_entries
       WHERE queue_id = ? AND user_id = ? AND status = 'missed'`,
      [id, userId]
    );
    if (!missedRows.length) {
      return res.status(404).json({ error: 'Missed queue entry not found.' });
    }

    const preview = await getCustomerRejoinPreview(db, missedRows[0], userId);
    if (preview.error) return res.status(preview.status).json({ error: preview.error });
    return res.json(preview);
  } catch (err) {
    console.error('customer rejoin preview error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// POST /api/queue/:id/rejoin — confirm the previewed ticket number
async function customerRejoin(req, res) {
  const { id } = req.params;
  const userId = req.user.user_id;
  const expectedQueueNumber = String(req.body?.queue_number || '');
  const expectedGroupsAhead = Number(req.body?.groups_ahead);
  if (!/^[ABC]\d{3}$/.test(expectedQueueNumber) || !Number.isInteger(expectedGroupsAhead) || expectedGroupsAhead < 0) {
    return res.status(400).json({ error: 'Preview your rejoin ticket before confirming.' });
  }
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [missedRows] = await conn.query(
      `SELECT queue_id, user_id, party_size, queue_number,
              DATE_FORMAT(queue_date, '%Y-%m-%d') AS queue_date, rejoin_count
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
    const prefix = getGroupPrefix(missed.party_size);
    await conn.query(
      `SELECT group_code FROM queue_auto_call_settings WHERE group_code = ? FOR UPDATE`,
      [prefix]
    );

    const preview = await getCustomerRejoinPreview(conn, missed, userId);
    if (preview.error) {
      await conn.rollback();
      return res.status(preview.status).json({ error: preview.error });
    }
    if (preview.queueNumber !== expectedQueueNumber || preview.groupsAhead !== expectedGroupsAhead) {
      await conn.rollback();
      return res.status(409).json({
        error: `The queue changed while you were confirming. Your updated number is ${preview.queueNumber} with ${preview.groupsAhead} ${preview.groupsAhead === 1 ? 'group' : 'groups'} ahead; please review it before confirming.`,
      });
    }

    await conn.query(
      `UPDATE queue_entries SET rejoin_count = 1 WHERE queue_id = ?`,
      [missed.queue_id]
    );
    const [result] = await conn.query(
      `INSERT INTO queue_entries (user_id, party_size, queue_number, queue_date, status, rejoin_count)
       VALUES (?, ?, ?, ?, 'queued', 1)`,
      [userId, missed.party_size, preview.queueNumber, missed.queue_date]
    );

    await conn.commit();
    emit(req, { action: 'rejoin', queueId: result.insertId, queueNumber: preview.queueNumber });
    return res.status(201).json({
      message: 'You have rejoined the queue.',
      queueId: result.insertId,
      queueNumber: preview.queueNumber,
      groupsAhead: preview.groupsAhead,
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
  setSocketIo,
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
  autoFinishServing,
  finish,
  pay,
  cancel,
  reissue,
  customerRejoinPreview,
  customerRejoin,
};