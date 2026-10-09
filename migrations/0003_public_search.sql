-- Only explicitly published decks are included in the public catalogue.
CREATE INDEX decks_public_created ON decks(created_at DESC, id DESC) WHERE visibility='public';
