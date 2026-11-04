const db = require('../db');

async function ensureQueueSchema() {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_entries'`
  );
  const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));

  if (!existingColumns.has('table_id')) {
    await db.query('ALTER TABLE queue_entries ADD COLUMN table_id INT UNSIGNED NULL');
  }
  if (!existingColumns.has('reserved_table_id')) {
    await db.query('ALTER TABLE queue_entries ADD COLUMN reserved_table_id INT UNSIGNED NULL');
  }

  const [indexes] = await db.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_entries'`
  );
  const existingIndexes = new Set(indexes.map(index => index.INDEX_NAME));
  if (!existingIndexes.has('idx_queue_table_status')) {
    await db.query('ALTER TABLE queue_entries ADD INDEX idx_queue_table_status (table_id, status)');
  }
  if (!existingIndexes.has('idx_queue_reserved_table')) {
    await db.query('ALTER TABLE queue_entries ADD INDEX idx_queue_reserved_table (reserved_table_id, status)');
  }

  const [constraints] = await db.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_entries'`
  );
  const existingConstraints = new Set(constraints.map(constraint => constraint.CONSTRAINT_NAME));
  if (!existingConstraints.has('fk_queue_table')) {
    await db.query(
      `ALTER TABLE queue_entries ADD CONSTRAINT fk_queue_table
       FOREIGN KEY (table_id) REFERENCES restaurant_tables (table_id)
       ON DELETE SET NULL ON UPDATE RESTRICT`
    );
  }
  if (!existingConstraints.has('fk_queue_reserved_table')) {
    await db.query(
      `ALTER TABLE queue_entries ADD CONSTRAINT fk_queue_reserved_table
       FOREIGN KEY (reserved_table_id) REFERENCES restaurant_tables (table_id)
       ON DELETE SET NULL ON UPDATE RESTRICT`
    );
  }

  await db.query(
    `CREATE TABLE IF NOT EXISTS queue_auto_call_settings (
      group_code CHAR(1) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (group_code),
      CONSTRAINT chk_queue_auto_call_group CHECK (group_code IN ('A', 'B', 'C'))
    ) ENGINE=InnoDB`
  );
  await db.query(
    `INSERT IGNORE INTO queue_auto_call_settings (group_code, enabled)
     VALUES ('A', FALSE), ('B', FALSE), ('C', FALSE)`
  );
}

module.exports = ensureQueueSchema;
