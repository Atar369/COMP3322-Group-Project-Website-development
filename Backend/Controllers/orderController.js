const db = require('../db');
const { isLastOrderCutoffReached, isOrderWindowOpen } = require('../utils/orderingWindow');

// GET /api/orders — all orders with booking/queue context (manager)
async function listAll(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT active_sessions.session_type, active_sessions.session_id, active_sessions.user_id,
              active_sessions.customer_name,
              active_sessions.table_id, active_sessions.table_number,
              active_sessions.booking_date, active_sessions.booking_time,
              active_sessions.party_size, active_sessions.special_request,
              active_sessions.session_status, active_sessions.served_at,
              o.order_id, o.order_time, o.total_amount, o.payment_status,
              oi.order_item_id, oi.quantity, oi.unit_price, oi.subtotal, m.name AS item_name
       FROM (
         SELECT 'booking' AS session_type, b.booking_id AS session_id, b.user_id, u.name AS customer_name,
                b.table_id, t.table_number, b.booking_date, b.booking_time,
                b.party_size, b.special_request, b.status AS session_status, b.served_at
         FROM bookings b
         JOIN users u ON u.user_id = b.user_id
         JOIN restaurant_tables t ON t.table_id = b.table_id
         WHERE b.status IN ('serving', 'finished')
         UNION ALL
         SELECT 'queue' AS session_type, q.queue_id AS session_id, q.user_id, u.name AS customer_name,
                q.table_id, t.table_number, NULL AS booking_date, NULL AS booking_time,
                q.party_size, NULL AS special_request, q.status AS session_status, q.served_at
         FROM queue_entries q
         JOIN users u ON u.user_id = q.user_id
         JOIN restaurant_tables t ON t.table_id = q.table_id
         WHERE q.status IN ('serving', 'finished')
       ) AS active_sessions
       LEFT JOIN orders o
         ON ((active_sessions.session_type = 'booking' AND o.booking_id = active_sessions.session_id)
          OR (active_sessions.session_type = 'queue' AND o.queue_id = active_sessions.session_id))
         AND o.payment_status = 'unpaid'
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN menu_items m ON m.item_id = oi.item_id
       ORDER BY active_sessions.table_id, o.order_time, o.order_id, oi.order_item_id`
    );
    const sessions = new Map();
    for (const row of rows) {
      const key = `${row.session_type}-${row.session_id}`;
      let session = sessions.get(key);
      if (!session) {
        session = {
          session_type: row.session_type,
          session_id: row.session_id,
          user_id: row.user_id,
          customer_name: row.customer_name,
          table_id: row.table_id,
          table_number: row.table_number,
          booking_date: row.booking_date,
          booking_time: row.booking_time,
          party_size: row.party_size,
          special_request: row.special_request,
          session_status: row.session_status,
          served_at: row.served_at,
          orders: new Map(),
        };
        sessions.set(key, session);
      }
      if (row.order_id == null) continue;

      let order = session.orders.get(row.order_id);
      if (!order) {
        order = {
          order_id: row.order_id,
          order_time: row.order_time,
          total_amount: row.total_amount,
          items: [],
        };
        session.orders.set(row.order_id, order);
      }
      if (row.order_item_id != null) {
        order.items.push({
          order_item_id: row.order_item_id,
          name: row.item_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          subtotal: row.subtotal,
        });
      }
    }
    return res.json([...sessions.values()].map(session => ({
      ...session,
      orders: [...session.orders.values()],
    })));
  } catch (err) {
    console.error('listAll orders error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/orders/manager/history — paid orders for manager review
async function listManagerHistory(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, o.order_time, o.updated_at AS paid_at, o.total_amount,
              COALESCE(o.table_id, b.table_id, q.table_id) AS table_id,
              t.table_number, COALESCE(b.party_size, q.party_size) AS party_size,
              b.booking_date, b.booking_time, b.special_request, q.queue_number,
              u.name AS customer_name,
              oi.order_item_id, oi.quantity, oi.unit_price, oi.subtotal,
              m.name AS item_name
       FROM orders o
       JOIN users u ON u.user_id = o.user_id
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       LEFT JOIN restaurant_tables t ON t.table_id = COALESCE(o.table_id, b.table_id, q.table_id)
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN menu_items m ON m.item_id = oi.item_id
       WHERE o.payment_status = 'paid'
       ORDER BY o.updated_at DESC, o.order_id DESC, oi.order_item_id`
    );
    const orders = new Map();
    for (const row of rows) {
      let order = orders.get(row.order_id);
      if (!order) {
        order = {
          order_id: row.order_id,
          order_time: row.order_time,
          paid_at: row.paid_at,
          total_amount: row.total_amount,
          table_id: row.table_id,
          table_number: row.table_number,
          party_size: row.party_size,
          booking_date: row.booking_date,
          booking_time: row.booking_time,
          special_request: row.special_request,
          queue_number: row.queue_number,
          customer_name: row.customer_name,
          items: [],
        };
        orders.set(row.order_id, order);
      }
      if (row.order_item_id != null) {
        order.items.push({
          order_item_id: row.order_item_id,
          name: row.item_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          subtotal: row.subtotal,
        });
      }
    }
    return res.json([...orders.values()]);
  } catch (err) {
    console.error('listManagerHistory orders error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// POST /api/orders — place a new order
async function create(req, res) {
  const { user_id, booking_id, queue_id, items } = req.body;
  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'user_id and items are required.' });
  }
  if (Boolean(booking_id) === Boolean(queue_id)) {
    return res.status(400).json({ error: 'Exactly one seated booking or queue entry is required.' });
  }
  const total = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let table_id = null;
    if (booking_id) {
      const [sessions] = await conn.query(
        `SELECT table_id, served_at FROM bookings
         WHERE booking_id = ? AND user_id = ? AND status = 'serving' FOR UPDATE`,
        [booking_id, user_id]
      );
      if (!sessions.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Booking must be seated before ordering.' });
      }
      if (isLastOrderCutoffReached() || !isOrderWindowOpen(sessions[0].served_at)) {
        await conn.rollback();
        return res.status(409).json({ error: 'The last-order window has ended. Orders must be placed within 45 minutes of seating and before 21:00.' });
      }
      table_id = sessions[0].table_id;
    } else {
      const [sessions] = await conn.query(
        `SELECT queue_id, table_id, served_at FROM queue_entries
         WHERE queue_id = ? AND user_id = ? AND status = 'serving' FOR UPDATE`,
        [queue_id, user_id]
      );
      if (!sessions.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Queue entry must be seated before ordering.' });
      }
      if (isLastOrderCutoffReached() || !isOrderWindowOpen(sessions[0].served_at)) {
        await conn.rollback();
        return res.status(409).json({ error: 'The last-order window has ended. Orders must be placed within 45 minutes of seating and before 21:00.' });
      }
      table_id = sessions[0].table_id;
    }
    const [result] = await conn.query(
      `INSERT INTO orders (user_id, booking_id, queue_id, table_id, status, total_amount, payment_status)
       VALUES (?, ?, ?, ?, 'pending', ?, 'unpaid')`,
      [user_id, booking_id || null, queue_id || null, table_id, total]
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
      `SELECT o.order_id, o.booking_id, o.queue_id, o.order_time,
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
              o.status, o.total_amount, o.payment_status,
              COALESCE(o.table_id, b.table_id) AS table_id
       FROM orders o
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       WHERE o.payment_status = 'unpaid'
         AND (o.user_id = ? OR EXISTS (
           SELECT 1 FROM bookings customer_booking
           WHERE customer_booking.user_id = ?
             AND customer_booking.table_id = COALESCE(o.table_id, b.table_id)
             AND customer_booking.status IN ('serving', 'finished')
         ))
       ORDER BY COALESCE(o.table_id, b.table_id), o.order_time DESC`,
      [user_id, user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listByUser order error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/orders/history/:user_id — full payment history for a customer
async function listHistoryByUser(req, res) {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, o.booking_id, o.queue_id, o.order_time, o.updated_at,
              o.total_amount, o.payment_status,
              COALESCE(o.table_id, b.table_id, q.table_id) AS table_id,
              COALESCE(b.party_size, q.party_size) AS party_size
       FROM orders o
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       WHERE o.user_id = ? OR EXISTS (
         SELECT 1 FROM bookings customer_booking
         WHERE customer_booking.user_id = ?
           AND customer_booking.table_id = COALESCE(o.table_id, b.table_id, q.table_id)
           AND customer_booking.status IN ('serving', 'finished')
       )
       ORDER BY o.order_time DESC, o.order_id DESC`,
      [user_id, user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listHistoryByUser orders error:', err);
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

module.exports = { listAll, listManagerHistory, create, getOne, listByUser, listHistoryByUser, advanceStatus, finishOrder, markPaid };
