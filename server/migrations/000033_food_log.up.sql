-- Food records are separate from device health metrics: provenance and revisions
-- must survive corrections, and missing nutrients must never become zero.
CREATE TABLE food_entries (
    user_id INTEGER NOT NULL REFERENCES users(id),
    id UUID NOT NULL,
    local_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('recorded', 'voided')),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id)
);
CREATE INDEX food_entries_user_date ON food_entries (user_id, local_date);
CREATE TABLE food_entry_revisions (
    user_id INTEGER NOT NULL,
    entry_id UUID NOT NULL,
    version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    reason TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, entry_id, version),
    FOREIGN KEY (user_id, entry_id) REFERENCES food_entries(user_id, id)
);
