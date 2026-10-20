CREATE TABLE billing_customers (
 user_id TEXT NOT NULL,
 livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
 customer_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,livemode)
);
CREATE TABLE billing_subscriptions (
 subscription_id TEXT PRIMARY KEY,
 customer_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
 price_id TEXT NOT NULL,
 status TEXT NOT NULL,
 period_end INTEGER NOT NULL DEFAULT 0,
 cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
CREATE INDEX billing_user ON billing_subscriptions(user_id,livemode,status);
CREATE TABLE billing_sync_locks (customer_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE billing_checkouts (
 user_id TEXT NOT NULL,
 livemode INTEGER NOT NULL,
 attempt_id TEXT NOT NULL,
 session_id TEXT NOT NULL DEFAULT '',
 checkout_url TEXT NOT NULL DEFAULT '',
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,livemode)
);
