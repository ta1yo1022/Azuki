-- Support several 500-word books per day. Existing counters are preserved.
DROP TRIGGER deck_quota;
CREATE TRIGGER deck_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_DECK_LIMIT') WHERE (SELECT deck_count FROM users WHERE id = NEW.owner_id) >= 20;
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id = 1) + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id = 1) + NEW.word_count > 10000;
END;

-- Account for an in-place editorial expansion without deleting the shared deck.
DROP TRIGGER deck_content_quota;
CREATE TRIGGER deck_content_quota BEFORE UPDATE OF word_count, data_bytes ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id=NEW.owner_id) - OLD.word_count + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM users WHERE id=NEW.owner_id) + max(NEW.word_count-OLD.word_count,0) > 5000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id=1) - OLD.word_count + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id=1) + max(NEW.word_count-OLD.word_count,0) > 10000;
  SELECT RAISE(ABORT, 'AZUKI_APP_STORAGE_LIMIT') WHERE (SELECT byte_count FROM app_usage WHERE id=1) - OLD.data_bytes + NEW.data_bytes > 104857600;
END;
