-- Editorial originals now live in Git and are served by Pages.
-- Copies retain their independent words and source IDs (not foreign keys).
DELETE FROM decks WHERE owner_id='azuki:official' AND id IN (
  'azuki-official-daily-v1',
  'azuki-official-travel-v1',
  'azuki-official-food-v1',
  'azuki-official-feelings-v1',
  'azuki-official-work-v1'
);
