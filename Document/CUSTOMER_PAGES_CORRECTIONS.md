# Customer Side Pages - Corrections & Updates

## Summary of Changes
All customer-facing pages have been updated to align with the new ordering workflow and business rules.

---

## 1. Navigation & Header (Navbar.jsx)

### Changes Made:
- **Order dropdown simplified** - Now shows only:
  - "Orders & Cart" (links to `/order-management`)
  - "Order History" (links to `/order-history`)
- Removed: "My Orders", "Browse & Order", "Cart" from dropdown (all consolidated into the "Orders & Cart" page)

### Why:
- Cleaner navigation flow
- Users go to the Orders & Cart page first to check their seated tables
- Then click "Order" button to access menu
- Or click "Cart" icon to review current cart

---

## 2. Orders & Cart Page (OrderManagement.jsx)

### Major Changes:

#### 1. **Seated Session Flow**
- The selected seated booking or queue entry is attached to the cart so placed orders are associated with that session.
- Users click "Order" to open the Menu page or "Cart" to review their current cart.
- Menu ordering is available only while the customer is seated and within the order window.

#### 2. **45-Minute Order Window Timer**
- **Order window:** 45 minutes after being seated
  - Shows: "⏱ XX mins XX seconds left for the last order"
  - Color: Green (changes to red in final 5 minutes)
- **After 45 mins:** Changes to "⏱ Last order end" (red)
  - No additional time display
  - Customer can finish eating but cannot place new orders
  
#### 3. **21:00 Restaurant Cutoff**
- **Order button disabled** at 21:00 (restaurant closes at 22:00)
- **Cart button disabled** at 21:00
- Users cannot place new orders after 21:00
- Exception: If already in order window, can complete within 45-min window

#### 4. **Status Transitions**
- **After Request Payment clicked:**
  - The card remains visible with its accumulated unpaid total.
  - Order, Cart, and Request Payment actions are replaced by the completion message.

#### 5. **Multiple Orders Support**
- The Orders & Cart page groups unpaid orders by `table_id`
- Customer sees one card per table with the combined unpaid total
- Customer can order multiple times (orders accumulate in one card)

### UI Changes:
```
Before: "Orders & Cart" page with vertical table/queue cards
After:  "Orders & Cart" page with horizontal cards and accumulated unpaid totals
```

---

## 3. Menu Page (Menu.jsx)

### Changes Made:

#### 1. **Removed Booking ID / Queue ID Entry Fields**
- Deleted: All input fields for Booking ID and Queue ID
- Deleted: `checkBooking()` and `checkQueue()` validation functions
- Deleted: "🔒 Order Access Required" warning card

#### 2. **Simplified Menu Display**
- Menu is always browsable
- **Business Rule:** Only seated customers (status='serving') can access this page
- Access control happens at router level, not component level

#### 3. **Streamlined Flow**
- Customer on the Orders & Cart page clicks "Order"
- Takes them to Menu page
- Browse and click "+" to add items
- Shows cart count at bottom
- Click "review order" to go to Cart page

---

## 4. Queue Page (Queue.jsx)

### Changes Made:

#### 1. **21:00 Cutoff for Queue Joining**
- After 21:00: "Get Queue Number" button becomes disabled
- Shows message: "Restaurant stops accepting new queue entries at 21:00"
- Party size selector also disabled
- Error on join attempt: "The restaurant stops accepting new queue entries at 21:00. Please try again tomorrow."

#### 2. **Fixed Timestamp Display**
- Shows proper HH:MM:SS format in "Joined At" field
- Changed from: `joined_at.slice(11, 16)` (HH:MM)
- Changed to: `joined_at.slice(11, 19)` (HH:MM:SS)

#### 3. **Real-time Timer**
- Added 1-second interval updates (for live timer display)
- Ensures cutoff time is enforced accurately

#### 4. **Missed Ticket Rejoin**
- Customer can rejoin when their missed ticket is no more than 35 queue numbers behind the current call in their A/B/C group.
- Rejoin is limited to once per missed ticket.
- The new ticket uses the exact number 15 after the current call; if it is already assigned, the customer is asked to try after the next call.

---

## 5. Queue History Page (QueueHistory.jsx)

### Changes Made:

#### 1. **Fixed Timestamp Display**
- Now shows complete join time with seconds
- Format: "Joined 2026-10-24 14:30:45" (date + full time)
- Changed from: `queue_date || joined_at?.slice(0, 10)`
- Changed to: `joined_at?.slice(0, 10) joined_at?.slice(11, 19)`

