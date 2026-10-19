-- Additional examples are stored with their word. Legacy example text, hashes and counters remain intact.
ALTER TABLE words ADD COLUMN examples_json TEXT NOT NULL DEFAULT '[]'
  CHECK(json_valid(examples_json) AND json_type(examples_json)='array' AND json_array_length(examples_json)<=10);
