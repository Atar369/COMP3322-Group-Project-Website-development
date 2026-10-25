-- Run once after schema.sql on an empty database. All names and contacts are fictional.
-- USE comp3322_restaurant;

-- All demo accounts use password: "password"
-- Hash is a bcrypt hash for the demo password "password".
INSERT INTO users (name, email, phone, password_hash, role) VALUES
  ('Alice Example', 'alice@example.com', '+85200000000', '$2b$10$5TaKfIAKzG3AH5fv2NxJEee27ox7UndoPCb6IIE1fVwBAiLc9TqaC', 'customer'),
  ('Alex Example', 'alex@example.com', '+85200000001', '$2b$10$5TaKfIAKzG3AH5fv2NxJEee27ox7UndoPCb6IIE1fVwBAiLc9TqaC', 'customer'),
  ('Blair Example', 'blair@example.com', '+85200000002', '$2b$10$5TaKfIAKzG3AH5fv2NxJEee27ox7UndoPCb6IIE1fVwBAiLc9TqaC', 'customer'),
  ('Casey Example', 'casey@example.com', '+85200000003', '$2b$10$5TaKfIAKzG3AH5fv2NxJEee27ox7UndoPCb6IIE1fVwBAiLc9TqaC', 'customer'),
  ('Morgan Manager', 'manager@example.com', '+85200000004', '$2b$10$5TaKfIAKzG3AH5fv2NxJEee27ox7UndoPCb6IIE1fVwBAiLc9TqaC', 'manager');

INSERT INTO menu_items (name, description, category, price, image_url, is_available) VALUES
  ('Grilled Octopus', 'Charred octopus with roasted peppers, herbs, and a bright citrus finish.', 'Starter', 168.00, '/menu-images/grilled-octopus-starter.png', TRUE),
  ('Grilled Wagyu Striploin', 'Grilled wagyu striploin served with seasonal vegetables and a rich pan jus.', 'Main', 328.00, '/menu-images/grilled-wagyu-striploin-main.png', TRUE),
  ('Oak & Negroni', 'A spirit-forward classic with gin, bitters, and oak-aged vermouth.', 'Beverage', 128.00, '/menu-images/oak-n-negroni-beverage.png', TRUE),
  ('Saffron Risotto', 'Creamy saffron risotto finished with parmesan and fresh herbs.', 'Main', 188.00, '/menu-images/saffron-risotto-main.png', TRUE),
  ('Seafood Medley with Lemon Beurre Blanc', 'A grilled seafood medley paired with a silky lemon beurre blanc.', 'Main', 268.00, '/menu-images/seafood-medley-lemon-beurre-blanc-main.png', TRUE),
  ('Seasonal Cheesecake', 'Rich, seasonal cheesecake with a golden top and a buttery biscuit base.', 'Dessert', 88.00, '/menu-images/seasonal-cheesecake-dessert.png', TRUE),
  ('Sparkling Rosemary Lemonade', 'House-made sparkling lemonade infused with rosemary and fresh lemon.', 'Beverage', 68.00, '/menu-images/sparkling-rosemary-lemonade-beverage.png', TRUE);

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
INSERT INTO orders (user_id, booking_id, queue_id, order_time, status, total_amount, payment_status) VALUES
  (1, 5, NULL, TIMESTAMP(CURDATE(), '10:15:00'), 'completed', 80.00, 'paid'),
  (2, NULL, 4,  TIMESTAMP(CURDATE(), '10:45:00'), 'completed', 110.00, 'paid'),
  (3, NULL, NULL, TIMESTAMP(CURDATE(), '12:05:00'), 'completed', 46.00, 'paid'),
  (1, 7, NULL, TIMESTAMP(CURDATE(), '13:30:00'), 'pending', 38.00, 'unpaid'),
  (2, NULL, NULL, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '19:20:00'), 'completed', 102.00, 'paid'),
  (3, NULL, NULL, TIMESTAMP(CURDATE(), '11:30:00'), 'cancelled', 55.00, 'refunded'),
  (1, 7, NULL, CURRENT_TIMESTAMP, 'preparing', 42.00, 'unpaid');

INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
  (1, 1, 1, 38.00), (1, 2, 1, 42.00),
  (2, 3, 2, 55.00),
  (3, 4, 1, 28.00), (3, 5, 1, 18.00),
  (4, 1, 1, 38.00),
  (5, 2, 2, 42.00), (5, 5, 1, 18.00),
  (6, 3, 1, 55.00),
  (7, 2, 1, 42.00);

INSERT INTO bookings (user_id, table_id, booking_date, booking_time, party_size, status, special_request, served_at) VALUES
  (1, 3, CURDATE() + INTERVAL 1 DAY, '18:00:00', 4, 'booked', 'Window seat if possible', NULL),
  (2, 1, CURDATE() + INTERVAL 1 DAY, '19:30:00', 2, 'booked', NULL, NULL),
  (3, 5, CURDATE() + INTERVAL 2 DAY, '20:00:00', 4, 'booked', 'Birthday dinner', NULL),
  (2, 6, CURDATE() + INTERVAL 3 DAY, '18:30:00', 7, 'cancelled', NULL, NULL),
  (1, 4, CURDATE() - INTERVAL 1 DAY, '12:30:00', 2, 'finished', NULL, NULL),
  (3, 7, CURDATE() - INTERVAL 2 DAY, '19:00:00', 5, 'no_show', NULL, NULL),
  (1, 2, CURDATE(), '18:00:00', 2, 'serving', 'Demo seated customer', CURRENT_TIMESTAMP - INTERVAL 5 MINUTE);

INSERT INTO queue_entries (user_id, party_size, queue_number, queue_date, joined_at, status, called_at, served_at) VALUES
  (1, 2, 'A001', CURDATE(), CURRENT_TIMESTAMP - INTERVAL 14 MINUTE, 'queued', NULL, NULL),
  (2, 4, 'B001', CURDATE(), CURRENT_TIMESTAMP - INTERVAL 7 MINUTE, 'queued', NULL, NULL),
  (3, 3, 'B002', CURDATE(), CURRENT_TIMESTAMP - INTERVAL 20 MINUTE, 'called', CURRENT_TIMESTAMP - INTERVAL 2 MINUTE, NULL),
  (2, 2, 'A002', CURDATE(), CURRENT_TIMESTAMP - INTERVAL 70 MINUTE, 'serving', CURRENT_TIMESTAMP - INTERVAL 45 MINUTE, CURRENT_TIMESTAMP - INTERVAL 40 MINUTE),
  (1, 5, 'C001', CURDATE(), CURRENT_TIMESTAMP - INTERVAL 50 MINUTE, 'cancelled', NULL, NULL);
