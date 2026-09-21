-- Immutable protocol versions preserve the target used for historical dates.
CREATE TABLE nutrition_protocols (
 user_id INTEGER NOT NULL REFERENCES users(id),
 version INTEGER NOT NULL CHECK (version > 0),
 effective_date DATE NOT NULL,
 payload JSONB NOT NULL,
 reason TEXT NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,version)
);
CREATE INDEX nutrition_protocols_date ON nutrition_protocols(user_id,effective_date,version);
CREATE TABLE nutrition_days (
 user_id INTEGER NOT NULL REFERENCES users(id),
 local_date DATE NOT NULL,
 complete BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,local_date)
);
