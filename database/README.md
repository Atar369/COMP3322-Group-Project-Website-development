# COMP3322 restaurant database

MySQL 8.0.16+ schema for one fictional restaurant. It contains seven tables and sample data. It does not implement customer preference analysis or the web frontend.

## Run the SQL

Run these files in order against a MySQL account allowed to create a database:

```sh
mysql -u YOUR_USER -p < database/schema.sql
mysql -u YOUR_USER -p < database/seed.sql
mysql -u YOUR_USER -p < database/queries.sql
```

`schema.sql` creates `comp3322_restaurant`; `seed.sql` assumes its tables are empty and is intended to run once. The four sample `password_hash` values are clearly marked **dummy placeholders** and cannot be used to log in. Before testing authentication, replace them with hashes made by the backend's password library. Never store or log plaintext passwords.

The sample orders use the date on which the seed runs so the “today” queries show results. Prices are example amounts in one currency chosen by the group; the schema does not store a currency code.

## Tables and keys

| Table | Primary key | Purpose and foreign keys |
| --- | --- | --- |
| `users` | `user_id` | Customer and manager accounts; `role` accepts only `customer` or `manager`. |
| `menu_items` | `item_id` | Menu details, current price, and availability. |
| `orders` | `order_id` | Order header, owner, status, and total; `user_id` → `users.user_id`. |
| `order_items` | `order_item_id` | One dish and quantity per row; `order_id` → `orders.order_id`, `item_id` → `menu_items.item_id`. |
| `restaurant_tables` | `table_id` | Physical tables, capacity, and general availability. |
| `bookings` | `booking_id` | A customer's reservation of a table at a date/time; `user_id` → `users.user_id`, `table_id` → `restaurant_tables.table_id`. |
| `queue_entries` | `queue_id` | Queue history; `user_id` → `users.user_id`. |

All foreign keys use `ON DELETE RESTRICT ON UPDATE RESTRICT`. This protects historical orders and their item records from accidental parent deletion. Mark menu items unavailable and change statuses instead of deleting records that may be referenced. Manager accounts are stored in `users`; `role` does not by itself authorize an API request, so the backend must enforce manager permissions.

## Relationships

```text
users (1) ────────< (many) orders (1) ────────< (many) order_items
  │                                                        >──────── (1) menu_items
  ├───────────────< (many) bookings >──────────────────── (1) restaurant_tables
  └───────────────< (many) queue_entries
```

`orders` stores one order's overall state. `order_items` stores its dishes, so an order can contain several dishes without `dish1`, `dish2`, etc. columns. Each line stores `unit_price` at ordering time; later menu price changes do not alter historical amounts. `subtotal` is a generated column calculated from quantity and unit price. The unique key on `(order_id, item_id)` keeps one row per dish in an order; increase `quantity` for repeats.

## Constraints and indexes

- Unique: `users.email`, `users.phone`, `restaurant_tables.table_number`, `(order_id, item_id)` in `order_items`, and the active booking key described below.
- Checks: role/status values, nonnegative prices and totals, and positive quantities, party sizes, table numbers, and capacities. MySQL enforces `CHECK` constraints from version 8.0.16 onward.
- Indexes: available menu by category; customer orders by time; orders by time and status; order items by dish; bookings by date/time and customer/date; queue entries by status/join time and customer/join time. Primary and unique keys also create indexes.

### Booking conflicts

`bookings` has a generated `active_slot` equal to `1` for `confirmed` bookings and `NULL` otherwise. Its unique key on `(table_id, booking_date, booking_time, active_slot)` prevents two confirmed bookings for the same table and exact date/time, including concurrent inserts. Multiple cancelled, completed, or no-show records can retain the same old slot because MySQL unique indexes permit multiple `NULL` values. Query 10 checks whether the requested exact slot is currently confirmed. A failed insert or status change due to this key should be returned by the backend as a booking conflict.

This design assumes a booking occupies one discrete start time. It **does not detect overlapping booking durations** such as 18:00 and 18:30, because no end time or slot length is stored. The group should choose fixed reservation slots or add an end time and perform overlap checks in a transaction if variable durations are required. The backend must also ensure `party_size` does not exceed the chosen table's capacity and decide whether `restaurant_tables.status = 'unavailable'` blocks new bookings; those checks compare different tables and are not enforced by the current `CHECK` constraints.

### Queue order

Queue position changes whenever someone joins, is called, or cancels, so it is derived rather than stored. Query 9 filters `status = 'waiting'` and orders by `joined_at ASC, queue_id ASC`; the ID makes equal timestamps deterministic. `ROW_NUMBER()` displays the current position. Called and seated entries remain as history but are excluded from the waiting list.

## Table availability and queue logic

`restaurant_tables` stores the 11 physical tables, including each table's capacity and general status. The status shows whether the physical table is normally usable, such as whether it is temporarily unavailable for maintenance. A booking does not change this status, and the frontend controls table positions without database coordinate fields.

Confirmed rows in `bookings` determine whether a table is booked for a selected date and time. Query 13 combines this with physical status and capacity to calculate `capacity_match`, `slot_booked`, and `bookable`. The backend should provide the selected date, time, and party size as parameters; the values at the start of `queries.sql` are runnable examples only.

Current waiting-group counts are calculated from `queue_entries` using only rows whose status is `waiting`. Query 14 groups the waiting rows by party size, while query 15 combines queue counts with table availability and returns zero where a table capacity has no waiting group. Frontend visual states such as yellow or grey are derived from these query results and are not stored in the database.

## Backend and dashboard use

Use parameterized SQL for customer/order/table IDs and dates; the `@...` variables in `queries.sql` only provide runnable examples. Create an order header and its lines in one database transaction. Copy each item's current price into `order_items.unit_price`, calculate line subtotals, and set `orders.total_amount` to their sum before committing. The database guarantees each line's subtotal, but it does not compare the header total with the sum across rows. Reject unavailable menu items in the backend at order placement time. Store all application datetimes using one agreed restaurant timezone, because “today” uses the MySQL session's calendar date.

Queries 4–8 calculate revenue, item sales, hourly volume, and peak hours directly from orders and order items. Revenue and sales use paid, non-cancelled orders; order volume counts non-cancelled orders regardless of payment. The group should agree on these definitions, especially whether paid orders still preparing count as revenue, and keep payment status in sync with actual payments and refunds. No summary tables or customer preference tables are needed for this project.