---

## 6. Booking Management Page (BookingManagement.jsx)

### Major Changes:

#### 1. **Disabled Direct Date/Time/Party Size Editing**
- Date field: Now **display only** (not editable)
- Time field: Now **display only** (not editable)
- Party size field: Now **display only** (not editable)
- Special request field: Now **display only** (not editable)

#### 2. **Only Pre-order Courses Remain Editable**
- Users can only add/remove pre-order courses
- User instruction card shows:
  - "You can only edit the pre-order courses"
  - "To change the date, time, party size, or special request, please cancel this booking and create a new one"

#### 3. **Edit Page Redesign**
- New title: "Edit Pre-order Courses for Booking #{ID}"
- Added info box showing current booking details (read-only):
  - Date
  - Time
  - Party Size
  - Special Request
- Pre-order editing section below (unchanged functionality)

---

## Business Logic Summary

### Order Window & Timing

```
Customer seated (status='serving')
           ↓
Start 45-minute ORDER window
           ↓
First 45 mins: Can click "Order" to add items
           ↓
After 45 mins: "Last order end" (cannot add more)
           ↓
Remaining 15 mins: Can finish eating
           ↓
After 1 hour: Dining session complete
           ↓
Click "Request Payment" → Manager settles payment
```

### Restaurant Cutoff Time

```
21:00: Restaurant stops accepting NEW orders/queues
21:00-22:00: Existing customers can finish dining
22:00: Restaurant closes
```

### Multiple Orders Per Table

```
Customer orders → Order created (unpaid)
Customer orders again → New order created (unpaid)
Backend grouping: Both orders shown under same table_id
Manager view: ONE card with combined total
```

---

## Technical Details

### Timer Implementation (OrderManagement.jsx)

```javascript
const ORDER_WINDOW_MS = 45 * 60 * 1000;  // 45 minutes
const TOTAL_TIME_MS = 1 * 60 * 60 * 1000; // 1 hour

// After 45 mins elapsed:
if (orderWindowRemaining <= 0) {
  // Show "Last order end"
  // Show remaining total time
  // Disable Order/Cart buttons
}
```

### 21:00 Cutoff Check

```javascript
function isAfter21(now = new Date()) {
  return now.getHours() >= 21;
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `Navbar.jsx` | Simplified Order dropdown (2 links only) |
| `OrderManagement.jsx` | Added 45-min timer, 21:00 cutoff, removed ID fields |
| `Menu.jsx` | Removed ID entry fields, simplified display |
| `Queue.jsx` | Added 21:00 cutoff, fixed timestamp format |
| `QueueHistory.jsx` | Fixed timestamp to include seconds |
| `BookingManagement.jsx` | Disabled editing date/time/party/request, only pre-order editable |

---

## Testing Checklist

### Order Management Page
- [ ] Timer starts at 0:45:00 when status becomes 'serving'
- [ ] Timer counts down
- [ ] At 0:00:00, shows "Last order end" in red
- [ ] Buttons disabled when order window closed
- [ ] Buttons disabled after 21:00
- [ ] "Request Payment" hides all controls
- [ ] Cart shows correct item count

### Menu Page
- [ ] No ID input fields visible
- [ ] Can add items to cart
- [ ] Cart updates correctly
- [ ] Can navigate to cart page

### Queue Page
- [ ] "Get Queue Number" disabled after 21:00
- [ ] Error message shown when trying to join after 21:00
- [ ] Timestamp shows HH:MM:SS format

### Queue History Page
- [ ] Timestamp shows date + full time (HH:MM:SS)
- [ ] No trailing zeros or zeros-only times

### Booking Management Page
- [ ] Date, time, party size show as read-only
- [ ] Cannot edit these fields
- [ ] Special request shows as read-only
- [ ] Pre-order courses remain editable
- [ ] Info box displays all read-only fields
- [ ] "Edit Pre-order Courses" title shows

---

## Notes

- All timers update at 1-second intervals for accuracy
- Timer colors change: Green → Red as cutoff approaches
- Order window is independent from total dining time display
- Multiple simultaneous orders group by table_id at backend
- 21:00 cutoff is strict - no new queues or orders accepted

---

**Last Updated:** 2026-10-24  
**Status:** ✅ Ready for Testing
