import { Field, FieldLabel, FieldDescription, FieldError } from "../ui/field";
import PageSection from "../PageSection";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import NumericField from "../NumericField";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";
import {
  fetchAlerts,
  saveAlertSettings,
  sendTestAlert,
  type AlertCondition,
  type AlertSettings,
} from "../../api";
import { MONO, Row } from "./parts";

/** Seconds as minutes and hours, for the two interval fields. */
const MIN = 60;
const HOUR = 3600;

function describeAge(iso?: string): string {
  if (!iso) return "not checked yet";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function ConditionRow({ c }: { c: AlertCondition }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 border-b py-3">
      <span
        style={{
          width: 10,
          height: 10,
          flex: "none",
          alignSelf: "center",
          background: c.firing ? "var(--primary)" : "var(--input)",
        }}
      />
      <span className="text-sm font-semibold">{c.service}</span>
      <span style={{ ...MONO, fontSize: 12, color: "var(--muted-foreground)" }}>
        {c.monitor_id}
      </span>
      <span
        style={{
          font: "400 12px/1.5 var(--font-body)",
          color: "var(--muted-foreground)",
          flex: 1,
          minWidth: 0,
        }}
      >
        {c.firing ? "reported as a problem" : "quiet"} · checked{" "}
        {describeAge(c.checked_at)}
        {c.last_msg ? ` · ${c.last_msg}` : ""}
      </span>
    </div>
  );
}

export default function AlertsTab() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [conditions, setConditions] = useState<AlertCondition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchAlerts()
      .then((r) => {
        setSettings(r.settings);
        setConditions(r.conditions);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(next: Partial<AlertSettings>) {
    setSettings((s) => (s ? { ...s, ...next } : s));
  }

  const [emptyFields, setEmptyFields] = useState<Set<string>>(new Set());
  function patchNumber(
    key: "check_interval_sec" | "failure_threshold" | "apple_silence_sec",
    value: number | null,
    scale: number,
    min: number,
  ) {
    setEmptyFields((old) => {
      const next = new Set(old);
      if (value === null) next.add(key);
      else next.delete(key);
      return next;
    });
    if (value !== null) patch({ [key]: Math.max(min, value) * scale });
  }
  async function handleSave() {
    if (!settings || emptyFields.size) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveAlertSettings(settings);
      setNotice("Saved. The next check cycle uses these values.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const r = await sendTestAlert();
      setNotice(
        `Test message sent to ${r.target} on monitor_id ${r.monitor_id}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <PageSection
      title="Alerts"
      description={
        <>
          A data source that stops delivering is reported to an{" "}
          <a href="https://ntfy.sh" target="_blank" rel="noreferrer">
            ntfy
          </a>{" "}
          topic, so a silent integration surfaces without anyone reading the
          import log. The payload follows Uptime Kuma's webhook shape, and each
          condition carries its own monitor id — a receiver can group by it.
          Stored in the database, not in the config file.
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

      {notice ? (
        <Alert variant="success" role="status" className="mt-4">
          {notice}
        </Alert>
      ) : null}

      {!settings ? (
        error ? null : (
          <Spinner className="mt-4 size-5" />
        )
      ) : (
        <>
          <div style={{ paddingTop: 12, maxWidth: 640 }}>
            <Row label="Reporting">
              <label
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => patch({ enabled: checked })}
                />
                <span style={{ font: "400 13px var(--font-body)" }}>
                  {settings.enabled
                    ? "Conditions are reported"
                    : "Nothing is reported"}
                </span>
              </label>
            </Row>

            <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                ntfy topic URL
              </FieldLabel>
              <div className="min-w-0 space-y-2">
                <Input
                  style={{ ...MONO, width: "100%" }}
                  type="url"
                  aria-label="ntfy topic URL"
                  value={settings.ntfy_url}
                  onChange={(e) => patch({ ntfy_url: e.target.value })}
                  placeholder="https://ntfy.example.com/freereps-alerts"
                />
                <FieldDescription>
                  The full topic URL, including the topic name — that name is
                  what a subscriber listens on. Any endpoint accepting an
                  ntfy-style POST works; the body is JSON either way.
                </FieldDescription>
                <FieldError />
              </div>
            </Field>

            <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                Reported as
              </FieldLabel>
              <div className="min-w-0 space-y-2">
                <Input
                  style={{ ...MONO, width: 260, maxWidth: "100%" }}
                  aria-label="Reported as"
                  value={settings.hostname}
                  onChange={(e) => patch({ hostname: e.target.value })}
                  placeholder="freereps"
                />
                <FieldDescription>
                  Fills the payload's <code>hostname</code>, so a receiver can
                  tell a test instance from the production one.
                </FieldDescription>
                <FieldError />
              </div>
            </Field>

            <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                Check interval in minutes
              </FieldLabel>
              <div className="min-w-0 space-y-2">
                <span
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <NumericField
                    required
                    aria-label="Check interval in minutes"
                    className="max-w-28"
                    min={1}
                    value={
                      emptyFields.has("check_interval_sec")
                        ? null
                        : Math.round(settings.check_interval_sec / MIN)
                    }
                    onValueChange={(value) =>
                      patchNumber("check_interval_sec", value, MIN, 1)
                    }
                  />
                  <span style={{ font: "400 13px var(--font-body)" }}>
                    minutes
                  </span>
                </span>
                <FieldError />
              </div>
            </Field>

            <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                Failures before alert
              </FieldLabel>
              <div className="min-w-0 space-y-2">
                <span
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <NumericField
                    required
                    aria-label="Failures before alert"
                    className="max-w-28"
                    min={1}
                    value={
                      emptyFields.has("failure_threshold")
                        ? null
                        : settings.failure_threshold
                    }
                    onValueChange={(value) =>
                      patchNumber("failure_threshold", value, 1, 1)
                    }
                  />
                  <span
                    style={{
                      font: "400 12px/1.5 var(--font-body)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    consecutive failed runs of one source for one user. At a
                    30-minute sync interval, 3 means a defect is reported within
                    two hours while a single DNS timeout is not.
                  </span>
                </span>
                <FieldError />
              </div>
            </Field>

            <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                Apple Health silence in hours
              </FieldLabel>
              <div className="min-w-0 space-y-2">
                <span
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <NumericField
                    required
                    aria-label="Apple Health silence in hours"
                    className="max-w-28"
                    min={0}
                    value={
                      emptyFields.has("apple_silence_sec")
                        ? null
                        : Math.round(settings.apple_silence_sec / HOUR)
                    }
                    onValueChange={(value) =>
                      patchNumber("apple_silence_sec", value, HOUR, 0)
                    }
                  />
                  <span
                    style={{
                      font: "400 12px/1.5 var(--font-body)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    hours without a Health Auto Export delivery before the
                    ingress counts as down. 0 turns the rule off.
                  </span>
                </span>
                <FieldError />
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap gap-2 pt-5">
            <Button
              variant="default"
              type="button"

              onClick={handleSave}
              disabled={saving || emptyFields.size > 0}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              type="button"

              onClick={handleTest}
              disabled={testing || !settings.ntfy_url}
            >
              {testing ? "Sending…" : "Send test message"}
            </Button>
          </div>

          <div style={{ paddingTop: 30, maxWidth: 640 }}>
            <span className="kick">Conditions</span>
            <div style={{ marginTop: 10 }}>
              {conditions.map((c) => (
                <ConditionRow key={c.monitor_id} c={c} />
              ))}
            </div>
          </div>
        </>
      )}
    </PageSection>
  );
}
