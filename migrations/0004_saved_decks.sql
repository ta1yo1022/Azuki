-- Keep the source id even when its original deck is deleted; saved content is independent.
ALTER TABLE decks ADD COLUMN source_deck_id TEXT;
CREATE UNIQUE INDEX decks_owner_saved_source ON decks(owner_id, source_deck_id)
  WHERE source_deck_id IS NOT NULL;
