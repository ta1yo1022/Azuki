CREATE TABLE deck_reports (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  deck_title TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('copyright','harmful','spam','inaccurate','other')),
  details TEXT NOT NULL DEFAULT '' CHECK(length(details)<=1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
  admin_note TEXT NOT NULL DEFAULT '' CHECK(length(admin_note)<=1000),
  reviewed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(reporter_id, deck_id)
);
CREATE INDEX deck_reports_queue ON deck_reports(status,created_at DESC,id DESC);
CREATE INDEX deck_reports_reporter_time ON deck_reports(reporter_id,created_at);
CREATE TRIGGER deck_reports_rate_limit BEFORE INSERT ON deck_reports
WHEN (SELECT count(*) FROM deck_reports WHERE reporter_id=NEW.reporter_id AND created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day'))>=5
BEGIN
  SELECT RAISE(ABORT,'AZUKI_REPORT_LIMIT');
END;
