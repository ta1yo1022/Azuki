-- Email addresses are collected only when a verified user opts in.
CREATE TABLE email_subscribers (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL
);
CREATE TABLE email_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','completed','cancelled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT
);
CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id),
  recipient_key TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  consent_at TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('test','broadcast')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','unknown','skipped')),
  attempted_at TEXT,
  provider_id TEXT,
  error_code TEXT,
  UNIQUE(campaign_id,recipient_key)
);
CREATE INDEX email_delivery_queue ON email_deliveries(status,campaign_id);
CREATE INDEX email_delivery_attempts ON email_deliveries(attempted_at);
CREATE INDEX email_subscribers_enabled ON email_subscribers(enabled);
