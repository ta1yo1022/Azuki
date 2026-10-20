CREATE TABLE billing_rate_limits (
 user_id TEXT NOT NULL,
 minute TEXT NOT NULL,
 amount INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,minute)
);
