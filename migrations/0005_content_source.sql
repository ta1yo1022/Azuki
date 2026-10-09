-- Only server-managed content may carry this provenance. Copies retain it.
ALTER TABLE decks ADD COLUMN content_source TEXT NOT NULL DEFAULT '' CHECK(content_source IN ('', 'ejdict'));
