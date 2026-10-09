-- Snapshots survive deletion or withdrawal of the source.
ALTER TABLE decks ADD COLUMN source_title TEXT NOT NULL DEFAULT '';
ALTER TABLE decks ADD COLUMN source_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE decks ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE decks ADD COLUMN root_deck_id TEXT;
CREATE INDEX decks_content_hash ON decks(content_hash) WHERE content_hash <> '';
CREATE INDEX decks_family ON decks(COALESCE(root_deck_id,id),visibility);
CREATE TRIGGER prevent_duplicate_publication BEFORE UPDATE OF visibility ON decks
WHEN NEW.visibility='public' AND OLD.visibility<>'public' BEGIN
 SELECT RAISE(ABORT,'AZUKI_UNCHANGED_COPY') WHERE NEW.source_deck_id IS NOT NULL AND (NEW.source_hash='' OR NEW.source_hash=NEW.content_hash);
 SELECT RAISE(ABORT,'AZUKI_DUPLICATE_PUBLIC') WHERE NEW.content_hash<>'' AND EXISTS(SELECT 1 FROM decks WHERE id<>NEW.id AND visibility='public' AND content_hash=NEW.content_hash);
END;
CREATE VIEW public_families AS
 SELECT id, COALESCE(root_deck_id,id) AS family_id,
 ROW_NUMBER() OVER (PARTITION BY COALESCE(root_deck_id,id) ORDER BY (owner_id='azuki:official') DESC,(id=COALESCE(root_deck_id,id)) DESC,created_at,id) AS family_rank
 FROM decks WHERE visibility='public';
