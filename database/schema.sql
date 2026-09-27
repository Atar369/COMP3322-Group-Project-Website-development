-- MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16).
CREATE DATABASE IF NOT EXISTS comp3322_restaurant
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE comp3322_restaurant;

CREATE TABLE users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(8) NOT NULL DEFAULT 'customer',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  CONSTRAINT chk_users_role CHECK (role IN ('customer', 'manager'))
) ENGINE=InnoDB;

CREATE TABLE menu_items (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  category VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY idx_menu_available_category (is_available, category),
  CONSTRAINT chk_menu_price CHECK (price >= 0),
  CONSTRAINT chk_menu_available CHECK (is_available IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE orders (
  order_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  order_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(8) NOT NULL DEFAULT 'unpaid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_orders_user_time (user_id, order_time),
  KEY idx_orders_time (order_time),
  KEY idx_orders_status_time (status, order_time),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_payment CHECK (payment_status IN ('unpaid', 'paid', 'refunded'))
) ENGINE=InnoDB;

CREATE TABLE order_items (
  order_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  PRIMARY KEY (order_item_id),
  UNIQUE KEY uq_order_items_order_item (order_id, item_id),
  KEY idx_order_items_item (item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (order_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (item_id) REFERENCES menu_items (item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE restaurant_tables (
  table_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  table_number INT UNSIGNED NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  status VARCHAR(11) NOT NULL DEFAULT 'available',
  PRIMARY KEY (table_id),
  UNIQUE KEY uq_tables_number (table_number),
  CONSTRAINT chk_tables_number CHECK (table_number > 0),
  CONSTRAINT chk_tables_capacity CHECK (capacity > 0),
  CONSTRAINT chk_tables_status CHECK (status IN ('available', 'unavailable'))
) ENGINE=InnoDB;

CREATE TABLE bookings (
  booking_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  table_id INT UNSIGNED NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  party_size INT UNSIGNED NOT NULL,
  status VARCHAR(9) NOT NULL DEFAULT 'confirmed',
  special_request TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- NULL for closed bookings: MySQL UNIQUE keys allow multiple NULL values.
  active_slot TINYINT GENERATED ALWAYS AS
    (CASE WHEN status = 'confirmed' THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY (booking_id),
  UNIQUE KEY uq_bookings_active_slot (table_id, booking_date, booking_time, active_slot),
  KEY idx_bookings_date_time (booking_date, booking_time),
  KEY idx_bookings_user_date (user_id, booking_date),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (table_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_bookings_party CHECK (party_size > 0),
  CONSTRAINT chk_bookings_status CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show'))
) ENGINE=InnoDB;

CREATE TABLE queue_entries (
  queue_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  party_size INT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(9) NOT NULL DEFAULT 'waiting',
  called_at DATETIME NULL,
  seated_at DATETIME NULL,
  PRIMARY KEY (queue_id),
  KEY idx_queue_status_joined (status, joined_at, queue_id),
  KEY idx_queue_user_joined (user_id, joined_at),
  CONSTRAINT fk_queue_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_queue_party CHECK (party_size > 0),
  CONSTRAINT chk_queue_status CHECK (status IN ('waiting', 'called', 'seated', 'cancelled'))
) ENGINE=InnoDB;
