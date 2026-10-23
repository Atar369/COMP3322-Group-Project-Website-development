const db = require('../db');

// GET /api/orders — all orders with booking/queue context (manager)
async function listAll(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, o.user_id, o.booking_id, o.queue_id, o.order_time,
              o.status, o.total_amount, o.payment_status,
              b.booking_date, b.booking_time, b.party_size AS booking_party,
              b.status AS booking_status,
              bt.table_number,
              q.party_size AS queue_party, q.status AS queue_status, q.served_at AS queue_served_at
       FROM orders o
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN restaurant_tables bt ON bt.table_id = b.table_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       ORDER BY o.order_time ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('listAll orders error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// POST /api/orders — place a new order
async function create(req, res) {
  const { user_id, booking_id, queue_id, items } = req.body;
  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'user_id and items are required.' });
  }
  const total = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO orders (user_id, booking_id, queue_id, status, total_amount, payment_status)
       VALUES (?, ?, ?, 'pending', ?, 'unpaid')`,
      [user_id, booking_id || null, queue_id || null, total]
    );
    const order_id = result.insertId;
    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
        [order_id, item.item_id, item.quantity, item.unit_price]
      );
    }
    await conn.commit();
    return res.status(201).json({ orderId: order_id });
  } catch (err) {
    await conn.rollback();
    console.error('create order error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  } finally {
    conn.release();
  }
}

// GET /api/orders/:id — single order with items
async function getOne(req, res) {
  const { id } = req.params;
  try {
    const [orders] = await db.query(
      `SELECT o.order_id, o.user_id, o.booking_id, o.queue_id, o.order_time,
              o.status, o.total_amount, o.payment_status,
              b.booking_date, b.booking_time, bt.table_number,
              b.status AS booking_status, b.party_size AS booking_party,
              q.status AS queue_status, q.party_size AS queue_party
       FROM orders o
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN restaurant_tables bt ON bt.table_id = b.table_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       WHERE o.order_id = ?`,
      [id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const [items] = await db.query(
      `SELECT oi.order_item_id, oi.item_id, oi.quantity, oi.unit_price, oi.subtotal, m.name
       FROM order_items oi JOIN menu_items m ON m.item_id = oi.item_id
       WHERE oi.order_id = ?`,
      [id]
    );
    return res.json({ ...orders[0], items });
  } catch (err) {
    console.error('getOne order error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/orders/user/:user_id — orders for a specific customer
async function listByUser(req, res) {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, o.user_id, o.booking_id, o.queue_id, o.order_time,
              o.status, o.total_amount, o.payment_status
       FROM orders o WHERE o.user_id = ? ORDER BY o.order_time DESC`,
      [user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listByUser order error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/orders/:id/status — advance kitchen status (manager)
async function advanceStatus(req, res) {
  const { id } = req.params;
  const NEXT = { pending: 'preparing', preparing: 'ready' };
  try {
    const [rows] = await db.query('SELECT status FROM orders WHERE order_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
    const next = NEXT[rows[0].status];
    if (!next) return res.status(400).json({ error: 'Cannot advance from this status.' });
    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [next, id]);
    return res.json({ status: next });
  } catch (err) {
    console.error('advanceStatus error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/orders/:id/finish — customer clicks "Finish & Pay" (sets payment_status=pending_payment)
async function finishOrder(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE orders SET payment_status = 'pending_payment' WHERE order_id = ? AND status = 'ready'`,
      [id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Order not ready or already processed.' });
    return res.json({ message: 'Manager has been notified to collect payment.' });
  } catch (err) {
    console.error('finishOrder error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// PATCH /api/orders/:id/pay — manager marks as paid
async function markPaid(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE orders SET status = 'completed', payment_status = 'paid' WHERE order_id = ?`,
      [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Order not found.' });
    return res.json({ message: 'Order marked as paid.' });
  } catch (err) {
    console.error('markPaid error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

module.exports = { listAll, create, getOne, listByUser, advanceStatus, finishOrder, markPaid };
