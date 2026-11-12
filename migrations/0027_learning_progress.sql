CREATE TABLE learning_decks (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 deck_id TEXT NOT NULL,
 PRIMARY KEY(user_id,deck_id)
);
CREATE TABLE learning_ratings (
 user_id TEXT NOT NULL, deck_id TEXT NOT NULL, word_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('known','weak','unseen')),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,deck_id,word_id),
 FOREIGN KEY(user_id,deck_id) REFERENCES learning_decks(user_id,deck_id) ON DELETE CASCADE
);
CREATE TABLE learning_positions (
 user_id TEXT NOT NULL, deck_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('words','examples','book')),
 position_json TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,deck_id,mode),
 FOREIGN KEY(user_id,deck_id) REFERENCES learning_decks(user_id,deck_id) ON DELETE CASCADE
);
CREATE TRIGGER learning_rating_limit BEFORE INSERT ON learning_ratings
WHEN NOT EXISTS(SELECT 1 FROM learning_ratings WHERE user_id=NEW.user_id AND deck_id=NEW.deck_id AND word_id=NEW.word_id)
AND (SELECT count(*) FROM learning_ratings WHERE user_id=NEW.user_id)>=15000
BEGIN SELECT RAISE(ABORT,'learning_rating_limit'); END;
