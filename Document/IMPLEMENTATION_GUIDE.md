# Queue System & Auth Improvements - Implementation Guide

This document outlines the improvements made to the queue system, authentication flow, and manager portal based on beta feedback.

## Changes Made

### 1. Database Schema Updates

#### Users Table - Password Reset Support
Added fields to support secure password reset tokens:
- `reset_token VARCHAR(255) NULL` - Stores the reset token
- `reset_token_expires DATETIME NULL` - Expiration time for the token (15 minutes)

**Migration SQL:**
```sql
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, 
                  ADD COLUMN reset_token_expires DATETIME NULL;
```

#### Queue Entries Table - Missed Ticket Support & Rejoin Tracking
Added fields to track missed customers and rejoin attempts:
- `rejoin_count INT UNSIGNED NOT NULL DEFAULT 0` - Tracks how many times a customer has rejoined
- Updated status constraint to include `'missed'` status

**Migration SQL:**
```sql
ALTER TABLE queue_entries ADD COLUMN rejoin_count INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE queue_entries MODIFY status VARCHAR(9) NOT NULL DEFAULT 'queued' 
  CHECK (status IN ('queued', 'called', 'serving', 'missed', 'finished', 'paid', 'cancelled'));
```

### 2. Backend Improvements

#### Authentication Controller (`authController.js`)

**New Features:**
1. **Secure Password Reset Flow** - Two-step process:
   - `POST /api/auth/forgot-password` - User enters email, backend generates 15-min token
   - `POST /api/auth/reset-password` - User submits token + new password

2. **Manager Creation** - Only existing managers can create new managers:
   - `POST /api/auth/create-manager` (protected, manager-only)
   - Prevents unauthorized manager account creation

**Improvements:**
- Removed insecure "verify by name/phone" method
- Now uses email inbox as proof of identity (industry standard)
- Tokens expire after 15 minutes for security

#### Queue Controller (`queueController.js`)

**New Features:**
1. **Auto-Mark Missed** - When manager calls next ticket:
   - Any previously called ticket that wasn't served is automatically marked as `'missed'`
   - Reduces manual clicks for managers
   - Eliminates human error

2. **Rejoin Limit** - Customers limited to 1 rejoin per day:
   - Check: `SELECT COUNT(*) FROM queue_entries WHERE user_id = ? AND queue_date = ? AND status = 'missed'`
   - If count >= 1, system blocks rejoin and prompts: "Please see the manager"
   - Prevents queue abuse

3. **Reissue Endpoint** - Managers can issue new tickets to missed customers:
   - `PATCH /api/queue/:id/reissue` (manager use only)
   - Creates fresh queue number at end of line
   - Marks old ticket as cancelled
   - Tracks rejoin attempt via `rejoin_count`

**Workflow:**
- waiting → called → served
- (Auto) waiting → called → (not served) → missed
- (Manager reissue) missed → new queue number at end

### 3. Frontend Improvements

#### Forgot Password Flow (`ForgotPassword.jsx`)
**Before:** Required name + email + phone (insecure, poor UX)
**After:** Two-step secure flow
1. Step 1: User enters only email
2. Link sent: `https://yourfrontend.com/reset-password?token=abc123xyz`
3. Step 2: User clicks link, enters new password
4. Token validated, password updated

#### Manager Creation Page (`CreateManager.jsx`)
- New component for manager-to-manager account creation
- Protected: only accessible to users with `role = 'manager'`
- Streamlined form: name, email, phone (optional), password
- Feedback: success/error messages with redirect

#### AuthContext Updates
- Now exports `token` value for use in headers
- Properly saves/clears token on login/logout
- Enables authorization headers in API calls

### 4. API Routes

