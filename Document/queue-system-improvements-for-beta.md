# Queue System Improvements for Beta

## 1. How will queue numbers be assigned to customers who missed their turn and return?

Recommendation: Give them a new standard queue number (which puts them at the end of the line), not a future number like +15.

* Why? Your system likely relies on `AUTO_INCREMENT` (e.g., `queue_id`). You cannot easily insert a ticket at `current_number + 15` without breaking the sequence.

* The Logic: When a customer returns, the manager clicks a "Reissue" button. The system marks their old ticket as `missed` or `cancelled`, and creates a completely new ticket with the current latest queue number. They go to the back of the line.

* (Optional) If you really want to give them a 15-ticket head start, you would give them a "Priority Ticket" (e.g., `P01`), and the manager just calls that ticket before the regular A tickets.

## 2. How should the status update once a ticket is missed?

* waiting → called → seated

* (Note: If the manager calls the next ticket without marking arrival, the previous ticket automatically transitions to missed.)

## 3. Is a customer allowed to rejoin the queue multiple times?

Recommendation: Limit them to 1 rejoin (or require manager override).

To prevent abuse, you can implement a simple check in your backend:

* When a customer tries to rejoin, check the `queue_entries` table:

`SELECT COUNT(*) FROM queue_entries WHERE user_id = ? AND status = 'missed'.`

* If the count is >= 1, the system blocks them and says: "You have already missed your turn once. Please see the manager to rejoin."

* This forces them to talk to the manager, who can manually click "Reissue" on the manager portal.

## 4. What action should the manager take on the manager web portal?

Your proposed interaction for the queue manager is an intuitive way to reduce clicks and maintain a clean workflow:

* *The Trigger Logic:*

1. The manager clicks "*Call*" for the current customer (e.g., Ticket #05).

2. If the manager immediately clicks "*Call*" again for the next customer (Ticket #06) without marking the previous one, the system *automatically* interprets that the previous customer did not show up, quietly transitioning Ticket #05 to "*missed*".

3. Alternatively, if the manager clicks "*Seated*" (or serving) on Ticket #05 instead of calling the next number, it registers that the customer arrived successfully, bypassing any missed status.

This approach keeps the manager's UI streamlined and saves them from having to hunt down separate "Mark Missed" buttons for every absent customer.

## 5. Im thinking or how about we inject the first manager directly into the database, then use this account to create other managers since only mangers can create managers?

Here is how to implement this:

### Step A: Database (Bootstrapping)

First, generate a bcrypt hash for a password (e.g., admin123). Run this in your backend terminal:

```bash
node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"
```

Copy the resulting hash (e.g., `$2b$10$X...`). Then, insert the first manager directly via MySQL:

```sql
USE comp3322_restaurant;
INSERT INTO users (name, email, phone, password_hash, role)
VALUES ('Super Admin', 'admin@restaurant.com', '00000000', 'PASTE_HASH_HERE', 'manager');
```

### Step B: Backend (The API)

In authController.js:

```js
// POST /api/auth/create-manager
exports.createManager = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email exists' });

    const password_hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || '', password_hash, 'manager']
    );

    res.status(201).json({ message: 'Manager created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

In authRoutes.js, protect it:

```js
router.post('/create-manager', verifyToken, requireRole('manager'), authController.createManager);
```

### Step C: Frontend (React)

Create a page CreateManager.jsx (only accessible to managers):

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function CreateManager() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [msg, setMsg] = useState('');
  const { token } = useAuth(); // Make sure you save the JWT token in AuthContext!

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/auth/create-manager', {
      method: 'POST',
      headers: {  
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Must send manager token
      },
      body: JSON.stringify(form)
    });
    
    if (res.ok) setMsg('Manager created successfully!');
    else setMsg('Failed to create manager.');
  }

  return (
    <div className="page">
      <h1>Create New Manager</h1>
      <form onSubmit={handleSubmit}>
        {/* Input fields for name, email, phone, password */}
        <button type="submit" className="btn">Create Manager</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
```

## 2. Forgot Password Flow (and how to improve it)

Your current flow:

Forget password -> fill in personal info -> send email + fill in personal info + set new password

Critique: This is too complicated, prone to error, and insecure. Asking the user to enter their Name, ID, and Email to "verify identity" is an anti-pattern. Name is not unique, and exposing the User ID is a security risk. Furthermore, asking them to fill in personal info twice is very poor UX.

The Standard, Secure Industry Flow:

1. Request: User enters only their Email.

2. Verify & Send: Backend checks if the email exists. If yes, generate a secure, time-limited token (e.g., valid for 15 minutes) and send a link to their email: https://yourfrontend.com/reset-password?token=abc123xyz

3. Reset: User clicks the link, which takes them to a page with a "New Password" field. The frontend sends the token + new password to the backend.

4. Update: Backend verifies the token is valid and not expired, hashes the new password, and updates the database.

Why this is better: It relies on the user's access to their email inbox as the proof of identity, which is the industry standard. No need to ask for Name or ID.

Database Change Required:

To implement this, you need to store the reset token in your users table:

```sql
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, ADD COLUMN reset_token_expires DATETIME NULL;
```

## 1. Unified Manager Page (ManagerOrders.jsx)

Instead of managing multiple item-level status buttons (pending → cooking → served), ManagerOrders.jsx functions purely as an Active Table Overview & Cashier Hub:

● Real-Time Order Tracking (0 Clicks): When customers order, food items list under their Table Number automatically so staff can verify orders and prevent anything from getting lost.

● Serving Food (0 Clicks): Staff simply bring food to the table as it's prepared—no manual status checking required on-screen.

● Financial Flow Clarification: unpaid automatically starts the moment the customer submits an order, operating as an independent financial tracking flow linked directly to their active table session.

● Auto-Completion Trigger: A table session automatically switches to completed either when 1 hour passes after seating or when the customer clicks "Pay" on their own interface.

● 1-Click Checkout: When settling, the manager simply clicks "Settle & Pay". This marks the bill as paid in the database and automatically clears/archives the table card from the active view.

## 2. Proposed System Workflows

● Booking Flow: booked → seated (Clicking "Seat Guest" assigns the table and opens the active session).

● Queue Flow: waiting → called → seated (Clicking "Seat Customer" moves walk-ins to an active table session).

● Order & Payment Flow: unpaid → completed → paid (Items display during dining; status switches to completed after 1 hr or customer request; manager clicks "Settle & Pay" to archive).

## 3. Manager Button Click Breakdown

1. Table Booking Flow (1 Click): Click "Seat Guest" upon reservation arrival.

2. Walk-In Queue Flow (1–2 Clicks): Click "Call Ticket" → Click "Seat Customer" (Calling the next ticket automatically marks absent customers as missed with zero extra clicks).

3. Order & Serving Flow (0 Clicks): Food items auto-populate under the table card for review.

4. Payment & Checkout Flow (1 Click): Click "Settle & Pay" when dining finishes to clear the table.

### Total Click Summary:

| Customer Type          | Step 1 (Arrival)              | Step 2 (Serving) | Step 3 (Payment) | Total Clicks |
|------------------------|-------------------------------|------------------|------------------|--------------|
| Booking Customer       | 1 Click ("Seat")              | 0 Clicks         | 1 Click ("Pay")  | 2 clicks total |
| Walk-In Queue Customer | 2 Clicks ("Call" + "Seat")    | 0 Clicks         | 1 Click ("Pay")  | 3 clicks total |
