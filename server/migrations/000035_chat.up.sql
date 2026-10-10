-- One private conversation per user. Images are deliberately never persisted.
CREATE TABLE chat_credentials (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    api_key TEXT NOT NULL
);
CREATE TABLE chat_turns (
    sequence BIGSERIAL UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    id UUID NOT NULL,
    request_hash TEXT NOT NULL,
    message TEXT NOT NULL,
    image_count INTEGER NOT NULL DEFAULT 0,
    timezone TEXT NOT NULL,
    local_date DATE NOT NULL,
    reply TEXT NOT NULL DEFAULT '',
    food_request JSONB,
    saved_entry_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','prepared','complete')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id,id)
);
CREATE INDEX chat_turns_user_sequence ON chat_turns(user_id,sequence DESC);
