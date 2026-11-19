const db = require('../db');
const {
  isBeforeRestaurantOpening,
  isRestaurantEntryCutoffReached,
  isQueueEntryWindowOpen,
} = require('../utils/orderingWindow');
const { getRestaurantDateKey } = require('../utils/restaurantTime');

let socketIo = null;
function setSocketIo(io) {
  socketIo = io;
}

const MAX_QUEUE_NUMBER = 999;

function getGroupPrefix(party_size) {
  if (party_size <= 2) return 'A';
  if (party_size <= 6) return 'B';
  return 'C';
}

function isValidPartySize(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

function getNextQueueNumber(prefix, lastRows) {
  const lastNum = lastRows.length > 0
    ? parseInt(lastRows[0].queue_number.slice(1), 10)
    : 0;
  if (lastNum >= MAX_QUEUE_NUMBER) return null;
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
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

// GET /api/queue — public board, only show today's active queue entries
async function listAll(req, res) {
  try {
    const today = getRestaurantDateKey();
    const [rows] = await db.query(
      `SELECT q.queue_id, q.party_size, q.queue_number, q.queue_date, q.joined_at,
              q.status, q.table_id, seated_table.table_number,
              q.reserved_table_id, reserved_table.table_number AS assigned_table_number,
              q.called_at, q.served_at, q.rejoin_count
       FROM queue_entries q
       LEFT JOIN restaurant_tables seated_table ON seated_table.table_id = q.table_id
       LEFT JOIN restaurant_tables reserved_table ON reserved_table.table_id = q.reserved_table_id
       WHERE q.status <> 'cancelled' AND q.queue_date = ?
       ORDER BY q.queue_number ASC, q.joined_at ASC, q.queue_id ASC`,
      [today]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listAll queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/queue/next-number?party_size=2 — preview the next ticket in a group
async function nextNumber(req, res) {
  if (!isValidPartySize(req.query.party_size)) {
    return res.status(400).json({ error: 'Party size must be a whole number between 1 and 12.' });
  }

  const prefix = getGroupPrefix(Number(req.query.party_size));
  try {
    const [lastRows] = await db.query(
      `SELECT queue_number FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ?
       ORDER BY queue_number DESC LIMIT 1`,
      [getRestaurantDateKey(), `${prefix}%`]
    );
    return res.json({ nextQueueNumber: getNextQueueNumber(prefix, lastRows) });
  } catch (err) {
    console.error('next queue number error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/queue/manager/history — manager-only, includes all historical entries and customer names
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

  if (!isQueueEntryWindowOpen()) {
    const error = isRestaurantEntryCutoffReached()
      ? 'The last queue entry is at 21:00 (9:00 PM). The restaurant closes at 22:00 (10:00 PM).'
      : 'The restaurant opens at 10:00. Queue entries are not available yet.';
    return res.status(409).json({ error });
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
        error: 'You have already missed your turn today. Please speak with the manager for assistance.',
      });
    }

    const [activeOrderCheck] = await conn.query(
      `SELECT order_id FROM orders
       WHERE user_id = ? AND status IN ('pending', 'preparing', 'ready') AND payment_status != 'paid'
       FOR UPDATE`,
      [user_id]
    );
    if (activeOrderCheck.length > 0) {
      await conn.rollback();
      return res.status(409).json({ 
        error: 'You have an active order in progress. You are already seated and cannot join the queue.' 
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

    const queue_number = getNextQueueNumber(prefix, lastRows);
    if (!queue_number) {
      await conn.rollback();
      return res.status(409).json({
        error: 'This queue group has reached its daily ticket limit (999). Please see the manager.',
      });
    }

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
  if (!isQueueEntryWindowOpen()) {
    const error = isRestaurantEntryCutoffReached()
      ? 'Queue calling stops at 21:00 (9:00 PM). The restaurant closes at 22:00 (10:00 PM).'
      : 'Queue calling starts at 10:00.';
    return res.status(409).json({ error });
  }
  const { id } = req.params;
  const today = getRestaurantDateKey();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Force restriction to only call today's queue entries
    const [entry] = await conn.query(
      `SELECT queue_id, user_id, party_size, queue_number
       FROM queue_entries WHERE queue_id = ? AND status = 'queued' AND queue_date = ? FOR UPDATE`,
      [id, today]
    );
    if (entry.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Queue entry not found or not in queued state today.' });
    }

    const target = entry[0];
    const prefix = getGroupPrefix(target.party_size);

    const [calledRows] = await conn.query(
      `SELECT queue_id FROM queue_entries
       WHERE queue_date = ? AND queue_number LIKE ? AND status = 'called'
       ORDER BY called_at ASC, queue_id ASC LIMIT 1 FOR UPDATE`,
      [today, `${prefix}%`]
    );
    if (calledRows.length > 0) {
      await conn.query(
        `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
         WHERE queue_id = ? AND status = 'called'`,
        [calledRows[0].queue_id]
      );
    }

    const [calledResult] = await conn.query(
      `UPDATE queue_entries SET status = 'called', called_at = UTC_TIMESTAMP()
       WHERE queue_id = ? AND status = 'queued'
         AND HOUR(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)) < 21`,
      [id]
    );
    if (!calledResult.affectedRows) {
      await conn.rollback();
      return isRestaurantEntryCutoffReached()
        ? res.status(409).json({ error: 'Queue calls stop at the 9:00 PM last-entry time.' })
        : res.status(409).json({ error: 'This queue entry is no longer waiting to be called.' });
    }

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
  if (!isQueueEntryWindowOpen()) {
    const error = isRestaurantEntryCutoffReached()
      ? 'Queue seating stops at 21:00 (9:00 PM). The restaurant closes at 22:00 (10:00 PM).'
      : 'Queue seating starts at 10:00.';
    return res.status(409).json({ error });
  }
  const { id } = req.params;
  const today = getRestaurantDateKey();

  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'serving', served_at = UTC_TIMESTAMP()
       WHERE queue_id = ? AND status = 'called' AND queue_date = ?
         AND HOUR(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)) < 21`,
      [id, today]
    );
    if (!result.affectedRows) {
      if (isRestaurantEntryCutoffReached()) {
        return res.status(409).json({ error: 'Queue seating stops at the 9:00 PM last-entry time.' });
      }
      return res.status(400).json({ error: 'Queue entry not found or not in called state.' });
    }
    emit(req, { action: 'checkin', queueId: Number(id) });
    return res.json({ message: 'Queue entry now serving.' });
  } catch (err) {
    console.error('checkin queue error:', err);
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
  if (!isQueueEntryWindowOpen()) {
    const error = isRestaurantEntryCutoffReached()
      ? 'Queue seating stops at 21:00 (9:00 PM). The restaurant closes at 22:00 (10:00 PM).'
      : 'Queue seating starts at 10:00.';
    return res.status(409).json({ error });
  }
  const { id } = req.params;
  const today = getRestaurantDateKey();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Force restriction to only seat today's queue entries
    const [entries] = await conn.query(
      `SELECT queue_id, party_size, table_id, reserved_table_id
       FROM queue_entries WHERE queue_id = ? AND status = 'called' AND queue_date = ? FOR UPDATE`,
      [id, today]
    );
    if (!entries.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'There is no current called ticket to seat today.' });
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

    const [seatedResult] = await conn.query(
      `UPDATE queue_entries
       SET status = 'serving', table_id = ?, reserved_table_id = NULL, served_at = UTC_TIMESTAMP()
       WHERE queue_id = ? AND status = 'called'
         AND HOUR(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)) < 21`,
      [table.table_id, entry.queue_id]
    );
    if (!seatedResult.affectedRows) {
      await conn.rollback();
      return isRestaurantEntryCutoffReached()
        ? res.status(409).json({ error: 'Queue seating stops at the 9:00 PM last-entry time.' })
        : res.status(409).json({ error: 'This queue entry is no longer awaiting seating.' });
    }

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

// Clean up stale queue entries and clear unseated calls after closing time.
async function queueMaintenanceCycle() {
  if (isBeforeRestaurantOpening()) return;
  const today = getRestaurantDateKey();
  
  if (isRestaurantEntryCutoffReached()) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE queue_entries SET status = 'missed', reserved_table_id = NULL
         WHERE queue_date = ? AND status = 'called'`,
        [today]
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

  // On startup, mark past uncompleted entries as missed to prevent ghost queues
  try {
    await db.query(
      `UPDATE queue_entries 
       SET status = 'missed', reserved_table_id = NULL
       WHERE queue_date < ? AND status IN ('queued', 'called')`,
      [today]
    );
  } catch (error) {
    console.error('Failed to clean up past queue entries:', error);
  }
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

module.exports = {
  setSocketIo,
  listAll,
  nextNumber,
  managerHistory,
  join,
  listByUser,
  call,
  checkin,
  seat,
  queueMaintenanceCycle,
  autoFinishServing,
  finish,
  pay,
  cancel,
};