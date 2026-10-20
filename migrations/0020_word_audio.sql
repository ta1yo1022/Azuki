CREATE TABLE audio_generation_limits (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(scope, day)
);
CREATE TABLE audio_generation_locks (
  audio_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
