import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchFrontPage, type FrontPageMetric } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { displayValue } from "../components/dashboard/metricDisplay";
import { formatDayMonth, MINUS } from "../utils/format";
import { directionOf } from "../utils/metricDirection";
import { fitTrend, VERDICT_COLOR, type Fit, type Verdict } from "../utils/trend";
import { queryMessage, queryState } from "../utils/queryState";

const RANGES = ["30d", "90d", "6m", "1y"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = {
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
};

const FLAT_RULE =
  "Direction is the sign of the least-squares slope over the window. A metric counts as flat when the fitted change stays inside one standard deviation.";

interface TrendItem {
  metric: FrontPageMetric;
  fit: Fit;
}

export default function TrendsPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const range = (params.get("range") as Range) ?? "90d";

  // The same payload the dashboard uses: one request, and the fit is computed
  // on exactly the series the chart draws.
  const query = useQuery({
    queryKey: ["front-page", range],
    queryFn: () => fetchFrontPage(range),
    staleTime: 60_000,
  });
  const state = queryState(query);
  const message = queryMessage(state, query.error);

  const items = useMemo<TrendItem[]>(() => {
    const metrics = query.data?.metrics ?? [];
    return metrics
      .map((metric) => {
        const fit = fitTrend(metric.series, directionOf(metric.metric_name));
        return fit ? { metric, fit } : null;
      })
      .filter((i): i is TrendItem => i != null);
  }, [query.data]);

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { improving: 0, flat: 0, declining: 0 };
    for (const i of items) c[i.fit.verdict]++;
    return c;
  }, [items]);

  const setRange = (next: Range) => {
    const p = new URLSearchParams(params);
    p.set("range", next);
    setParams(p, { replace: true });
  };

  const days = RANGE_DAYS[range];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);

  return (
    <>
      <PageHeader
        kicker="Linear fit over the selected window"
        title="Trends"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={setRange}
            name="trends-range"
            note={FLAT_RULE}
          />
        }
      />

      <div
        className="page-x"
        style={{
          display: isDesktop ? "flex" : "grid",
          gridTemplateColumns: isDesktop ? undefined : "repeat(3, 1fr)",
          gap: isDesktop ? 56 : 0,
          alignItems: isDesktop ? "flex-start" : undefined,
          borderTop: "2px solid var(--foreground)",
          borderBottom: "2px solid var(--foreground)",
          paddingTop: isDesktop ? 20 : 14,
          paddingBottom: isDesktop ? 20 : 14,
        }}
      >
        <VerdictCount
          label="Improving"
          value={counts.improving}
          color="var(--success)"
        />
        <VerdictCount label="Flat" value={counts.flat} />
        <VerdictCount
          label="Declining"
          value={counts.declining}
          color="var(--warning)"
        />
        {isDesktop ? (
          <p
            style={{
              marginLeft: "auto",
              maxWidth: "46ch",
              font: "400 12.5px/1.5 var(--font-body)",
              color: "var(--muted-foreground)",
              textAlign: "right",
            }}
          >
            {FLAT_RULE}
          </p>
        ) : null}
      </div>

      {message ? (
        <Alert variant="error"
          className="page-x"
          style={{
            color: "var(--muted-foreground)",
            fontSize: 13,
            paddingTop: 16,
          }}
        >
          {message}
        </Alert>
      ) : items.length === 0 ? (
        <p
          className="page-x"
          style={{
            color: "var(--muted-foreground)",
            fontSize: 13,
            paddingTop: 16,
          }}
        >
          {state === "loading"
            ? "Fitting trends…"
            : "Not enough samples in this window to fit a trend."}
        </p>
      ) : isDesktop ? (
        <SmallMultiples items={items} start={start} end={end} />
      ) : (
        <TrendRows items={items} />
      )}

      <div
        className="page-x flex items-center gap-6 flex-wrap"
        style={{ paddingTop: 18, paddingBottom: 40, marginTop: "auto" }}
      >
        <LegendLine color="var(--color-data-3)" label="Daily value" />
        {/* The fitted line is drawn in one of three colours, so one swatch
            labelled "Fitted trend" would state a colour the chart never uses. */}
        <LegendLine color={VERDICT_COLOR.improving} label="Improving" />
        <LegendLine color={VERDICT_COLOR.flat} label="Flat" />
        <LegendLine color={VERDICT_COLOR.declining} label="Declining" />
        <Link
          to="/settings?tab=front-page"
          className={buttonVariants({ variant: "ghost" })}
          style={{ marginLeft: "auto", fontSize: 12.5 }}
        >
          Choose metrics →
        </Link>
      </div>
    </>
  );
}

