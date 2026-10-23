const db = require('../db');

// GET /api/queue — all non-cancelled entries
async function listAll(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT queue_id, user_id, party_size, joined_at, status, called_at, served_at
       FROM queue_entries ORDER BY joined_at ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('listAll queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// POST /api/queue — customer joins queue
async function join(req, res) {
  const { user_id, party_size } = req.body;
  if (!user_id || !party_size) return res.status(400).json({ error: 'user_id and party_size required.' });
  try {
    const [result] = await db.query(
      `INSERT INTO queue_entries (user_id, party_size, status) VALUES (?, ?, 'queued')`,
      [user_id, party_size]
    );
    return res.status(201).json({ queueId: result.insertId });
  } catch (err) {
    console.error('join queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/queue/user/:user_id — queue entries for one customer
async function listByUser(req, res) {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT queue_id, user_id, party_size, joined_at, status, called_at, served_at
       FROM queue_entries WHERE user_id = ? ORDER BY joined_at DESC`,
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
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'called', called_at = NOW() WHERE queue_id = ? AND status = 'queued'`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Queue entry not found or not waiting.' });
    return res.json({ message: 'Queue entry called.' });
  } catch (err) {
    console.error('call queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/queue/:id/checkin — manager confirms customer arrival → serving
async function checkin(req, res) {
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

// PATCH /api/queue/:id/finish — auto or manual finish after 2h
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
  try {
    const [result] = await db.query(
      `UPDATE queue_entries SET status = 'paid' WHERE queue_id = ? AND status = 'finished'`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Queue entry not finished.' });
    return res.json({ message: 'Queue entry paid.' });
  } catch (err) {
    console.error('pay queue error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
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

module.exports = { listAll, join, listByUser, call, checkin, finish, pay, cancel };
