ALTER TABLE decks ADD COLUMN language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en','ja','th','zh'));
ALTER TABLE decks ADD COLUMN meaning_language TEXT NOT NULL DEFAULT 'ja' CHECK(meaning_language IN ('en','ja','th','zh'));
CREATE INDEX decks_public_language ON decks(visibility,language,created_at,id);
DROP VIEW public_families;
CREATE VIEW public_families AS
 SELECT id, COALESCE(root_deck_id,id) AS family_id,
 ROW_NUMBER() OVER (PARTITION BY COALESCE(root_deck_id,id),language ORDER BY (owner_id='azuki:official') DESC,(id=COALESCE(root_deck_id,id)) DESC,created_at,id) AS family_rank
 FROM decks WHERE visibility='public';
