import { Alert } from "@/components/ui/alert";
import Choice from "@/components/Choice";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTimeSeries, type TimeSeriesPoint } from "../api";
import DesktopOnly from "../components/DesktopOnly";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import Scatter from "../components/correlation/Scatter";
import { useAvailableMetrics } from "../hooks/useMetrics";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { formatNumber, MINUS } from "../utils/format";
import { linearRegression, pearsonR } from "../utils/stats";
import { queryMessage, queryState } from "../utils/queryState";

const RANGES = ["30d", "90d", "6m", "1y"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = {
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
};

const LAGS = [0, 1, 2, 3];

const CAVEAT =
  "Correlation is not causation, and with 34 metrics some pairs will look related by chance. Treat anything under r = 0.3 as noise.";

export default function CorrelationPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const { groups, lookup } = useAvailableMetrics();

  const range = (params.get("range") as Range) ?? "90d";
  const lag = parseInt(params.get("lag") ?? "0", 10);
  const xMetric = params.get("x") ?? "sleep_analysis";
  const yMetric = params.get("y") ?? "heart_rate_variability";

  const days = RANGE_DAYS[range];
  const end = new Date();
  // Fetch a few extra days so a lagged pairing does not lose the window's edge.
  const start = new Date(end.getTime() - (days + LAGS.length) * 86400000);
  const endISO = end.toISOString().split("T")[0];
  const startISO = start.toISOString().split("T")[0];

  const xQuery = useQuery({
    queryKey: ["timeseries", xMetric, startISO, endISO, "daily"],
    queryFn: () => fetchTimeSeries(xMetric, startISO, endISO, "daily"),
    enabled: isDesktop && !!xMetric,
  });
  const yQuery = useQuery({
    queryKey: ["timeseries", yMetric, startISO, endISO, "daily"],
    queryFn: () => fetchTimeSeries(yMetric, startISO, endISO, "daily"),
    enabled: isDesktop && !!yMetric,
  });

  const xMeta = lookup.get(xMetric);
  const yMeta = lookup.get(yMetric);

  const byLag = useMemo(() => {
    const xs = xQuery.data ?? [];
    const ys = yQuery.data ?? [];
    return LAGS.map((l) => {
      const pairs = pairWithLag(xs, ys, l, xMeta?.multiplier ?? 1, yMeta?.multiplier ?? 1);
      return { lag: l, pairs, r: pearsonR(pairs.map((p) => p.x), pairs.map((p) => p.y)) };
    });
  }, [xQuery.data, yQuery.data, xMeta, yMeta]);

  const active = byLag.find((b) => b.lag === lag) ?? byLag[0];

  if (!isDesktop) return <DesktopOnly title="Correlations" />;

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    p.set(key, value);
    setParams(p, { replace: true });
  };

  const state =
    queryState(xQuery) === "ready" ? queryState(yQuery) : queryState(xQuery);
  const message = queryMessage(state, xQuery.error ?? yQuery.error);

  const sameMetric = xMetric === yMetric;
  const r = active?.r ?? null;
  const fit =
    active && active.pairs.length >= 3
      ? linearRegression(
          active.pairs.map((p) => p.x),
          active.pairs.map((p) => p.y),
        )
      : null;

  return (
    <>
      <PageHeader
        kicker={`${days} days · ${active?.pairs.length ?? 0} paired days`}
        title="Correlations"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={(v) => setParam("range", v)}
            name="correlation-range"
          />
        }
      />

      <div
        className="page-x"
        style={{ display: "flex", gap: 32, alignItems: "flex-end", paddingBottom: 20 }}
      >
        <div className="field" style={{ width: 280 }}>
          <label htmlFor="corr-x">X axis</label>
          <Choice searchable
            id="corr-x"
            className=""
            value={xMetric}
            onValueChange={(value) => setParam("x", value)}
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.metrics.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Choice>
        </div>

        <div className="field" style={{ width: 280 }}>
          <label htmlFor="corr-y">Y axis</label>
          <Choice searchable
            id="corr-y"
            className=""
            value={yMetric}
            onValueChange={(value) => setParam("y", value)}
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.metrics.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Choice>
        </div>

        <div className="field" style={{ width: 200 }}>
          <label htmlFor="corr-lag">Lag</label>
          <Choice searchable
            id="corr-lag"
            className=""
            value={lag}
            onValueChange={(value) => setParam("lag", value)}
          >
            <option value={0}>Same day</option>
            <option value={1}>1 day</option>
            <option value={2}>2 days</option>
            <option value={3}>3 days</option>
          </Choice>
        </div>
      </div>

      <div style={{ display: "flex", borderTop: "2px solid var(--foreground)" }}>
        <div
          className="page-x"
          style={{
            flex: 1,
            minWidth: 0,
            borderRight: "2px solid var(--foreground)",
            paddingTop: 26,
            paddingBottom: 34,
          }}
        >
          {sameMetric ? (
            <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
              Pick two different metrics. A metric correlates with itself
              perfectly, which says nothing.
            </p>
          ) : message ? (
            <Alert variant="error" style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
              {message}
            </Alert>
          ) : state === "loading" ? (
            <Skeleton  style={{ width: "100%", height: 520 }} />
          ) : (
            <>
              <Scatter pairs={active?.pairs ?? []} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <span className="kick">{xMeta?.label ?? xMetric}</span>
                <span className="kick">
                  {active?.pairs.length ?? 0} paired days
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ width: 440, flex: "none" }}>
          <PearsonBlock
            r={sameMetric ? null : r}
            xLabel={xMeta?.label ?? xMetric}
            yLabel={yMeta?.label ?? yMetric}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: "2px solid var(--foreground)",
            }}
          >
            <FitStat
              label="R²"
              value={r != null ? (r * r).toFixed(3) : "—"}
              border
            />
            <FitStat
              label="Slope"
              value={fit ? formatNumber(fit.slope, 3) : "—"}
            />
            <FitStat
              label="Paired days"
              value={String(active?.pairs.length ?? 0)}
              border
              top
            />
            <FitStat
              label="Lag applied"
              value={lag === 0 ? "Same day" : `${lag} day${lag > 1 ? "s" : ""}`}
              top
            />
          </div>

          <div className="page-x" style={{ paddingTop: 22, paddingBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Correlation by lag</h3>
            <p
              style={{
                font: "400 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
                margin: "6px 0 0",
              }}
            >
              Y shifted forward by n days.
            </p>
          </div>

          <Table  style={{ fontSize: 13.5 }}>
            <TableHeader>
              <TableRow>
                <TableHead>Lag</TableHead>
                <TableHead style={{ textAlign: "right", width: 70 }}>r</TableHead>
                <TableHead style={{ width: 150 }}>Strength</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLag.map((b) => (
                <TableRow key={b.lag}>
                  <TableCell
                    style={{
                      fontWeight: b.lag === lag ? 700 : 400,
                      color:
                        b.lag === lag
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    {b.lag === 0 ? "Same day" : `${b.lag} day${b.lag > 1 ? "s" : ""}`}
                  </TableCell>
                  <TableCell
                    className="num"
                    style={{
                      textAlign: "right",
                      fontWeight: b.lag === lag ? 700 : 400,
                      color:
                        b.lag === lag
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    {b.r != null ? formatR(b.r) : "—"}
                  </TableCell>
                  <TableCell>
                    <DivergingBar value={b.r} active={b.lag === lag} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div
            className="page-x"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
              paddingBottom: 40,
            }}
          >
            <p
              style={{
                font: "400 12px/1.5 var(--font-body)",
                color: "var(--muted-foreground)",
                margin: 0,
              }}
            >
              {CAVEAT}
            </p>
            <Button variant="ghost"
              type="button"

              style={{ fontSize: 12.5, marginTop: 12, marginLeft: -4 }}
              disabled={!active || active.pairs.length === 0}
              onClick={() =>
                exportPairs(active?.pairs ?? [], xMetric, yMetric, lag)
              }
            >
              Export pairs as CSV →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function PearsonBlock({
  r,
  xLabel,
  yLabel,
}: {
  r: number | null;
  xLabel: string;
  yLabel: string;
}) {
  const strong = r != null && Math.abs(r) >= 0.4;
  // The strongest step of the data ramp, the same one the regression line in
  // the scatter takes, so the figure and the line read as one statement. The
  // accent said "good" and "selected", which a strong negative correlation is
  // neither.
  const color = strong ? "var(--color-data-5)" : "var(--foreground)";

  return (
    <div
      className="page-x"
      style={{
        paddingTop: 26,
        paddingBottom: 22,
        borderBottom: "2px solid var(--foreground)",
      }}
    >
      <div className="kick">Pearson r</div>
      <div
        className="num"
        style={{
          font: "800 76px/1 var(--font-heading)",
          letterSpacing: "-0.04em",
          marginTop: 10,
          color,
        }}
      >
        {r != null ? formatR(r) : "—"}
      </div>
      <div
        style={{
          font: "600 13px var(--font-body)",
          color,
          marginTop: 12,
        }}
      >
        {r != null ? strengthPhrase(r) : "No pairing"}
      </div>
      <p
        style={{
          font: "400 12.5px/1.55 var(--font-body)",
          color: "var(--muted-foreground)",
          margin: "8px 0 0",
        }}
      >
        {r == null
          ? "Pick two different metrics with overlapping days."
          : sentenceFor(r, xLabel, yLabel)}
      </p>
    </div>
  );
}

function FitStat({
  label,
  value,
  border,
  top,
}: {
  label: string;
  value: string;
  border?: boolean;
  top?: boolean;
}) {
  return (
    <div
      style={{
        paddingTop: 16,
        paddingBottom: 16,
        /* The left column aligns to the page edge; the right one only needs
           clearance from the divider. */
        paddingLeft: border ? "var(--page-x)" : 20,
        paddingRight: border ? 20 : "var(--page-x)",
        borderRight: border ? "1px solid var(--border)" : undefined,
        borderTop: top ? "1px solid var(--border)" : undefined,
      }}
    >
      <div className="kick">{label}</div>
      <div
        className="num"
        style={{
          font: "800 22px/1 var(--font-heading)",
          letterSpacing: "-0.02em",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** A fill that grows right from the centre for positive r, left for negative. */
function DivergingBar({
  value,
  active,
}: {
  value: number | null;
  active: boolean;
}) {
  const magnitude = value == null ? 0 : Math.min(Math.abs(value), 1) * 50;
  const color = active ? "var(--color-data-3)" : "var(--muted-foreground)";

  return (
    <div
      style={{
        position: "relative",
        height: 10,
        background: "var(--secondary)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "var(--muted-foreground)",
        }}
      />
      {value != null ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: value >= 0 ? "50%" : `${50 - magnitude}%`,
            width: `${magnitude}%`,
            background: color,
          }}
        />
      ) : null}
    </div>
  );
}

function strengthPhrase(r: number): string {
  const a = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";
  if (a >= 0.6) return `Strong ${direction} association`;
  if (a >= 0.4) return `Moderate ${direction} association`;
  if (a >= 0.25) return `Weak ${direction} association`;
  return "Negligible association";
}

function sentenceFor(r: number, xLabel: string, yLabel: string): string {
  const a = Math.abs(r);
  if (a < 0.25) {
    return `${xLabel} and ${yLabel} move independently over this window.`;
  }
  // Labels keep their own casing: lowercasing would turn HRV into hrv.
  return r >= 0
    ? `Over this window, days with a higher ${xLabel} tend to come with a higher ${yLabel}.`
    : `Over this window, days with a higher ${xLabel} tend to come with a lower ${yLabel}.`;
}

/** r reads better with the real minus sign and a fixed two decimals. */
function formatR(r: number): string {
  const body = Math.abs(r).toFixed(2);
  return r < 0 ? `${MINUS}${body}` : body;
}

/**
 * Pairs the two series by date, shifting Y forward by `lag` days. Only days
 * where both sides carry a value become a pair.
 */
function pairWithLag(
  xs: TimeSeriesPoint[],
  ys: TimeSeriesPoint[],
  lag: number,
  xMultiplier: number,
  yMultiplier: number,
): { x: number; y: number }[] {
  const yByDay = new Map<string, number>();
  for (const p of ys) {
    if (p.avg != null) yByDay.set(dayKey(p.time), p.avg * yMultiplier);
  }

  const pairs: { x: number; y: number }[] = [];
  for (const p of xs) {
    if (p.avg == null) continue;
    const shifted = new Date(p.time);
    shifted.setDate(shifted.getDate() + lag);
    const y = yByDay.get(dayKey(shifted.toISOString()));
    if (y != null) pairs.push({ x: p.avg * xMultiplier, y });
  }
  return pairs;
}

function dayKey(iso: string): string {
  return iso.split("T")[0];
}

function exportPairs(
  pairs: { x: number; y: number }[],
  xMetric: string,
  yMetric: string,
  lag: number,
) {
  const rows = [
    `${xMetric},${yMetric}_lag${lag}`,
    ...pairs.map((p) => `${p.x},${p.y}`),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${xMetric}-${yMetric}-lag${lag}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
