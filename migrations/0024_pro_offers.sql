CREATE TABLE pro_offers (
 code TEXT PRIMARY KEY,
 active INTEGER NOT NULL DEFAULT 1,
 starts_at INTEGER NOT NULL DEFAULT 0,
 ends_at INTEGER
);
CREATE TABLE pro_offer_redemptions (
 user_id TEXT NOT NULL,
 livemode INTEGER NOT NULL,
 code TEXT NOT NULL REFERENCES pro_offers(code),
 redeemed_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,livemode)
);
INSERT INTO pro_offers(code) VALUES('AZUKI1MONTH');
