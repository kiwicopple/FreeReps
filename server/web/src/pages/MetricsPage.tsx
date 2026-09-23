import { metricLabel } from "../utils/metricLabel";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMetricStats, fetchTimeSeries, type TimeSeriesPoint } from "../api";
import DesktopOnly from "../components/DesktopOnly";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import MetricChart from "../components/metrics/MetricChart";
import { useAvailableMetrics, type MetricOption } from "../hooks/useMetrics";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { formatDateWithYear, formatNumber } from "../utils/format";
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
        kicker={`${formatDateWithYear(start)} – ${formatDateWithYear(end)}`}
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

      <div
        style={{
          display: "flex",
          borderTop: "2px solid var(--foreground)",
          minHeight: 760,
        }}
      >
        <div className="rail">
          <div className="kick" style={{ padding: "14px 20px 10px" }}>
            {options.length} metrics
          </div>
          {groups.map((group) => (
            <div key={group.label}>
              <div
                className="kick"
                style={{
                  padding: "16px 20px 6px",
                  color: "var(--muted-foreground)",
                }}
              >
                {group.label}
              </div>
              {group.metrics.map((m: MetricOption) => (
                <button
                  key={m.value}
                  className="rail-item"
                  aria-selected={m.value === metric}
                  style={{ padding: "9px 20px" }}
                  onClick={() => setParam("metric", m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="flex items-baseline justify-between gap-5 page-x"
            style={{ paddingTop: 22, paddingBottom: 18 }}
          >
            <div>
              <h2 style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
                {selected?.label ?? (metric ? metricLabel(metric) : "—")}
              </h2>
              <div
                style={{
                  font: "400 12px var(--font-body)",
                  color: "var(--muted-foreground)",
                  marginTop: 7,
                }}
              >
                {[selected?.unit, `${days} days`, `${agg} aggregate`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12 }}
              onClick={() => exportCSV(points, multiplier, metric)}
              disabled={points.length === 0}
            >
              Export CSV
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              borderTop: "2px solid var(--foreground)",
              borderBottom: "2px solid var(--foreground)",
            }}
          >
            <Stat label="Latest" value={scale(latest, multiplier)} />
            <Stat
              label={isCumulative ? "Total" : "Mean"}
              value={scale(stats?.avg ?? null, multiplier)}
            />
            <Stat label="Min" value={scale(stats?.min ?? null, multiplier)} />
            <Stat label="Max" value={scale(stats?.max ?? null, multiplier)} />
            <Stat
              label="Std dev"
              value={scale(stats?.stddev ?? null, multiplier)}
            />
            {/* Samples tells you when a gap in the data explains a weird mean. */}
            <Stat
              label="Samples"
              value={stats ? formatNumber(stats.count) : "—"}
            />
          </div>

          <div className="page-x" style={{ paddingTop: 26, paddingBottom: 34 }}>
            {message ? (
              <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                {message}
              </p>
            ) : state === "loading" ? (
              <div className="skel" style={{ width: "100%", height: 420 }} />
            ) : (
              <MetricChart
                points={points}
                multiplier={multiplier}
                unit={selected?.unit ?? ""}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "18px 20px 16px",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="kick">{label}</div>
      <div
        className="num"
        style={{
          font: "800 26px/1 var(--font-heading)",
          letterSpacing: "-0.03em",
          marginTop: 11,
        }}
      >
        {value}
      </div>
    </div>
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
