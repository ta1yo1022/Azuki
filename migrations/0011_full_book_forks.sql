-- Preserve books, words, tags, lineage and quota totals while widening the per-book constraint.

-- Child tables are staged explicitly so dropping the parent cannot cascade-delete their data.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE fork_migration_decks AS SELECT * FROM decks;

CREATE TABLE fork_migration_words AS SELECT * FROM words;

CREATE TABLE fork_migration_deck_textbook_tags AS SELECT * FROM deck_textbook_tags;

DROP TABLE words;

DROP TABLE deck_textbook_tags;

DROP TABLE decks;

CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  word_count INTEGER NOT NULL CHECK(word_count BETWEEN 1 AND 5000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, data_bytes INTEGER NOT NULL DEFAULT 0 CHECK(data_bytes BETWEEN 0 AND 524288), source_deck_id TEXT, content_source TEXT NOT NULL DEFAULT '' CHECK(content_source IN ('', 'ejdict')), official_level TEXT NOT NULL DEFAULT '' CHECK(official_level IN ('', 'beginner', 'intermediate', 'advanced')), official_revision INTEGER NOT NULL DEFAULT 0 CHECK(official_revision >= 0), source_title TEXT NOT NULL DEFAULT '', source_hash TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '', root_deck_id TEXT, is_fork INTEGER NOT NULL DEFAULT 0);

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

CREATE TABLE deck_textbook_tags (
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES textbook_tags(id),
  PRIMARY KEY(deck_id, tag_id)
);

INSERT INTO decks SELECT * FROM fork_migration_decks;

INSERT INTO words SELECT * FROM fork_migration_words;

INSERT INTO deck_textbook_tags SELECT * FROM fork_migration_deck_textbook_tags;

DROP TABLE fork_migration_decks;

DROP TABLE fork_migration_words;

DROP TABLE fork_migration_deck_textbook_tags;

CREATE INDEX deck_textbook_tag_lookup ON deck_textbook_tags(tag_id, deck_id);

CREATE INDEX decks_content_hash ON decks(content_hash) WHERE content_hash <> '';

CREATE INDEX decks_family ON decks(COALESCE(root_deck_id,id),visibility);

CREATE INDEX decks_owner_created ON decks(owner_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX decks_owner_saved_source ON decks(owner_id,source_deck_id)
  WHERE source_deck_id IS NOT NULL AND is_fork=0;

CREATE INDEX decks_public_created ON decks(created_at DESC, id DESC) WHERE visibility='public';

CREATE TRIGGER deck_added AFTER INSERT ON decks BEGIN
  UPDATE users SET word_count = word_count + NEW.word_count, deck_count = deck_count + 1,
    daily_words = (CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END) + NEW.word_count,
    import_day = date('now') WHERE id = NEW.owner_id;
  UPDATE app_usage SET word_count = word_count + NEW.word_count,
    daily_words = (CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END) + NEW.word_count,
    import_day = date('now') WHERE id = 1;
END;

CREATE TRIGGER deck_content_quota BEFORE UPDATE OF word_count, data_bytes ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id=NEW.owner_id) - OLD.word_count + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM users WHERE id=NEW.owner_id) + max(NEW.word_count-OLD.word_count,0) > 5000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id=1) - OLD.word_count + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day=date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id=1) + max(NEW.word_count-OLD.word_count,0) > 10000;
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

CREATE TRIGGER deck_deleted AFTER DELETE ON decks BEGIN
  UPDATE users SET word_count = word_count - OLD.word_count, deck_count = deck_count - 1 WHERE id = OLD.owner_id;
  UPDATE app_usage SET word_count = word_count - OLD.word_count WHERE id = 1;
  DELETE FROM textbook_tags WHERE id NOT IN (SELECT tag_id FROM deck_textbook_tags);
END;

CREATE TRIGGER deck_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_DECK_LIMIT') WHERE (SELECT deck_count FROM users WHERE id = NEW.owner_id) >= 20;
  SELECT RAISE(ABORT, 'AZUKI_WORD_LIMIT') WHERE (SELECT word_count FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_DAILY_LIMIT') WHERE NEW.owner_id <> 'azuki:official' AND (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM users WHERE id = NEW.owner_id) + NEW.word_count > 5000;
  SELECT RAISE(ABORT, 'AZUKI_APP_LIMIT') WHERE (SELECT word_count FROM app_usage WHERE id = 1) + NEW.word_count > 100000;
  SELECT RAISE(ABORT, 'AZUKI_APP_DAILY_LIMIT') WHERE (SELECT CASE WHEN import_day = date('now') THEN daily_words ELSE 0 END FROM app_usage WHERE id = 1) + NEW.word_count > 10000;
END;

CREATE TRIGGER deck_storage_added AFTER INSERT ON decks BEGIN
  UPDATE app_usage SET byte_count = byte_count + NEW.data_bytes WHERE id = 1;
END;

CREATE TRIGGER deck_storage_deleted AFTER DELETE ON decks BEGIN
  UPDATE app_usage SET byte_count = byte_count - OLD.data_bytes WHERE id = 1;
END;

CREATE TRIGGER deck_storage_quota BEFORE INSERT ON decks BEGIN
  SELECT RAISE(ABORT, 'AZUKI_APP_STORAGE_LIMIT') WHERE (SELECT byte_count FROM app_usage WHERE id = 1) + NEW.data_bytes > 104857600;
END;

CREATE TRIGGER prevent_duplicate_publication BEFORE UPDATE OF visibility ON decks
WHEN NEW.visibility='public' AND OLD.visibility<>'public' BEGIN
 SELECT RAISE(ABORT,'AZUKI_UNCHANGED_COPY') WHERE NEW.source_deck_id IS NOT NULL AND (NEW.source_hash='' OR NEW.source_hash=NEW.content_hash);
 SELECT RAISE(ABORT,'AZUKI_DUPLICATE_PUBLIC') WHERE NEW.content_hash<>'' AND EXISTS(SELECT 1 FROM decks WHERE id<>NEW.id AND visibility='public' AND content_hash=NEW.content_hash);
END;

PRAGMA defer_foreign_keys = OFF;
