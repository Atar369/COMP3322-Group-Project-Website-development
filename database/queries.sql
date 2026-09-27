USE comp3322_restaurant;

-- Example inputs for queries 2, 3, and 10. Replace with backend parameters.
SET @customer_id = 1;
SET @order_id = 1;
SET @table_id = 3;
SET @booking_date = CURDATE() + INTERVAL 1 DAY;
SET @booking_time = '18:00:00';
-- Runnable availability examples only; the backend should supply these parameters.
SET @selected_date = CURDATE();
SET @selected_time = '19:00:00';
SET @party_size = 4;

-- 1. Available menu items.
SELECT item_id, name, description, category, price, image_url
FROM menu_items
WHERE is_available = TRUE
ORDER BY category, name;

-- 2. Orders belonging to one customer, newest first.
SELECT order_id, order_time, status, total_amount, payment_status
FROM orders
WHERE user_id = @customer_id
ORDER BY order_time DESC, order_id DESC;

-- 3. Items in one order. Stored unit_price preserves the sale price.
SELECT oi.order_item_id, mi.name, oi.quantity, oi.unit_price, oi.subtotal
FROM order_items AS oi
JOIN menu_items AS mi ON mi.item_id = oi.item_id
WHERE oi.order_id = @order_id
ORDER BY oi.order_item_id;

-- 4. Today's revenue: paid orders placed today, excluding cancellations.
SELECT COALESCE(SUM(total_amount), 0.00) AS todays_revenue
FROM orders
WHERE order_time >= CURDATE()
  AND order_time < CURDATE() + INTERVAL 1 DAY
  AND payment_status = 'paid'
  AND status <> 'cancelled';

-- 5. Quantity sold for every dish today, including dishes with zero sales.
SELECT mi.item_id, mi.name,
       COALESCE(SUM(CASE WHEN o.payment_status = 'paid' AND o.status <> 'cancelled'
                         THEN oi.quantity ELSE 0 END), 0) AS quantity_sold
FROM menu_items AS mi
LEFT JOIN order_items AS oi ON oi.item_id = mi.item_id
LEFT JOIN orders AS o ON o.order_id = oi.order_id
  AND o.order_time >= CURDATE()
  AND o.order_time < CURDATE() + INTERVAL 1 DAY
GROUP BY mi.item_id, mi.name
ORDER BY mi.item_id;

-- 6. Best-selling dishes across all dates (top five by paid quantity).
SELECT mi.item_id, mi.name, SUM(oi.quantity) AS quantity_sold
FROM order_items AS oi
JOIN orders AS o ON o.order_id = oi.order_id
JOIN menu_items AS mi ON mi.item_id = oi.item_id
WHERE o.payment_status = 'paid' AND o.status <> 'cancelled'
GROUP BY mi.item_id, mi.name
ORDER BY quantity_sold DESC, mi.item_id
LIMIT 5;

-- 7. Today's non-cancelled order volume by hour (hours with orders only).
SELECT HOUR(order_time) AS order_hour, COUNT(*) AS order_count
FROM orders
WHERE order_time >= CURDATE()
  AND order_time < CURDATE() + INTERVAL 1 DAY
  AND status <> 'cancelled'
GROUP BY HOUR(order_time)
ORDER BY order_hour;

-- 8. Today's peak ordering hour(s), including ties.
WITH hourly_counts AS (
  SELECT HOUR(order_time) AS order_hour, COUNT(*) AS order_count
  FROM orders
  WHERE order_time >= CURDATE()
    AND order_time < CURDATE() + INTERVAL 1 DAY
    AND status <> 'cancelled'
  GROUP BY HOUR(order_time)
), ranked_hours AS (
  SELECT order_hour, order_count,
         DENSE_RANK() OVER (ORDER BY order_count DESC) AS volume_rank
  FROM hourly_counts
)
SELECT order_hour, order_count
FROM ranked_hours
WHERE volume_rank = 1
ORDER BY order_hour;

-- 9. Currently waiting customers, oldest first. queue_id breaks timestamp ties.
SELECT ROW_NUMBER() OVER (ORDER BY qe.joined_at, qe.queue_id) AS queue_position,
       qe.queue_id, u.name, qe.party_size, qe.joined_at
FROM queue_entries AS qe
JOIN users AS u ON u.user_id = qe.user_id
WHERE qe.status = 'waiting'
ORDER BY qe.joined_at, qe.queue_id;

-- 10. Check one table and exact date/time for a confirmed booking.
SELECT EXISTS (
  SELECT 1
  FROM bookings
  WHERE table_id = @table_id
    AND booking_date = @booking_date
    AND booking_time = @booking_time
    AND status = 'confirmed'
) AS is_booked;

-- 11. Today's bookings.
SELECT b.booking_id, b.booking_time, rt.table_number, u.name AS customer_name,
       b.party_size, b.status, b.special_request
FROM bookings AS b
JOIN restaurant_tables AS rt ON rt.table_id = b.table_id
JOIN users AS u ON u.user_id = b.user_id
WHERE b.booking_date = CURDATE()
ORDER BY b.booking_time, rt.table_number;

-- 12. Orders still in progress.
SELECT o.order_id, o.order_time, u.name AS customer_name,
       o.status, o.payment_status, o.total_amount
FROM orders AS o
JOIN users AS u ON u.user_id = o.user_id
WHERE o.status IN ('pending', 'preparing', 'ready')
ORDER BY o.order_time, o.order_id;

-- 13. Floor-plan availability for a selected date, time, and party size.
-- Boolean expressions return 1 for true and 0 for false in MySQL.
SELECT rt.table_id,
       rt.table_number,
       rt.capacity,
       rt.status AS table_status,
       (rt.capacity >= @party_size) AS capacity_match,
       (b.booking_id IS NOT NULL) AS slot_booked,
       (rt.status = 'available'
        AND rt.capacity >= @party_size
        AND b.booking_id IS NULL) AS bookable
FROM restaurant_tables AS rt
LEFT JOIN bookings AS b
  ON b.table_id = rt.table_id
 AND b.booking_date = @selected_date
 AND b.booking_time = @selected_time
 AND b.status = 'confirmed'
ORDER BY rt.table_number;

-- 14. Current waiting-group counts by party size.
SELECT party_size, COUNT(*) AS groups_waiting
FROM queue_entries
WHERE status = 'waiting'
GROUP BY party_size
ORDER BY party_size;

-- 15. Combined floor-plan availability and waiting groups for each table capacity.
WITH waiting_counts AS (
  SELECT party_size, COUNT(*) AS groups_waiting
  FROM queue_entries
  WHERE status = 'waiting'
  GROUP BY party_size
)
SELECT rt.table_id,
       rt.table_number,
       rt.capacity,
       rt.status AS table_status,
       (rt.capacity >= @party_size) AS capacity_match,
       (b.booking_id IS NOT NULL) AS slot_booked,
       (rt.status = 'available'
        AND rt.capacity >= @party_size
        AND b.booking_id IS NULL) AS bookable,
       COALESCE(wc.groups_waiting, 0) AS groups_waiting_for_this_capacity
FROM restaurant_tables AS rt
LEFT JOIN bookings AS b
  ON b.table_id = rt.table_id
 AND b.booking_date = @selected_date
 AND b.booking_time = @selected_time
 AND b.status = 'confirmed'
LEFT JOIN waiting_counts AS wc ON wc.party_size = rt.capacity
ORDER BY rt.table_number;
