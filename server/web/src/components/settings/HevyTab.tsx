import { localToday } from "../../utils/localDate";
import { Field, FieldLabel } from "../ui/field";
import PageSection from "../PageSection";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import ConnectionMenu from "./ConnectionMenu";
import DateControl from "@/components/DateControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";
import {
  disconnectHevy,
  fetchHevyStatus,
  saveHevyCredentials,
  triggerHevySync,
  type HevyStatus,
} from "../../api";
import { MONO } from "./parts";

/** Today as YYYY-MM-DD, the default ingest cutoff. */
function today(): string {
  return localToday();
}

export default function HevyTab() {
  const [status, setStatus] = useState<HevyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [syncFrom, setSyncFrom] = useState(today());
  const [saving, setSaving] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

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
      setEditingCredentials(false);
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
    try {
      await disconnectHevy();
      setApiKey("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  return (
    <PageSection
      title="Hevy"
      description={
        <>
          Hevy's event feed is polled on a schedule. API access needs an active
          Hevy Pro subscription; create a key at hevy.com/settings.
        </>
      }
    >
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
        <div className="mt-5 max-w-lg space-y-4">
          <Field className="mb-4">
            <FieldLabel htmlFor="hevy-key">API key</FieldLabel>
            <Input
              id="hevy-key"

              style={MONO}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Hevy API key"
            />
          </Field>
          <Field className="mb-4">
            <FieldLabel htmlFor="hevy-from">Import from</FieldLabel>
            <DateControl
              id="hevy-from"
              aria-label="Import from"
              style={MONO}

              value={syncFrom}
              onValueChange={(value) => setSyncFrom(value)}
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
          </Field>
          <Button
            variant="default"
            type="button"

            onClick={handleSave}
            disabled={saving || !apiKey}
            loading={saving}
          >
            {saving ? "Verifying…" : "Save API key"}
          </Button>
        </div>
      ) : (
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
                  background: "var(--primary)",
                }}
              />
              <span style={{ font: "600 14px var(--font-body)" }}>
                Connected
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Button
                  variant="outline"
                  type="button"

                  style={{ fontSize: 12 }}
                  onClick={handleSync}
                  disabled={syncing}
                  loading={syncing}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
                <ConnectionMenu
                  provider="Hevy"
                  onEdit={() => setEditingCredentials(true)}
                  description="The API key is removed. Previously imported sets remain available."
                  onDisconnect={handleDisconnect}
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
              Importing workouts from {status.sync_from}
              {status.last_sync
                ? ` · last sync ${new Date(status.last_sync).toLocaleString("en-GB")}`
                : ""}
            </div>
          </div>

          {editingCredentials && (
            <div className="mt-6 max-w-lg">
              <Label className="kick" htmlFor="hevy-replace">
                Replace API key
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Input
                  autoFocus
                  id="hevy-replace"

                  style={MONO}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="New Hevy API key"
                />
                <Button
                  variant="outline"
                  type="button"

                  onClick={handleSave}
                  disabled={saving || !apiKey}
                  loading={saving}
                >
                  {saving ? "Verifying…" : "Save"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setEditingCredentials(false);
                  requestAnimationFrame(() =>
                    document.getElementById("hevy-manage")?.focus(),
                  );
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
    </PageSection>
  );
}
