import { ArrowUp, ArrowDown } from "lucide-react";
import PageSection from "../PageSection";
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
      <PageSection title="Front page">
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
      </PageSection>
    );
  if (metrics.isSuccess && options.length === 0)
    return (
      <PageSection title="Front page">
        <Empty>
          No metrics available yet. Import health data to configure the front
          page.
        </Empty>
      </PageSection>
    );
  if (isLoading || !loaded)
    return (
      <PageSection title="Front page">
        <Spinner className="my-4 size-5" aria-label="Loading metrics" />
      </PageSection>
    );

  const visibleCount = Object.values(visible).filter(Boolean).length;

  return (
    <PageSection
      title="Front page"
      description={
        <>Choose four highlights and which metrics appear in All metrics.</>
      }
    >
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Hero numbers</h3>
        <p className="text-sm text-muted-foreground">
          {heroes.length} of {HERO_COUNT} chosen
          {heroes.length !== HERO_COUNT ? " — pick exactly four to save" : ""}
        </p>
        <ol className="divide-y rounded-lg border px-3">
          {heroes.map((name, index) => (
            <li key={name} className="flex items-center gap-2 py-2">
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <Button
                variant="ghost"
                className="min-w-0 flex-1 justify-start whitespace-normal text-left"
                onClick={() => toggleHero(name)}
                disabled={saving}
              >
                {labelFor(name)} ×
              </Button>
              {([-1, 1] as const).map((direction) => (
                <Button
                  key={direction}
                  variant="ghost"
                  size="icon"
                  disabled={
                    saving ||
                    index + direction < 0 ||
                    index + direction >= heroes.length
                  }
                  aria-label={`Move ${labelFor(name)} ${direction < 0 ? "up" : "down"}`}
                  onClick={() =>
                    setHeroes((previous) => {
                      const next = [...previous];
                      [next[index], next[index + direction]] = [
                        next[index + direction],
                        next[index],
                      ];
                      return next;
                    })
                  }
                >
                  {direction < 0 ? <ArrowUp /> : <ArrowDown />}
                </Button>
              ))}
            </li>
          ))}
        </ol>
        {heroes.length < HERO_COUNT && (
          <p className="text-xs text-muted-foreground">
            Add a highlight from the list below.
          </p>
        )}
      </div>
      <div className="space-y-3 pt-6">
        <h3 className="text-sm font-semibold">Table metrics</h3>
        <p className="text-sm text-muted-foreground">
          {visibleCount} of {options.length} listed
        </p>
        <div className="divide-y border-y">
          {options.map((m) => {
            const on = visible[m.value] ?? false;
            const isHero = heroes.includes(m.value);
            const Toggle = isDesktop ? Checkbox : Switch;
            return (
              <div key={m.value} className="flex items-center gap-3 py-3">
                <Toggle
                  checked={on}
                  disabled={saving}
                  onCheckedChange={() => toggleVisible(m.value)}
                  aria-label={`List ${m.label}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      on
                        ? "text-sm font-medium"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {m.label}
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {m.category.replace(/_/g, " ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleHero(m.value)}
                  disabled={saving || (!isHero && heroes.length >= HERO_COUNT)}
                >
                  {isHero ? "Hero ×" : "Make hero"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap gap-3 pt-5">
        <Button onClick={save} disabled={saving} loading={saving}>
          Save
        </Button>
        <Button variant="ghost" onClick={reset} disabled={saving}>
          Reset to defaults
        </Button>
      </div>
    </PageSection>
  );
}
