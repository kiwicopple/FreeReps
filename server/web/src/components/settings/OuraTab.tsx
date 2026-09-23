import { Field, FieldLabel } from "../ui/field";
import PageSection from "../PageSection";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import ConfirmAction from "../ConfirmAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import {
  authorizeOura,
  disconnectOura,
  fetchOuraStatus,
  saveOuraCredentials,
  triggerOuraSync,
  type OuraStatus,
} from "../../api";
import { MONO, RedirectURIRow } from "./parts";

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
      setError(
        e instanceof Error ? e.message : "Failed to start authorization",
      );
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
    <PageSection
      title="Oura"
      description={
        <>
          Oura is polled on a schedule. Register an app at cloud.ouraring.com,
          save its credentials here, then authorize once.
        </>
      }
    >
      {status?.redirect_uri ? (
        <RedirectURIRow uri={status.redirect_uri} />
      ) : null}

      {error ? (
        <Alert variant="error" className="mt-4">
          {error}{" "}
          <Button variant="ghost" type="button" onClick={load}>
            Retry
          </Button>
        </Alert>
      ) : null}

      {!status ? (
        error ? null : (
          <Spinner className="mt-4 size-5" />
        )
      ) : !status.configured ? (
        <div style={{ paddingTop: 20, maxWidth: 520 }}>
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel htmlFor="oura-id">Client ID</FieldLabel>
            <Input
              id="oura-id"

              style={MONO}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Oura client ID"
            />
          </Field>
          <Field style={{ marginBottom: 16 }}>
            <FieldLabel htmlFor="oura-secret">Client secret</FieldLabel>
            <Input
              id="oura-secret"

              style={MONO}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Oura client secret"
            />
          </Field>
          <Button
            variant="default"
            type="button"

            onClick={handleSaveCredentials}
            disabled={saving || !clientId || !clientSecret}
          >
            {saving ? "Saving…" : "Save credentials"}
          </Button>
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
    </PageSection>
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
  onDisconnect: () => Promise<void>;
}) {
  const connected = status.connected;

  return (
    <>
      <div
        style={{
          border: "1px solid var(--border)",
          padding: "22px 24px",
          marginTop: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              background: connected
                ? "var(--primary)"
                : "var(--muted-foreground)",
            }}
          />
          <span style={{ font: "600 14px var(--font-body)" }}>
            {connected ? "Connected" : "Credentials saved"}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {connected ? (
              <Button
                variant="outline"
                type="button"

                style={{ fontSize: 12 }}
                onClick={onSync}
                disabled={syncing}
              >
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            ) : (
              <Button
                variant="default"
                type="button"

                style={{ fontSize: 12 }}
                onClick={onConnect}
              >
                Authorize with Oura
              </Button>
            )}
            <ConfirmAction
              title="Disconnect Oura?"
              description="This removes stored tokens and credentials. Previously imported data remains available."
              onConfirm={onDisconnect}
            />
          </span>
        </div>
        <div
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--muted-foreground)",
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
        <Label className="kick" htmlFor="oura-client">
          Client ID
        </Label>
        <Input
          id="oura-client"

          style={{ ...MONO, marginTop: 8 }}
          value={status.client_id ?? ""}
          readOnly
        />
      </div>

      {status.sync_states && Object.keys(status.sync_states).length > 0 ? (
        <div style={{ paddingTop: 30 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pull schedule</h3>
          <Table style={{ marginTop: 12 }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 200, paddingLeft: 0 }}>
                  Job
                </TableHead>
                <TableHead style={{ paddingRight: 0 }}>Last run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(status.sync_states)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([job, lastSync]) => (
                  <TableRow key={job}>
                    <TableCell
                      style={{
                        font: "500 13.5px var(--font-body)",
                        paddingLeft: 0,
                      }}
                    >
                      {job.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell
                      className="num"
                      style={{
                        ...MONO,
                        color: "var(--muted-foreground)",
                        paddingRight: 0,
                      }}
                    >
                      {lastSync}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
