ALTER TABLE users
  ADD COLUMN manager_id VARCHAR(50) NULL AFTER name,
  ADD UNIQUE KEY uq_users_manager_id (manager_id);