#### Auth Routes (`authRoutes.js`)
```javascript
POST   /api/auth/register                    - Customer registration
POST   /api/auth/login                       - Login (all roles)
GET    /api/auth/me                          - Get current user (protected)
POST   /api/auth/change-password             - Change password (protected)
POST   /api/auth/forgot-password             - Request password reset
POST   /api/auth/reset-password              - Submit new password with token
POST   /api/auth/create-manager              - Create manager (protected, manager-only)
```

#### Queue Routes (`queueRoutes.js`)
```javascript
GET    /api/queue                            - List all queue entries
POST   /api/queue                            - Join queue
GET    /api/queue/user/:user_id              - Get user's queue history
PATCH  /api/queue/:id/call                   - Call ticket (auto-marks previous as missed)
PATCH  /api/queue/:id/checkin                - Confirm arrival (called → serving)
PATCH  /api/queue/:id/finish                 - Mark service complete
PATCH  /api/queue/:id/pay                    - Mark as paid
PATCH  /api/queue/:id/cancel                 - Cancel ticket
PATCH  /api/queue/:id/reissue                - Reissue new ticket to missed customer
```

## Implementation Steps

### Step 1: Database Migration
1. Run the schema updates to add `reset_token`, `reset_token_expires`, and `rejoin_count` fields
2. Verify the status check constraint includes `'missed'`

### Step 2: Backend Deployment
1. Update `authController.js` with new forgot-password and reset-password flows
2. Add manager creation endpoint with role checking
3. Update `queueController.js` with auto-missed logic and reissue function
4. Update routes to register new endpoints

### Step 3: Frontend Deployment
1. Replace `ForgotPassword.jsx` with new two-step flow
2. Add `CreateManager.jsx` to manager pages
3. Update `AuthContext.jsx` to expose token and fix save logic
4. Update any manager pages that need reissue button (optional UI enhancement)

### Step 4: Environment Setup
Ensure `.env` has:
```
FRONTEND_URL=http://localhost:5173  # For password reset links
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## Security Improvements

✅ **Password Reset:**
- No more asking for Name/ID (insecure exposure)
- Email-based verification (industry standard)
- 15-minute token expiration
- Tokens invalidated after use

✅ **Manager Creation:**
- Only existing managers can create new managers
- Cannot be done via public registration
- Token required in authorization header
- Role check enforced server-side

✅ **Queue System:**
- Rejoin limit prevents abuse
- Auto-missed logic prevents data inconsistency
- Rejoin count tracked for audit trail

## Manager Portal Benefits

| Scenario | Before | After |
|----------|--------|-------|
| Customer calls #5 (no show), then calls #6 | 2 clicks: "Call #5", "Mark Missed #5", "Call #6" | 1 click: "Call #6" (auto-marks #5 as missed) |
| Customer misses turn, wants to rejoin | No system prevent | System blocks after 1 miss, prompts manager |
| Manager reissues ticket | Manual entry | 1 click: "Reissue" (generates new #) |

## Testing Recommendations

1. **Password Reset Flow:**
   - Request reset with valid/invalid email
   - Click reset link with valid/expired token
   - Verify token expires after 15 minutes

2. **Manager Creation:**
   - Try creating manager without manager role (should fail)
   - Create new manager, login, verify role
   - Try creating another manager as new manager (should work)

3. **Queue Improvements:**
   - Join queue, verify rejoin_count = 0
   - Join again (should be blocked)
   - Manually set status to 'missed'
   - Try rejoin (should be blocked with message)
   - Manager clicks reissue (should create new ticket at end)
   - Call ticket 1, then call ticket 2 (ticket 1 should auto-mark as missed)

## Backward Compatibility

- All changes are backward compatible
- Old tickets without `rejoin_count` default to 0
- Old tokens in users table can be NULL
- No breaking changes to existing API contracts

## Next Steps

1. Deploy to staging environment
2. Run full test suite
3. Verify database migrations complete
4. Load test with concurrent queue operations
5. Collect feedback from beta testers
6. Deploy to production with gradual rollout

---

**For questions or issues, refer to the original improvement document: `queue-system-improvements-for-beta.md`**
