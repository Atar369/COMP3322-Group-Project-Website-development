-- Adds last_failed_at so failed-attempt counters can expire after 15 minutes.
-- Safe to run on an existing database that still has the old users table.

ALTER TABLE users
  ADD COLUMN last_failed_at DATETIME NULL AFTER lock_until;

-- Existing rows have no reliable timestamp; reset stale counters to a clean state.
UPDATE users
SET failed_attempts = 0,
    lock_until = NULL,
    last_failed_at = NULL
WHERE lock_until IS NULL
  AND failed_attempts > 0;