# Booking Cancellation Policy

- Each customer-initiated cancellation of a confirmed (`booked`) reservation adds one flag.
- Manager cancellations, edits, booking no-shows, and other booking outcomes do not add customer flags.
- Flags never expire. A booking can add at most one flag.
- At four flags, the customer account is disabled. Login and authenticated customer actions are blocked.
- The account record and email remain in the database; that email cannot be registered again.
- The booking cancellation page and customer profile show the current flag count. The cancellation action warns customers before applying a flag.
