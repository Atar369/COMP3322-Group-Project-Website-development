-- Run once after schema.sql on an empty database. All names and contacts are fictional.
-- USE comp3322_restaurant;

INSERT INTO users (name, email, phone, password_hash, role) VALUES
  ('Alice Example', 'alice@example.com', '+85200000000', '$2b$10$FPquNaucIf/JMDb4LEIepO7f5fer7HFVw/CqgErpuj.kWPjkcp5iK', 'customer'),
  ('Alex Example', 'alex@example.com', '+85200000001', '$2b$10$7.5cRx6Vepdqq79RqOtrZuqUDYnA8JXUcYX2euIGHa0WmB1MQu7Tu', 'customer'),
  ('Blair Example', 'blair@example.com', '+85200000002', '$2b$10$mOwPsCRYNNXs6iDPJklfXeV5iMOCeqLjiOzN4UVeW.Uj5nfJtPVTa', 'customer'),
  ('Casey Example', 'casey@example.com', '+85200000003', '$2b$10$PwMwO8Ciz9Wr7Xk1cSE2ru.FsntjiMqs0b4KWhUs2i77T8lBs9eyG', 'customer'),
  ('Morgan Manager', 'manager@example.com', '+85200000004', '$2b$10$XRVNDT3h/h.O477fdxoNHOnLC6ADQ3NxmSR2EzbTVLQFoaNqjZ06i', 'manager');

INSERT INTO menu_items (name, description, category, price, is_available) VALUES
  ('Dish 1', 'Sample rice dish', 'Main', 38.00, TRUE),
  ('Dish 2', 'Sample noodle dish', 'Main', 42.00, TRUE),
  ('Dish 3', 'Sample seafood dish', 'Main', 55.00, TRUE),
  ('Dish 4', 'Sample side dish', 'Side', 28.00, TRUE),
  ('Dish 5', 'Sample dessert', 'Dessert', 18.00, FALSE);

INSERT INTO restaurant_tables (table_number, capacity, status) VALUES
  (1, 4, 'available'),
  (2, 4, 'available'),
  (3, 6, 'available'),
  (4, 2, 'available'),
  (5, 4, 'available'),
  (6, 8, 'available'),
  (7, 6, 'available'),
  (8, 4, 'available'),
  (9, 4, 'available'),
  (10, 2, 'available'),
  (11, 8, 'available');

-- IDs below assume the empty database created by schema.sql.
-- Historical orders may include an item that is now unavailable.
INSERT INTO orders (user_id, order_time, status, total_amount, payment_status) VALUES
  (1, TIMESTAMP(CURDATE(), '10:15:00'), 'completed', 80.00, 'paid'),
  (2, TIMESTAMP(CURDATE(), '10:45:00'), 'preparing', 110.00, 'paid'),
  (3, TIMESTAMP(CURDATE(), '12:05:00'), 'ready', 46.00, 'paid'),
  (1, TIMESTAMP(CURDATE(), '13:30:00'), 'pending', 38.00, 'unpaid'),
  (2, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '19:20:00'), 'completed', 102.00, 'paid'),
  (3, TIMESTAMP(CURDATE(), '11:30:00'), 'cancelled', 55.00, 'refunded');

INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
  (1, 1, 1, 38.00), (1, 2, 1, 42.00),
  (2, 3, 2, 55.00),
  (3, 4, 1, 28.00), (3, 5, 1, 18.00),
  (4, 1, 1, 38.00),
  (5, 2, 2, 42.00), (5, 5, 1, 18.00),
  (6, 3, 1, 55.00);

INSERT INTO bookings (user_id, table_id, booking_date, booking_time, party_size, status, special_request) VALUES
  (1, 3, CURDATE() + INTERVAL 1 DAY, '18:00:00', 4, 'confirmed', 'Window seat if possible'),
  (2, 1, CURDATE() + INTERVAL 1 DAY, '19:30:00', 2, 'confirmed', NULL),
  (3, 5, CURDATE() + INTERVAL 2 DAY, '20:00:00', 4, 'confirmed', 'Birthday dinner'),
  (2, 6, CURDATE() + INTERVAL 3 DAY, '18:30:00', 7, 'cancelled', NULL),
  (1, 4, CURDATE() - INTERVAL 1 DAY, '12:30:00', 2, 'completed', NULL),
  (3, 7, CURDATE() - INTERVAL 2 DAY, '19:00:00', 5, 'no_show', NULL);

INSERT INTO queue_entries (user_id, party_size, joined_at, status, called_at, seated_at) VALUES
  (1, 2, CURRENT_TIMESTAMP - INTERVAL 14 MINUTE, 'waiting', NULL, NULL),
  (2, 4, CURRENT_TIMESTAMP - INTERVAL 7 MINUTE, 'waiting', NULL, NULL),
  (3, 3, CURRENT_TIMESTAMP - INTERVAL 20 MINUTE, 'called', CURRENT_TIMESTAMP - INTERVAL 2 MINUTE, NULL),
  (2, 2, CURRENT_TIMESTAMP - INTERVAL 70 MINUTE, 'seated', CURRENT_TIMESTAMP - INTERVAL 45 MINUTE, CURRENT_TIMESTAMP - INTERVAL 40 MINUTE),
  (1, 5, CURRENT_TIMESTAMP - INTERVAL 50 MINUTE, 'cancelled', NULL, NULL);
