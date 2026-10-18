-- Edited forks are separate from the one saved copy of a public book.
ALTER TABLE decks ADD COLUMN is_fork INTEGER NOT NULL DEFAULT 0;
DROP INDEX decks_owner_saved_source;
CREATE UNIQUE INDEX decks_owner_saved_source ON decks(owner_id,source_deck_id)
  WHERE source_deck_id IS NOT NULL AND is_fork=0;
