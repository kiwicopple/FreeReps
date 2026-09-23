import { useCallback, useEffect, useState } from "react";
import {
  disconnectHevy,
  fetchHevyStatus,
  saveHevyCredentials,
  triggerHevySync,
  type HevyStatus,
} from "../../api";
import { MONO, TabHeader } from "./parts";

/** Today as YYYY-MM-DD, the default ingest cutoff. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HevyTab() {
  const [status, setStatus] = useState<HevyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [syncFrom, setSyncFrom] = useState(today());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchHevyStatus()
      .then((s) => {
        setStatus(s);
        if (s.sync_from) setSyncFrom(s.sync_from);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveHevyCredentials(apiKey, syncFrom);
      setApiKey("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save API key");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await triggerHevySync();
      setTimeout(load, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Disconnect Hevy? The API key is removed. Sets already imported stay in the database.",
      )
    ) {
      return;
    }
    try {
      await disconnectHevy();
      setApiKey("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  return (
    <>
      <TabHeader title="Hevy">
        Hevy's event feed is polled on a schedule. API access needs an active
        Hevy Pro subscription; create a key at hevy.com/settings.
      </TabHeader>

      {error ? (
        <p
          style={{
            color: "var(--success-foreground)",
            fontSize: 13,
            paddingTop: 16,
          }}
        >
          {error}{" "}
          <button type="button" className="btn btn-ghost" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}

      {!status ? (
        <p
          style={{
            color: "var(--muted-foreground)",
            fontSize: 13,
            paddingTop: 16,
          }}
        >
          Loading…
        </p>
      ) : !status.configured ? (
        <div style={{ paddingTop: 20, maxWidth: 520 }}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="hevy-key">API key</label>
            <input
              id="hevy-key"
              className="input"
              style={MONO}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Hevy API key"
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="hevy-from">Import from</label>
            <input
              id="hevy-from"
              className="input"
              style={MONO}
              type="date"
              value={syncFrom}
              onChange={(e) => setSyncFrom(e.target.value)}
            />
            <p
              style={{
                font: "400 12px/1.5 var(--font-body)",
                color: "var(--muted-foreground)",
                margin: "6px 0 0",
              }}
            >
              Workouts that started before this date are ignored. Keep it at the
              switchover date so an Alpha Progression history later uploaded to
              Hevy cannot be counted a second time.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !apiKey}
          >
            {saving ? "Verifying…" : "Save API key"}
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              border: "2px solid var(--foreground)",
              padding: "22px 24px",
              marginTop: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  background: "var(--primary)",
                }}
              />
              <span style={{ font: "600 14px var(--font-body)" }}>Connected</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12 }}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={handleDisconnect}
                >
                  Disconnect
                </button>
              </span>
            </div>
            <div
              style={{
                font: "400 12px var(--font-body)",
                color: "var(--muted-foreground)",
                marginTop: 8,
              }}
            >
              Importing workouts from {status.sync_from}
              {status.last_sync
                ? ` · last sync ${new Date(status.last_sync).toLocaleString("en-GB")}`
                : ""}
            </div>
          </div>

          <div style={{ paddingTop: 24, maxWidth: 520 }}>
            <label className="kick" htmlFor="hevy-replace">
              Replace API key
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                id="hevy-replace"
                className="input"
                style={MONO}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="New Hevy API key"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSave}
                disabled={saving || !apiKey}
              >
                {saving ? "Verifying…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
