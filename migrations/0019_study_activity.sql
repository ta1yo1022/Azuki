CREATE TABLE study_activity (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_id TEXT NOT NULL,
 day TEXT NOT NULL,
 session_id TEXT NOT NULL,
 deck_id TEXT NOT NULL,
 deck_title TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('words','examples','book')),
 started_at INTEGER NOT NULL,
 ended_at INTEGER NOT NULL,
 milliseconds INTEGER NOT NULL CHECK(milliseconds BETWEEN 1 AND 60000),
 PRIMARY KEY(user_id,event_id,day)
);
CREATE INDEX study_activity_user_day ON study_activity(user_id,day);
