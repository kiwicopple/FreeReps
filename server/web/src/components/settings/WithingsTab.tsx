import { Field, FieldLabel } from "../ui/field";
import PageSection from "../PageSection";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import ConnectionMenu from "./ConnectionMenu";
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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  authorizeWithings,
  disconnectWithings,
  fetchWithingsStatus,
  saveWithingsCredentials,
  triggerWithingsSync,
  type WithingsStatus,
} from "../../api";
import { MONO, RedirectURIRow } from "./parts";

export default function WithingsTab() {
  const credentialsDirty = useRef(false);
  const [status, setStatus] = useState<WithingsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchWithingsStatus()
      .then((s) => {
        setStatus(s);
        if (s.client_id && !credentialsDirty.current) setClientId(s.client_id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The OAuth callback redirects back here with an error in the query string.
  useEffect(() => {
    const withingsError = new URLSearchParams(window.location.search).get(
      "error",
    );
    if (withingsError)
      setError(`Withings authorization failed: ${withingsError}`);
  }, []);

  async function handleSaveCredentials() {
    setSaving(true);
    setError(null);
    try {
      await saveWithingsCredentials(clientId, clientSecret);
      credentialsDirty.current = false;
      setClientSecret("");
      setEditingCredentials(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    try {
      const { authorize_url } = await authorizeWithings();
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
      await triggerWithingsSync();
      setTimeout(load, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectWithings();
      setClientId("");
      setClientSecret("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  return (
    <PageSection
      title="Withings"
      description={
        <>
          Weight, body composition and blood pressure are read directly on a
          schedule. Register an app at developer.withings.com, save its
          credentials here, then authorize once. The same measurements keep
          arriving through Apple Health; where both cover a day, Withings wins
          by source priority.
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
      ) : !status.configured || editingCredentials ? (
        <div className="mt-5 max-w-lg space-y-4">
          <Field className="mb-4">
            <FieldLabel htmlFor="withings-id">Client ID</FieldLabel>
            <Input
              autoFocus={editingCredentials}
              id="withings-id"

              style={MONO}
              value={clientId}
              onChange={(e) => {
                credentialsDirty.current = true;
                setClientId(e.target.value);
              }}
              placeholder="Withings client ID"
            />
          </Field>
          <Field className="mb-4">
            <FieldLabel htmlFor="withings-secret">Client secret</FieldLabel>
            <Input
              id="withings-secret"

              style={MONO}
              type="password"
              value={clientSecret}
              onChange={(e) => {
                credentialsDirty.current = true;
                setClientSecret(e.target.value);
              }}
              placeholder="Withings client secret"
            />
          </Field>
          <Button
            variant="default"
            type="button"

            onClick={handleSaveCredentials}
            disabled={saving || !clientId || !clientSecret}
            loading={saving}
          >
            {saving ? "Saving…" : "Save credentials"}
          </Button>
          {status.configured && (
            <Button
              variant="ghost"
              className="ml-2"
              onClick={() => {
                setEditingCredentials(false);
                requestAnimationFrame(() =>
                  document.getElementById("withings-manage")?.focus(),
                );
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <StatusPanel
          status={status}
          syncing={syncing}
          onSync={handleSync}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onEdit={() => setEditingCredentials(true)}
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
  onEdit,
}: {
  status: WithingsStatus;
  syncing: boolean;
  onSync: () => void;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onEdit: () => void;
}) {
  const connected = status.connected;

  return (
    <>
      <div className="mt-5 rounded-xl bg-muted p-4">
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
                loading={syncing}
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
                Authorize with Withings
              </Button>
            )}
            <ConnectionMenu
              provider="Withings"
              onEdit={onEdit}
              description="This removes stored tokens and credentials. Previously imported data remains available."
              onDisconnect={onDisconnect}
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

      <div className="mt-5 max-w-lg space-y-4">
        <Label className="kick" htmlFor="withings-client">
          Client ID
        </Label>
        <Input
          id="withings-client"

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
                <TableHead style={{ paddingRight: 0 }}>
                  Delta resumes from
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(status.sync_states)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([job, lastUpdate]) => (
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
                      {new Date(lastUpdate).toLocaleString("en-GB")}
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
