-- Two tables for the alert channel into juno: what is configured, and what is
-- currently firing.
--
-- `alert_settings` holds one row. The channel describes the deployment — one
-- FreeReps instance reports to one juno — while every other credential in this
-- schema is per user, so a per-user row would ask each user to configure the
-- same thing and leave undefined which of them the watcher follows. The CHECK
-- keeps that single row from becoming several.
--
-- Values are seeded from config.yaml on first start and edited in the Settings
-- UI afterwards: the deployed config names the homelab's ntfy so a fresh
-- database starts out reporting, and the UI owns the value from then on.
CREATE TABLE IF NOT EXISTS alert_settings (
    id                 SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled            BOOLEAN     NOT NULL DEFAULT FALSE,
    ntfy_url           TEXT        NOT NULL DEFAULT '',
    hostname           TEXT        NOT NULL DEFAULT 'freereps',
    check_interval_sec INTEGER     NOT NULL DEFAULT 300,
    failure_threshold  INTEGER     NOT NULL DEFAULT 3,
    apple_silence_sec  INTEGER     NOT NULL DEFAULT 129600,  -- 36 h
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- State per alert condition, so a problem is reported on the transition into it
-- and resolved on the transition out of it rather than on every check.
--
-- The adapter on juno threads one dispatch per monitor_id (homelab repo,
-- STANDARDS.md § "Machine-readable alerts into juno"), so repeating status 0 on
-- every cycle would append to the same thread without adding information. The
-- table is keyed by monitor_id for that reason: one row per condition.
--
-- It carries no user_id either. The conditions are about a data source being
-- reachable, which is a property of the deployment; the affected user ids go
-- into the message.
CREATE TABLE IF NOT EXISTS alert_state (
    monitor_id  INTEGER PRIMARY KEY,
    firing      BOOLEAN     NOT NULL,
    since       TIMESTAMPTZ NOT NULL,
    last_msg    TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
