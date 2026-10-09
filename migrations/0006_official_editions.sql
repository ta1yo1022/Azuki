ALTER TABLE decks ADD COLUMN official_level TEXT NOT NULL DEFAULT '' CHECK(official_level IN ('', 'beginner', 'intermediate', 'advanced'));
ALTER TABLE decks ADD COLUMN official_revision INTEGER NOT NULL DEFAULT 0 CHECK(official_revision >= 0);

-- The reserved editorial owner is managed through D1, never through user sign-in.
-- Its publications share the global daily/storage budgets, without the user daily cap.
DROP TRIGGER deck_quota;
CREATE TRIGGER deck_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_DECK_LIMIT') WHERE (SELECT deck_count FROM users WHERE id = NEW.owner_id) >= 20;
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM users WHERE id = NEW.owner_id) + NEW.word_count > 1000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id = 1) + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id = 1) + NEW.word_count > 5000;
END;

-- Account for an in-place editorial expansion without deleting the shared deck.
CREATE TRIGGER deck_content_quota BEFORE UPDATE OF word_count, data_bytes ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id=NEW.owner_id) - OLD.word_count + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM users WHERE id=NEW.owner_id) + max(NEW.word_count-OLD.word_count,0) > 1000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id=1) - OLD.word_count + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id=1) + max(NEW.word_count-OLD.word_count,0) > 5000;
  SELECT RAISE(ABORT, 'AZUKI_APP_STORAGE_LIMIT') WHERE (SELECT byte_count FROM app_usage WHERE id=1) - OLD.data_bytes + NEW.data_bytes > 104857600;
END;
CREATE TRIGGER deck_content_updated AFTER UPDATE OF word_count, data_bytes ON decks BEGIN
  UPDATE users SET word_count=word_count-OLD.word_count+NEW.word_count,
    daily_words=(CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END) + max(NEW.word_count-OLD.word_count,0),
    import_day=date('now') WHERE id=NEW.owner_id;
  UPDATE app_usage SET word_count=word_count-OLD.word_count+NEW.word_count,
    byte_count=byte_count-OLD.data_bytes+NEW.data_bytes,
    daily_words=(CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END) + max(NEW.word_count-OLD.word_count,0),
    import_day=date('now') WHERE id=1;
END;
