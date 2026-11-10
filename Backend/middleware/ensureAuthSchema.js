const db = require('../db');

const AUTH_COLUMNS = [
  ['email_verified', 'BOOLEAN NOT NULL DEFAULT TRUE'],
  ['email_verification_token_hash', 'CHAR(64) NULL'],
  ['email_verification_expires', 'DATETIME NULL'],
  ['email_verification_sent_at', 'DATETIME NULL'],
  ['account_disabled', 'BOOLEAN NOT NULL DEFAULT FALSE'],
];

async function ensureAuthSchema() {
  for (const [columnName, definition] of AUTH_COLUMNS) {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS column_count
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name = ?`,
      [columnName]
    );

    if (Number(rows[0].column_count) === 0) {
      await db.query(`ALTER TABLE users ADD COLUMN ${columnName} ${definition}`);
    }
  }

  const [indexes] = await db.query(
    `SELECT COUNT(*) AS index_count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'users'
       AND index_name = 'idx_users_email_verification_token'`
  );
  if (Number(indexes[0].index_count) === 0) {
    await db.query('ALTER TABLE users ADD INDEX idx_users_email_verification_token (email_verification_token_hash)');
  }

  await db.query(
    `CREATE TABLE IF NOT EXISTS booking_cancellation_flags (
      flag_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      booking_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (flag_id),
      UNIQUE KEY uq_booking_cancellation_flag_booking (booking_id),
      KEY idx_booking_cancellation_flags_user (user_id),
      CONSTRAINT fk_booking_cancellation_flags_booking FOREIGN KEY (booking_id)
        REFERENCES bookings (booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_booking_cancellation_flags_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    )`
  );
}

module.exports = ensureAuthSchema;
