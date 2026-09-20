import { useCallback, useEffect, useState } from "react";
import {
  authorizeOura,
  disconnectOura,
  fetchOuraStatus,
  saveOuraCredentials,
  triggerOuraSync,
  type OuraStatus,
} from "../../api";
import { MONO, RedirectURIRow, TabHeader } from "./parts";

export default function OuraTab() {
  const [status, setStatus] = useState<OuraStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchOuraStatus()
      .then((s) => {
        setStatus(s);
        if (s.client_id) setClientId(s.client_id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The OAuth callback redirects back here with an error in the query string.
  useEffect(() => {
    const ouraError = new URLSearchParams(window.location.search).get("error");
    if (ouraError) setError(`Oura authorization failed: ${ouraError}`);
  }, []);

  async function handleSaveCredentials() {
    setSaving(true);
    setError(null);
    try {
      await saveOuraCredentials(clientId, clientSecret);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    try {
      const { authorize_url } = await authorizeOura();
      window.location.href = authorize_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start authorization");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerOuraSync();
      setTimeout(load, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm("Disconnect Oura Ring? This removes stored tokens and credentials.")
    ) {
      return;
    }
    try {
      await disconnectOura();
      setClientId("");
      setClientSecret("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  return (
    <>
      <TabHeader title="Oura">
        Oura is polled on a schedule. Register an app at
        cloud.ouraring.com, save its credentials here, then authorize once.
      </TabHeader>

      {status?.redirect_uri ? <RedirectURIRow uri={status.redirect_uri} /> : null}

      {error ? (
        <p
          style={{
            color: "var(--color-accent-700)",
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
            color: "var(--color-neutral-600)",
            fontSize: 13,
            paddingTop: 16,
          }}
        >
          Loading…
        </p>
      ) : !status.configured ? (
        <div style={{ paddingTop: 20, maxWidth: 520 }}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="oura-id">Client ID</label>
            <input
              id="oura-id"
              className="input"
              style={MONO}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Oura client ID"
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="oura-secret">Client secret</label>
            <input
              id="oura-secret"
              className="input"
              style={MONO}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Oura client secret"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveCredentials}
            disabled={saving || !clientId || !clientSecret}
          >
            {saving ? "Saving…" : "Save credentials"}
          </button>
        </div>
      ) : (
        <StatusPanel
          status={status}
          syncing={syncing}
          onSync={handleSync}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      )}
    </>
  );
}

function StatusPanel({
  status,
  syncing,
  onSync,
  onConnect,
  onDisconnect,
}: {
  status: OuraStatus;
  syncing: boolean;
  onSync: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = status.connected;

  return (
    <>
      <div
        style={{
          border: "2px solid var(--color-text)",
          padding: "22px 24px",
          marginTop: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 11,
              height: 11,
              background: connected
                ? "var(--color-accent)"
                : "var(--color-neutral-500)",
            }}
          />
          <span style={{ font: "600 14px var(--font-body)" }}>
            {connected ? "Connected" : "Credentials saved"}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {connected ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
                onClick={onSync}
                disabled={syncing}
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 12 }}
                onClick={onConnect}
              >
                Authorize with Oura
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </span>
        </div>
        <div
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--color-neutral-600)",
            marginTop: 8,
          }}
        >
          {connected
            ? status.expires_at
              ? `Token valid until ${new Date(status.expires_at).toLocaleString("en-GB")}`
              : "Token stored"
            : "Not authorized yet — the app cannot read your data until you do."}
        </div>
      </div>

      <div style={{ paddingTop: 20, maxWidth: 520 }}>
        <label className="kick" htmlFor="oura-client">
          Client ID
        </label>
        <input
          id="oura-client"
          className="input"
          style={{ ...MONO, marginTop: 8 }}
          value={status.client_id ?? ""}
          readOnly
        />
      </div>

      {status.sync_states && Object.keys(status.sync_states).length > 0 ? (
        <div style={{ paddingTop: 30 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pull schedule</h3>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 200, paddingLeft: 0 }}>Job</th>
                <th style={{ paddingRight: 0 }}>Last run</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(status.sync_states)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([job, lastSync]) => (
                  <tr key={job}>
                    <td style={{ font: "500 13.5px var(--font-body)", paddingLeft: 0 }}>
                      {job.replace(/_/g, " ")}
                    </td>
                    <td
                      className="num"
                      style={{
                        ...MONO,
                        color: "var(--color-neutral-700)",
                        paddingRight: 0,
                      }}
                    >
                      {lastSync}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
