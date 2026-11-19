CREATE TABLE collections (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60), created_at TEXT NOT NULL,
 UNIQUE(user_id,id)
);
CREATE INDEX collections_owner ON collections(user_id,created_at);
CREATE TABLE collection_decks (
 user_id TEXT NOT NULL, collection_id TEXT NOT NULL, deck_id TEXT NOT NULL,
 PRIMARY KEY(user_id,collection_id,deck_id),
 FOREIGN KEY(user_id,collection_id) REFERENCES collections(user_id,id) ON DELETE CASCADE
);
CREATE TRIGGER collections_limit BEFORE INSERT ON collections
WHEN (SELECT count(*) FROM collections WHERE user_id=NEW.user_id)>=50
BEGIN SELECT RAISE(ABORT,'collection_count_limit'); END;
CREATE TRIGGER collection_members_limit BEFORE INSERT ON collection_decks
WHEN NOT EXISTS(SELECT 1 FROM collection_decks WHERE user_id=NEW.user_id AND collection_id=NEW.collection_id AND deck_id=NEW.deck_id)
AND (SELECT count(*) FROM collection_decks WHERE user_id=NEW.user_id)>=1000
BEGIN SELECT RAISE(ABORT,'collection_members_limit'); END;
CREATE TRIGGER collection_deleted_deck AFTER DELETE ON decks
BEGIN DELETE FROM collection_decks WHERE deck_id=OLD.id; END;
CREATE TRIGGER collection_removed_favorite AFTER DELETE ON favorites
BEGIN DELETE FROM collection_decks WHERE user_id=OLD.user_id AND deck_id=OLD.deck_id
AND NOT EXISTS(SELECT 1 FROM decks WHERE id=OLD.deck_id AND owner_id=OLD.user_id); END;