function SmallMultiples({
  items,
  start,
  end,
}: {
  items: TrendItem[];
  start: Date;
  end: Date;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
      {items.map(({ metric, fit }, i) => (
        <div
          key={metric.metric_name}
          style={{
            paddingTop: 22,
            paddingBottom: 20,
            /* Cells are 24px inside, but the outer columns align to the page
               edge like every other strip on the screen. */
            paddingLeft: i % 5 === 0 ? "var(--page-x)" : 24,
            paddingRight: i % 5 === 4 ? "var(--page-x)" : 24,
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="kick">{metric.label || metric.metric_name}</div>
          <div
            className="num"
            style={{
              font: "800 30px/1 var(--font-heading)",
              letterSpacing: "-0.03em",
              marginTop: 10,
            }}
          >
            {displayValue(metric)}
            <span
              style={{
                font: "500 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
                marginLeft: 5,
              }}
            >
              {metric.unit}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 8,
            }}
          >
            <span
              className="num"
              style={{
                font: "700 12.5px var(--font-body)",
                color: VERDICT_COLOR[fit.verdict],
              }}
            >
              {slopeLabel(fit.slope, metric)}
            </span>
            <span
              style={{
                font: "400 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              {fit.verdict}
            </span>
          </div>

          <TrendChart series={metric.series} fit={fit} width={240} height={74} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              font: "400 10px var(--font-body)",
              color: "var(--muted-foreground)",
              marginTop: 4,
            }}
          >
            <span>{formatDayMonth(start)}</span>
            <span>{formatDayMonth(end)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Below the breakpoint the 5-column grid becomes rows grouped by verdict. */
function TrendRows({ items }: { items: TrendItem[] }) {
  const order: Verdict[] = ["improving", "flat", "declining"];
  return (
    <div>
      {order.map((verdict) => {
        const group = items.filter((i) => i.fit.verdict === verdict);
        if (group.length === 0) return null;
        return (
          <div key={verdict}>
            <div className="kick row-group" style={{ textTransform: "capitalize" }}>
              {verdict}
            </div>
            {group.map(({ metric, fit }) => (
              <div key={metric.metric_name} className="row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "500 13.5px var(--font-body)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {metric.label || metric.metric_name}
                  </div>
                  <div
                    className="num"
                    style={{
                      font: "600 11px var(--font-body)",
                      marginTop: 4,
                      color: VERDICT_COLOR[fit.verdict],
                    }}
                  >
                    {slopeLabel(fit.slope, metric)}
                  </div>
                </div>
                <TrendChart
                  series={metric.series}
                  fit={fit}
                  width={120}
                  height={34}
                  cssWidth={104}
                />
                <div
                  className="num"
                  style={{
                    font: "700 15px var(--font-body)",
                    width: 64,
                    textAlign: "right",
                    flex: "none",
                  }}
                >
                  {displayValue(metric)}{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {metric.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The daily series plus the fitted line, both scaled to the same extent so the
 * line sits inside the cloud rather than beside it.
 */
function TrendChart({
  series,
  fit,
  width,
  height,
  cssWidth = "100%",
}: {
  series: (number | null)[];
  fit: Fit;
  width: number;
  height: number;
  cssWidth?: number | string;
}) {
  const present = series.filter((v): v is number => v != null);
  if (present.length < 2) return null;

  const min = Math.min(...present, fit.startValue, fit.endValue);
  const max = Math.max(...present, fit.startValue, fit.endValue);
  const span = max - min || 1;
  const yFor = (v: number) => height - 2 - ((v - min) / span) * (height - 4);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        width: cssWidth,
        height,
        display: "block",
        marginTop: 10,
        flex: "none",
      }}
      aria-hidden
    >
      <line
        x1={0}
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke="var(--border)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={scalePoints(series, width, min, span, height)}
        fill="none"
        stroke="var(--color-data-3)"
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        y1={yFor(fit.startValue)}
        x2={width}
        y2={yFor(fit.endValue)}
        stroke={VERDICT_COLOR[fit.verdict]}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Like the sparkline's mapping, but pinned to an extent shared with the fit. */
function scalePoints(
  series: (number | null)[],
  width: number,
  min: number,
  span: number,
  height: number,
): string {
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  return series
    .map((v, i) =>
      v == null
        ? null
        : `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`,
    )
    .filter((p): p is string => p != null)
    .join(" ");
}

function VerdictCount({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div className="kick">{label}</div>
      <div
        className="num"
        style={{
          font: "800 34px/1 var(--font-heading)",
          letterSpacing: "-0.03em",
          marginTop: 8,
          color: color ?? "var(--foreground)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        font: "500 11.5px var(--font-body)",
        color: "var(--muted-foreground)",
      }}
    >
      <span style={{ width: 16, height: 2, background: color }} />
      {label}
    </span>
  );
}

function slopeLabel(slope: number, metric: FrontPageMetric): string {
  const perDay = slope * metric.multiplier;
  const magnitude = Math.abs(perDay);
  const digits = magnitude >= 1 ? 2 : 3;
  const sign = perDay < 0 ? MINUS : "+";
  const unit = metric.unit ? `${metric.unit}/day` : "/day";
  return `${sign}${magnitude.toFixed(digits)} ${unit}`;
}
