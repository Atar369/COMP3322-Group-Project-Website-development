const db = require('../db');
const {
  isBeforeRestaurantOpening,
  isOrderWindowOpen,
  isOrderPlacementCutoffReached,
} = require('../utils/orderingWindow');

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
              o.order_id, o.order_time, o.total_amount, o.payment_status
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
       ORDER BY active_sessions.table_id, o.order_time, o.order_id`
    );

    const sessions = new Map();
    const orderMap = new Map();

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
          orders: [],
        };
        sessions.set(key, session);
      }

      if (row.order_id != null && !orderMap.has(row.order_id)) {
        const order = {
          order_id: row.order_id,
          order_time: row.order_time,
          total_amount: row.total_amount,
          items: [],
        };
        orderMap.set(row.order_id, order);
        session.orders.push(order);
      }
    }

    if (orderMap.size > 0) {
      const orderIds = [...orderMap.keys()];
      const placeholders = orderIds.map(() => '?').join(', ');
      const [items] = await db.query(
        `SELECT oi.order_id, oi.order_item_id, oi.quantity, oi.unit_price, oi.subtotal, m.name AS item_name
         FROM order_items oi
         JOIN menu_items m ON m.item_id = oi.item_id
         WHERE oi.order_id IN (${placeholders})
         ORDER BY oi.order_item_id`,
        orderIds
      );
      for (const item of items) {
        const order = orderMap.get(item.order_id);
        if (order) {
          order.items.push({
            order_item_id: item.order_item_id,
            name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          });
        }
      }
    }

    return res.json([...sessions.values()]);
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
              u.name AS customer_name
       FROM orders o
       JOIN users u ON u.user_id = o.user_id
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       LEFT JOIN restaurant_tables t ON t.table_id = COALESCE(o.table_id, b.table_id, q.table_id)
       WHERE o.payment_status = 'paid'
       ORDER BY o.updated_at DESC, o.order_id DESC`
    );
    const orders = new Map();
    for (const row of rows) {
      orders.set(row.order_id, {
        ...row,
        items: [],
      });
    }

    if (orders.size > 0) {
      const orderIds = [...orders.keys()];
      const placeholders = orderIds.map(() => '?').join(', ');
      const [items] = await db.query(
        `SELECT oi.order_id, oi.order_item_id, oi.quantity, oi.unit_price, oi.subtotal, m.name AS item_name
         FROM order_items oi
         JOIN menu_items m ON m.item_id = oi.item_id
         WHERE oi.order_id IN (${placeholders})
         ORDER BY oi.order_item_id`,
        orderIds
      );

      for (const item of items) {
        const order = orders.get(item.order_id);
        if (order) {
          order.items.push({
            order_item_id: item.order_item_id,
            name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          });
        }
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
  const { booking_id, queue_id, items } = req.body;
  const user_id = req.user.user_id;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required.' });
  }
  if (Boolean(booking_id) === Boolean(queue_id)) {
    return res.status(400).json({ error: 'Exactly one seated booking or queue entry is required.' });
  }

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
      if (isBeforeRestaurantOpening() || isOrderPlacementCutoffReached() || !isOrderWindowOpen(sessions[0].served_at)) {
        await conn.rollback();
        return res.status(409).json({ error: 'Orders are available from 10:00 AM until 9:45 PM, and only within 45 minutes of seating.' });
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
      if (isBeforeRestaurantOpening() || isOrderPlacementCutoffReached() || !isOrderWindowOpen(sessions[0].served_at)) {
        await conn.rollback();
        return res.status(409).json({ error: 'Orders are available from 10:00 AM until 9:45 PM, and only within 45 minutes of seating.' });
      }
      table_id = sessions[0].table_id;
    }

    let total = 0;
    const validItems = [];

    for (const item of items) {
      const [menuRows] = await conn.query(
        `SELECT item_id, name, price, is_available FROM menu_items WHERE item_id = ? FOR UPDATE`,
        [item.item_id]
      );

      if (menuRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: `Menu item with ID ${item.item_id} does not exist.` });
      }

      const menuItem = menuRows[0];
      if (menuItem.is_available !== 1) {
        await conn.rollback();
        return res.status(409).json({ error: `Menu item "${menuItem.name}" is not available.` });
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: `Invalid quantity for item "${menuItem.name}".` });
      }

      const unitPrice = Number(menuItem.price);
      total += unitPrice * quantity;
      validItems.push({ 
        item_id: menuItem.item_id, 
        quantity: quantity, 
        unit_price: unitPrice,
      });
    }

    const [result] = await conn.query(
      `INSERT INTO orders (user_id, booking_id, queue_id, table_id, status, total_amount, payment_status)
       VALUES (?, ?, ?, ?, 'pending', ?, 'unpaid')`,
      [user_id, booking_id || null, queue_id || null, table_id, total]
    );
    
    const order_id = result.insertId;
    for (const item of validItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
        [order_id, item.item_id, item.quantity, item.unit_price]
      );
    }
    await conn.commit();

    const io = req.app.get('io');
    if (io) {
      const {emitOrderUpdate} = require('../socket');
      emitOrderUpdate(io, {type: 'new_order', orderId: order_id, userId: user_id});
    }
    
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
    if (Number(orders[0].user_id) !== Number(req.user.user_id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
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
  if (Number(user_id) !== Number(req.user.user_id)) {
    return res.status(404).json({ error: 'Orders not found.' });
  }
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
             AND customer_booking.booking_id = o.booking_id
             AND customer_booking.status IN ('serving', 'finished')
         ))
       ORDER BY COALESCE(o.table_id, b.table_id), o.order_time DESC`,
      [user_id, user_id]
    );
    const orders = new Map(rows.map(order => [order.order_id, { ...order, items: [] }]));
    if (orders.size > 0) {
      const orderIds = [...orders.keys()];
      const placeholders = orderIds.map(() => '?').join(', ');
      const [items] = await db.query(
        `SELECT oi.order_id, oi.order_item_id, oi.quantity, oi.unit_price, oi.subtotal, m.name
         FROM order_items oi
         JOIN menu_items m ON m.item_id = oi.item_id
         WHERE oi.order_id IN (${placeholders})
         ORDER BY oi.order_item_id`,
        orderIds
      );
      for (const item of items) {
        orders.get(item.order_id)?.items.push(item);
      }
    }
    return res.json([...orders.values()]);
  } catch (err) {
    console.error('listByUser order error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/orders/history/:user_id — full payment history for a customer
async function listHistoryByUser(req, res) {
  const { user_id } = req.params;
  if (Number(user_id) !== Number(req.user.user_id)) {
    return res.status(404).json({ error: 'Order history not found.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, o.booking_id, o.queue_id, o.order_time, o.updated_at,
              o.total_amount, o.payment_status,
              COALESCE(o.table_id, b.table_id, q.table_id) AS table_id,
              COALESCE(b.party_size, q.party_size) AS party_size
       FROM orders o
       LEFT JOIN bookings b ON b.booking_id = o.booking_id
       LEFT JOIN queue_entries q ON q.queue_id = o.queue_id
       WHERE o.user_id = ? 
       ORDER BY o.order_time DESC, o.order_id DESC`,
      [user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listHistoryByUser orders error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

// GET /api/orders/history/:user_id/review-dishes?order_ids=1,2
async function listPaidReviewDishes(req, res) {
  const { user_id } = req.params;
  const orderIdsParam = req.query.order_ids;
  if (Number(user_id) !== Number(req.user.user_id)) {
    return res.status(404).json({ error: 'Order history not found.' });
  }
  if (typeof orderIdsParam !== 'string' || !orderIdsParam || !/^\d+(,\d+)*$/.test(orderIdsParam)) {
    return res.status(400).json({ error: 'Provide valid order IDs for this paid bill.' });
  }

  const orderIds = [...new Set(orderIdsParam.split(',').map(Number))];
  if (orderIds.some(id => !Number.isSafeInteger(id) || id <= 0) || orderIds.length > 100) {
    return res.status(400).json({ error: 'Provide between 1 and 100 valid order IDs.' });
  }

  try {
    const placeholders = orderIds.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT DISTINCT m.item_id, m.name, m.description, m.category, m.image_url,
              COALESCE(ratings.average_rating, 0) AS average_rating,
              COALESCE(ratings.review_count, 0) AS review_count,
              mine.rating AS my_rating, mine.comment AS my_comment
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       JOIN menu_items m ON m.item_id = oi.item_id
       LEFT JOIN (
         SELECT item_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
         FROM dish_reviews
         GROUP BY item_id
       ) ratings ON ratings.item_id = m.item_id
       LEFT JOIN dish_reviews mine
         ON mine.item_id = m.item_id AND mine.user_id = o.user_id
       WHERE o.user_id = ? AND o.payment_status = 'paid'
         AND o.order_id IN (${placeholders})
       ORDER BY m.category, m.name, m.item_id`,
      [user_id, ...orderIds]
    );
    if (rows.length) {
      const placeholders = rows.map(() => '?').join(', ');
      const itemIds = rows.map(row => row.item_id);
      const [reviews] = await db.query(
        `SELECT r.review_id, r.item_id, r.rating, r.comment, r.updated_at,
                u.name AS reviewer_name
         FROM dish_reviews r
         JOIN users u ON u.user_id = r.user_id
         WHERE r.item_id IN (${placeholders})
         ORDER BY r.updated_at DESC, r.review_id DESC`,
        itemIds
      );
      const reviewsByItem = new Map();
      reviews.forEach(review => {
        if (!reviewsByItem.has(review.item_id)) reviewsByItem.set(review.item_id, []);
        reviewsByItem.get(review.item_id).push(review);
      });
      rows.forEach(row => { row.reviews = reviewsByItem.get(row.item_id) || []; });
    }
    return res.json(rows);
  } catch (err) {
    console.error('listPaidReviewDishes orders error:', err);
    return res.status(500).json({ error: 'Could not load dishes from this paid bill. Please try again.' });
  }
}

// PATCH /api/orders/:id/status — advance kitchen status (manager)
async function advanceStatus(req, res) {
  const { id } = req.params;
  const NEXT = { pending: 'preparing', preparing: 'ready' };
  try {
    const [rows] = await db.query('SELECT status, user_id FROM orders WHERE order_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
    const next = NEXT[rows[0].status];
    if (!next) return res.status(400).json({ error: 'Cannot advance from this status.' });
    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [next, id]);

    const io = req.app.get('io');
    if (io) {
      const {emitOrderUpdate} = require('../socket');
      emitOrderUpdate(io, {type: 'status_changed', orderId: id, status: next, userId: rows[0].user_id});
    }

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
    const [orderRows] = await db.query(
      'SELECT user_id FROM orders WHERE order_id = ?', [id]
    );
    const [result] = await db.query(
      `UPDATE orders SET payment_status = 'pending_payment'
       WHERE order_id = ? AND user_id = ? AND status = 'ready'`,
      [id, req.user.user_id]
    );
    if (!result.affectedRows) return res.status(400).json({ error: 'Order not ready or already processed.' });

    const io = req.app.get('io');
    if (io) {
      const {emitOrderUpdate} = require('../socket');
      emitOrderUpdate(io, {type: 'payment_requested', orderId: id, userId: orderRows[0]?.user_id});
    }
    
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
    const [rows] = await db.query(
      'SELECT user_id FROM orders WHERE order_id = ?', [id]
    );
    const [result] = await db.query(
      `UPDATE orders SET status = 'completed', payment_status = 'paid' WHERE order_id = ?`,
      [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Order not found.' });

    const io = req.app.get('io');
    if (io) {
      const {emitOrderUpdate} = require('../socket');
      emitOrderUpdate(io, {type: 'order_paid', orderId: id, userId: rows[0]?.user_id});
    }
    
    return res.json({ message: 'Order marked as paid.' });
  } catch (err) {
    console.error('markPaid error:', err);
    return res.status(500).json({ error: 'Please try again later.' });
  }
}

module.exports = {
  listAll, listManagerHistory, create, getOne, listByUser, listHistoryByUser,
  listPaidReviewDishes, advanceStatus, finishOrder, markPaid,
};