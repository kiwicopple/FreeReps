import PageSection from "@/components/PageSection";
import SummaryValue, { SummaryGrid } from "@/components/SummaryValue";
import { Label } from "@/components/ui/label";
import Choice from "../components/Choice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { metricLabel } from "../utils/metricLabel";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchMetricStats,
  fetchTimeSeries,
  type TimeSeriesPoint,
} from "../api";
import DesktopOnly from "../components/DesktopOnly";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import MetricChart from "../components/metrics/MetricChart";
import { useAvailableMetrics } from "../hooks/useMetrics";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { formatNumber } from "../utils/format";
import { queryMessage, queryState } from "../utils/queryState";

const RANGES = ["1d", "7d", "30d", "90d", "1y"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export default function MetricsPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const { options, groups, lookup } = useAvailableMetrics();

  const range = (params.get("range") as Range) ?? "90d";
  const metric = params.get("metric") ?? "";

  // Land on something rather than an empty pane when no metric is in the URL.
  useEffect(() => {
    if (metric || options.length === 0) return;
    const preferred =
      options.find((m) => m.value === "heart_rate_variability") ?? options[0];
    const p = new URLSearchParams(params);
    p.set("metric", preferred.value);
    setParams(p, { replace: true });
  }, [metric, options, params, setParams]);

  const days = RANGE_DAYS[range];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const endISO = end.toISOString().split("T")[0];
  const startISO = start.toISOString().split("T")[0];

  const selected = lookup.get(metric);
  const multiplier = selected?.multiplier ?? 1;
  // A counter's headline figure is the range total, not a per-sample average.
  // The API field is called avg for both classes because the MCP tools ship the
  // same struct, so the label is decided here.
  const isCumulative = selected?.isCumulative ?? false;
  const agg = range === "1d" ? "hourly" : "daily";

  const seriesQuery = useQuery({
    queryKey: ["timeseries", metric, startISO, endISO, agg],
    queryFn: () => fetchTimeSeries(metric, startISO, endISO, agg),
    enabled: !!metric && isDesktop,
  });

  const statsQuery = useQuery({
    queryKey: ["metric-stats", metric, startISO, endISO],
    queryFn: () => fetchMetricStats(metric, startISO, endISO),
    enabled: !!metric && isDesktop,
  });

  if (!isDesktop) return <DesktopOnly title="Metrics" />;

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    p.set(key, value);
    setParams(p, { replace: true });
  };

  const state = queryState(seriesQuery);
  const message = queryMessage(state, seriesQuery.error);
  const stats = statsQuery.data;
  const points = seriesQuery.data ?? [];
  const latest = [...points].reverse().find((p) => p.avg != null)?.avg ?? null;

  return (
    <>
      <PageHeader
        title="Metrics"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={(v) => setParam("range", v)}
            name="metrics-range"
          />
        }
      />

      <div className="page-x grid min-w-0 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <Label
            className="mb-3 block text-sm font-medium"
            htmlFor="metric-choice"
          >
            {options.length} metrics
          </Label>
          <Choice
            searchable
            id="metric-choice"
            aria-label="Metric"
            value={metric}
            onValueChange={(value) => setParam("metric", value)}
            options={groups.flatMap((group) =>
              group.metrics.map((item) => ({
                value: item.value,
                label: item.label,
                group: group.label,
              })),
            )}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          <PageSection
            title={selected?.label ?? (metric ? metricLabel(metric) : "—")}
            description={[selected?.unit, `${days} days`, `${agg} aggregate`]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <Button
                variant="outline"
                type="button"

                style={{ fontSize: 12 }}
                onClick={() => exportCSV(points, multiplier, metric)}
                disabled={points.length === 0}
              >
                Export CSV
              </Button>
            }
          >
            <SummaryGrid>
              <SummaryValue label="Latest" value={scale(latest, multiplier)} />
              <SummaryValue
                label={isCumulative ? "Total" : "Mean"}
                value={scale(stats?.avg ?? null, multiplier)}
              />
              <SummaryValue
                label="Min"
                value={scale(stats?.min ?? null, multiplier)}
              />
              <SummaryValue
                label="Max"
                value={scale(stats?.max ?? null, multiplier)}
              />
              <SummaryValue
                label="Std dev"
                value={scale(stats?.stddev ?? null, multiplier)}
              />
              {/* Samples tells you when a gap in the data explains a weird mean. */}
              <SummaryValue
                label="Samples"
                value={stats ? formatNumber(stats.count) : "—"}
              />
            </SummaryGrid>

            <div className="mt-6 min-w-0">
              {message ? (
                <Alert
                  variant="error"
                  style={{ color: "var(--muted-foreground)", fontSize: 13 }}
                >
                  {message}
                  <Button
                    variant="outline"
                    onClick={() => seriesQuery.refetch()}
                  >
                    Retry
                  </Button>
                </Alert>
              ) : state === "loading" ? (
                <Skeleton style={{ width: "100%", height: 420 }} />
              ) : (
                <MetricChart
                  points={points}
                  multiplier={multiplier}
                  unit={selected?.unit ?? ""}
                />
              )}
            </div>
          </PageSection>
        </div>
      </div>
    </>
  );
}

function scale(value: number | null, multiplier: number): string {
  return value == null ? "—" : formatNumber(value * multiplier);
}

function exportCSV(
  points: TimeSeriesPoint[],
  multiplier: number,
  metric: string,
) {
  const rows = [
    "date,value",
    ...points.map(
      (p) => `${p.time},${p.avg == null ? "" : String(p.avg * multiplier)}`,
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${metric || "metric"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
