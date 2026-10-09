ALTER TABLE app_usage ADD COLUMN byte_count INTEGER NOT NULL DEFAULT 0 CHECK(byte_count >= 0);
ALTER TABLE decks ADD COLUMN data_bytes INTEGER NOT NULL DEFAULT 0 CHECK(data_bytes BETWEEN 0 AND 524288);
-- Keep ample room for SQLite/index overhead within the Free plan's 500 MB database.
CREATE TRIGGER deck_storage_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_APP_STORAGE_LIMIT') WHERE (SELECT byte_count FROM app_usage WHERE id = 1) + NEW.data_bytes > 104857600;
END;
CREATE TRIGGER deck_storage_added AFTER INSERT ON decks BEGIN
  UPDATE app_usage SET byte_count = byte_count + NEW.data_bytes WHERE id = 1;
END;
CREATE TRIGGER deck_storage_deleted AFTER DELETE ON decks BEGIN
  UPDATE app_usage SET byte_count = byte_count - OLD.data_bytes WHERE id = 1;
END;
