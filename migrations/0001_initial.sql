PRAGMA foreign_keys = ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  word_count INTEGER NOT NULL DEFAULT 0 CHECK(word_count >= 0),
  deck_count INTEGER NOT NULL DEFAULT 0 CHECK(deck_count >= 0),
  import_day TEXT NOT NULL DEFAULT '',
  daily_words INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE app_usage (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  word_count INTEGER NOT NULL DEFAULT 0 CHECK(word_count >= 0),
  import_day TEXT NOT NULL DEFAULT '',
  daily_words INTEGER NOT NULL DEFAULT 0
);
INSERT INTO app_usage(id) VALUES (1);
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  word_count INTEGER NOT NULL CHECK(word_count BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX decks_owner_created ON decks(owner_id, created_at DESC, id DESC);
CREATE TABLE words (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  UNIQUE(deck_id, ordinal)
);
CREATE TABLE textbook_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  UNIQUE(name, edition, chapter)
);
CREATE TABLE deck_textbook_tags (
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES textbook_tags(id),
  PRIMARY KEY(deck_id, tag_id)
);
CREATE INDEX deck_textbook_tag_lookup ON deck_textbook_tags(tag_id, deck_id);
-- Limits are enforced in the same transaction as imports, including concurrent requests.
-- Use SELECT RAISE ... WHERE: the remote D1 parser can split an inner CASE ... END; early.
CREATE TRIGGER deck_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_DECK_LIMIT') WHERE (SELECT deck_count FROM users WHERE id = NEW.owner_id) >= 20;
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM users WHERE id = NEW.owner_id) + NEW.word_count > 1000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id = 1) + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id = 1) + NEW.word_count > 5000;
END;
CREATE TRIGGER deck_added AFTER INSERT ON decks BEGIN
  UPDATE users SET word_count = word_count + NEW.word_count, deck_count = deck_count + 1,
    daily_words = (CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END) + NEW.word_count,
    import_day = date('now') WHERE id = NEW.owner_id;
  UPDATE app_usage SET word_count = word_count + NEW.word_count,
    daily_words = (CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END) + NEW.word_count,
    import_day = date('now') WHERE id = 1;
END;
CREATE TRIGGER deck_deleted AFTER DELETE ON decks BEGIN
  UPDATE users SET word_count = word_count - OLD.word_count, deck_count = deck_count - 1 WHERE id = OLD.owner_id;
  UPDATE app_usage SET word_count = word_count - OLD.word_count WHERE id = 1;
  DELETE FROM textbook_tags WHERE id NOT IN (SELECT tag_id FROM deck_textbook_tags);
END;
