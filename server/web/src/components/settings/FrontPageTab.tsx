import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  fetchFrontPage,
  saveFrontPageHeroes,
  saveMetricVisibility,
} from "../../api";
import { useAvailableMetrics } from "../../hooks/useMetrics";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { TabHeader } from "./parts";

const HERO_COUNT = 4;

/**
 * What makes the lean dashboard configurable: which four metrics become hero
 * numbers, and which ones the table lists at all. Fewer metrics means a smaller
 * first request.
 */
export default function FrontPageTab() {
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const metrics = useAvailableMetrics();
  const { options, isLoading } = metrics;
  const frontPage = useQuery({
    queryKey: ["front-page", "30d"],
    queryFn: () => fetchFrontPage("30d"),
    staleTime: 60_000,
  });

  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [heroes, setHeroes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || options.length === 0 || !frontPage.data) return;
    const init: Record<string, boolean> = {};
    for (const m of options) init[m.value] = m.visible;
    setVisible(init);
    setHeroes(frontPage.data.heroes.slice(0, HERO_COUNT));
    setLoaded(true);
  }, [loaded, options, frontPage.data]);

  const labelFor = (name: string) =>
    options.find((o) => o.value === name)?.label ?? name;

  const toggleVisible = (name: string) =>
    setVisible((prev) => ({ ...prev, [name]: !prev[name] }));

  const toggleHero = (name: string) =>
    setHeroes((prev) =>
      prev.includes(name)
        ? prev.filter((h) => h !== name)
        : prev.length < HERO_COUNT
          ? [...prev, name]
          : prev,
    );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveMetricVisibility(visible);
      if (heroes.length === HERO_COUNT) await saveFrontPageHeroes(heroes);
      queryClient.invalidateQueries({ queryKey: ["available-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["front-page"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const init: Record<string, boolean> = {};
    for (const m of options) init[m.value] = m.visible;
    setVisible(init);
    setHeroes(frontPage.data?.heroes.slice(0, HERO_COUNT) ?? []);
  }

  if (!loaded && (metrics.error || frontPage.error))
    return (
      <Alert variant="error">
        {metrics.error?.message || frontPage.error?.message}
        <Button
          variant="ghost"
          onClick={() => {
            void metrics.refetch();
            void frontPage.refetch();
          }}
        >
          Retry
        </Button>
      </Alert>
    );
  if (metrics.isSuccess && options.length === 0)
    return (
      <Empty>
        No metrics available yet. Import health data to configure the front
        page.
      </Empty>
    );
  if (isLoading || !loaded)
    return <Spinner className="my-4 size-5" aria-label="Loading metrics" />;

  const visibleCount = Object.values(visible).filter(Boolean).length;

  return (
    <>
      <TabHeader title="Front page">
        Pick the four hero numbers and which metrics the table lists. Fewer
        metrics means a smaller first request.
      </TabHeader>

      <div style={{ paddingTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Hero numbers</h3>
        <p
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--muted-foreground)",
            margin: "6px 0 12px",
          }}
        >
          {heroes.length} of {HERO_COUNT} chosen
          {heroes.length !== HERO_COUNT ? " — pick exactly four to save" : ""}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {heroes.map((name) => (
            <Button
              variant="outline"
              key={name}
              type="button"
              onClick={() => toggleHero(name)}
              style={{
                border: "1px solid var(--primary)",
                background: "var(--success-soft)",
                color: "var(--foreground)",
                padding: "8px 12px",
                font: "500 13px var(--font-body)",
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              {labelFor(name)} ×
            </Button>
          ))}
          {heroes.length < HERO_COUNT ? (
            <span
              style={{
                border: "1px dashed var(--border)",
                color: "var(--muted-foreground)",
                padding: "8px 12px",
                font: "500 13px var(--font-body)",
              }}
            >
              + Add below
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ paddingTop: 26 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Table metrics</h3>
        <p
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--muted-foreground)",
            margin: "6px 0 4px",
          }}
        >
          {visibleCount} of {options.length} listed
        </p>

        <div style={{ borderTop: "2px solid var(--foreground)" }}>
          {options.map((m) => {
            const on = visible[m.value] ?? false;
            const isHero = heroes.includes(m.value);
            return (
              <div
                key={m.value}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 14,
                  padding: "11px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {isDesktop ? (
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => toggleVisible(m.value)}
                    aria-label={`List ${m.label}`}
                  />
                ) : (
                  <Switch
                    checked={on}
                    onCheckedChange={() => toggleVisible(m.value)}
                    aria-label={`List ${m.label}`}
                  />
                )}
                <span
                  style={{
                    font: "500 13.5px var(--font-body)",
                    color: on ? "var(--foreground)" : "var(--muted-foreground)",
                    flex: 1,
                  }}
                >
                  {m.label}
                </span>
                <span className="kick" style={{ width: 120, flex: "none" }}>
                  {m.category}
                </span>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => toggleHero(m.value)}
                  disabled={!isHero && heroes.length >= HERO_COUNT}

                  style={{ fontSize: 11.5, flex: "none" }}
                >
                  {isHero ? "Hero ×" : "Make hero"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <Alert variant="error" style={{ fontSize: 13, marginTop: 14 }}>
          {error}
        </Alert>
      ) : null}

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 20 }}
      >
        <Button
          variant="default"
          type="button"

          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" type="button" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
    </>
  );
}
