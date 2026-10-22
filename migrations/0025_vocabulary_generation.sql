CREATE TABLE vocabulary_usage (
 user_id TEXT NOT NULL, week_start TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0),
 PRIMARY KEY(user_id,week_start), CHECK(used+reserved<=500)
);
CREATE TABLE vocabulary_requests (
 user_id TEXT NOT NULL, id TEXT NOT NULL, week_start TEXT NOT NULL,
 input_hash TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 20),
 consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed>=0 AND consumed<=amount),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','failed')),
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 result_json TEXT NOT NULL DEFAULT '' CHECK(length(result_json)<=100000),
 PRIMARY KEY(user_id,id)
);
CREATE INDEX vocabulary_requests_expiry ON vocabulary_requests(status,expires_at);
CREATE TRIGGER vocabulary_reserve_guard BEFORE INSERT ON vocabulary_requests BEGIN
 SELECT CASE WHEN NEW.status<>'pending' OR NEW.consumed<>0 THEN RAISE(ABORT,'VOCABULARY_INVALID_RESERVATION') END;
 SELECT CASE WHEN COALESCE((SELECT used+reserved FROM vocabulary_usage WHERE user_id=NEW.user_id AND week_start=NEW.week_start),0)+NEW.amount>500 THEN RAISE(ABORT,'VOCABULARY_WEEKLY_LIMIT') END;
END;
CREATE TRIGGER vocabulary_reserve AFTER INSERT ON vocabulary_requests BEGIN
 INSERT INTO vocabulary_usage(user_id,week_start,reserved) VALUES(NEW.user_id,NEW.week_start,NEW.amount)
 ON CONFLICT(user_id,week_start) DO UPDATE SET reserved=reserved+NEW.amount;
END;
CREATE TRIGGER vocabulary_settle AFTER UPDATE OF status ON vocabulary_requests
 WHEN OLD.status='pending' AND NEW.status IN ('complete','failed') BEGIN
 UPDATE vocabulary_usage SET reserved=reserved-OLD.amount,used=used+CASE WHEN NEW.status='complete' THEN NEW.consumed ELSE 0 END
 WHERE user_id=OLD.user_id AND week_start=OLD.week_start;
END;
CREATE TABLE vocabulary_rate_limits (
 scope TEXT NOT NULL, bucket TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0),
 PRIMARY KEY(scope,bucket)
);
