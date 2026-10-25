# Multi-Order Table-Based System Refactor

## Overview
Implement a system where customers can place multiple orders during a single table session, with each order tracked individually but accumulated for one final combined bill.

## Key Decisions

### Order ID Format
- **Format:** `tableid-YYYYMMDDHHMMSS`
- **Example:** `5-20261024143045` (Table 5, 14:30:45 on Oct 24, 2026)
- **Property:** Unique per order, includes table reference and timestamp

### Multiple Orders Strategy
- Each order gets a separate, unique ID
- Display as: "Order 1 of N", "Order 2 of N", etc.
- All orders grouped by table_id
- Single combined bill per payment session

### Price Accumulation
- Sum all orders for table_id until payment
- Reset total after payment
- Always display total in Order Management page

---

## Implementation Phases

### Phase 1: Database Schema (CRITICAL)
- [ ] Add `table_id` column to `orders` table
- [ ] Add `table_id` column to `queue_entries` table
- [ ] Create index on `orders(table_id, payment_status)`

### Phase 2: Backend API Changes
- [ ] Update order creation to generate `tableid-YYYYMMDDHHMMSS` format
- [ ] Implement table assignment on booking confirmation
- [ ] Implement table assignment when queue called
- [ ] Add endpoint: GET `/api/orders/table/:tableId/active` (get all unpaid orders for table)
- [ ] Add endpoint: GET `/api/orders/table/:tableId/total` (get accumulated total)
- [ ] Update order creation to check if table has active session

### Phase 3: Frontend - Terminology
- [ ] Rename all "Reservation/Reserve" → "Booking/Book/Booked"
- [ ] Rename "Orders & Cart" → "Order Management"
- [ ] Update page titles and links

### Phase 4: Frontend - Order Management Page
- [ ] Show each order with format: "Order N of M"
- [ ] Display order ID as: `tableid-YYYYMMDDHHMMSS -- Table N`
- [ ] Show individual order prices
- [ ] **Show accumulated table total prominently**
- [ ] After order placed → clear cart, show fresh menu

### Phase 5: Frontend - Cart & Menu State
- [ ] Clear cart after order placed
- [ ] Reset menu item selections between orders
- [ ] Show "Place another order?" option

### Phase 6: Backend - Table Assignment
- [ ] When booking reaches "serving" status → assign available table matching party size
- [ ] When queue called → assign available table matching party size
- [ ] Table assignment logic: status='available' AND capacity >= party_size

### Phase 7: Order History & Reports
- [ ] Update Order History display: `orderId -- tableId`
- [ ] Group orders by table session in manager view
- [ ] Show combined totals per table session

---

## Database Schema Changes

### New `orders` table structure
```sql
ALTER TABLE orders ADD COLUMN table_id INT UNSIGNED NULL AFTER queue_id;
ALTER TABLE orders ADD FOREIGN KEY (table_id) REFERENCES restaurant_tables(table_id);
ALTER TABLE orders ADD INDEX idx_orders_table_payment (table_id, payment_status);
```

### New `queue_entries` table structure
```sql
ALTER TABLE queue_entries ADD COLUMN table_id INT UNSIGNED NULL AFTER status;
ALTER TABLE queue_entries ADD FOREIGN KEY (table_id) REFERENCES restaurant_tables(table_id);
```

---

## Files to Modify

### Backend
- `Backend/Controllers/authController.js` - Order creation logic
- `Backend/Controllers/orderController.js` - Add new endpoints
- `Backend/Routes/orderRoutes.js` - Add new routes
- `Backend/Controllers/bookingController.js` - Table assignment
- `Backend/Controllers/queueController.js` - Table assignment
- `Backend/db.js` - Connection settings (if needed)

### Frontend
- `Frontend/src/pages/OrderManagement.jsx` - **Major refactor**
- `Frontend/src/pages/Cart.jsx` - Clear state logic
- `Frontend/src/pages/Menu.jsx` - Add order sequence display
- `Frontend/src/pages/OrderHistory.jsx` - Update display format
- `Frontend/src/components/Navbar.jsx` - Rename links
- `Frontend/src/context/AuthContext.jsx` - Add table session tracking
- `Frontend/src/pages/Booking.jsx` - Rename terminology
- `Frontend/src/pages/BookingManagement.jsx` - Rename terminology
- `Frontend/src/pages/Queue.jsx` - Rename terminology
- Multiple manager pages - Rename and update order display

### Database
- `database/init/schema.sql` - Add columns

---

## Implementation Steps

1. **Update database schema** (add table_id columns)
2. **Update backend order creation** (generate tableid-YYYYMMDDHHMMSS)
3. **Implement table assignment** (booking & queue)
4. **Create new API endpoints** (get active orders, get total)
5. **Update frontend terminology** (all files)
6. **Refactor Order Management page** (new UI layout)
7. **Update Cart & Menu** (state clearing)
8. **Update Order History** (new display format)
9. **Test end-to-end flow**

---

## User Flow

### Customer Books Table
1. Customer books table for future date
2. System: Creates booking record
3. System: Assigns available table when booking moves to "serving"

### Customer Places First Order
1. System: Creates order with ID `5-20261024143045`
2. System: Cart populated with this order
3. Customer: Confirms order
4. System: Order saved, cart cleared, menu refreshed
5. UI: Shows "Total for Table: $XXX"

### Customer Places Second Order
1. System: Creates order with ID `5-20261024144230`
2. System: Cart populated with this NEW order (previous not shown)
3. Customer: Confirms order
4. System: Order saved, cart cleared again
5. UI: Shows "Total for Table: $XXX + $YYY = $ZZZ" (accumulated)

### Payment
1. Manager: Marks all orders as "paid"
2. System: Resets table total accumulator
3. System: Marks table as available

---

## Success Criteria

- [ ] Order ID format: `tableid-YYYYMMDDHHMMSS`
- [ ] Each order is unique and separate
- [ ] Table assigned on booking confirmation
- [ ] Table assigned when queue called
- [ ] Total accumulates across multiple orders
- [ ] Cart clears after each order
- [ ] Menu doesn't retain selections
- [ ] UI clearly shows "Order N of M"
- [ ] Combined bill shows all orders + total
- [ ] All terminology changed (book/booking)
- [ ] Both customer and manager UIs work smoothly
