import { dateOnlyToLocalDate, shiftDate } from "../utils/localDate";
import { useLocalDay } from "@/hooks/useLocalDay";
import InfoPopover from "@/components/InfoPopover";
import { Card, CardPanel } from "@/components/ui/card";
import { SummarySkeleton } from "@/components/SummaryValue";
import PageContent from "@/components/PageContent";
import PageSection from "@/components/PageSection";
import SummaryValue, { SummaryGrid } from "@/components/SummaryValue";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchFrontPage, type FrontPageMetric } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { displayValue } from "../components/dashboard/metricDisplay";
import { formatDayMonth, MINUS } from "../utils/format";
import { directionOf } from "../utils/metricDirection";
import {
  fitTrend,
  VERDICT_COLOR,
  type Fit,
  type Verdict,
} from "../utils/trend";
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
  const { timezone, today } = useLocalDay();
  const query = useQuery({
    queryKey: ["front-page", range, timezone, today],
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
  const end = dateOnlyToLocalDate(today);
  const start = dateOnlyToLocalDate(shiftDate(today, 1 - days));

  return (
    <>
      <PageHeader
        title="Trends"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={setRange}
            name="trends-range"
          />
        }
      />

      <PageContent className="space-y-6">
        {state === "loading" ? (
          <SummarySkeleton count={3} />
        ) : query.data ? (
          <SummaryGrid className="grid-cols-3">
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
          </SummaryGrid>
        ) : null}
        <PageSection
          title="Metric trends"
          flush
          actions={
            <>
              <InfoPopover label="About trend classification">
                {FLAT_RULE}
              </InfoPopover>
              <Link
                to="/settings?tab=front-page"
                className={buttonVariants({ variant: "outline" })}
              >
                Choose metrics
              </Link>
            </>
          }
        >
          {message ? (
            <Alert
              variant="error"
              className="page-x"
              style={{
                color: "var(--muted-foreground)",
                fontSize: 13,
                paddingTop: 16,
              }}
            >
              {message}
              <Button variant="outline" onClick={() => query.refetch()}>
                Retry
              </Button>
            </Alert>
          ) : state === "loading" ? (
            <Spinner
              className="mx-auto my-6 size-6"
              aria-label="Fitting trends"
            />
          ) : items.length === 0 ? (
            <Empty>Not enough samples in this window to fit a trend.</Empty>
          ) : isDesktop ? (
            <SmallMultiples
              items={items}
              start={start}
              end={end}
              range={range}
            />
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
          </div>
        </PageSection>
      </PageContent>
    </>
  );
}

function SmallMultiples({
  items,
  start,
  end,
  range,
}: {
  items: TrendItem[];
  start: Date;
  end: Date;
  range: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 px-4 pb-4 md:px-6">
      {items.map(({ metric, fit }) => (
        <Card key={metric.metric_name}>
          <CardPanel className="p-4">
            <Link
              className="kick underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              to={`/metrics?metric=${encodeURIComponent(metric.metric_name)}&range=${range}`}
            >
              {metric.label || metric.metric_name}
            </Link>
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

            <TrendChart
              series={metric.series}
              fit={fit}
              width={240}
              height={74}
            />

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
          </CardPanel>
        </Card>
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
            <div
              className="kick row-group"
              style={{ textTransform: "capitalize" }}
            >
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
    <SummaryValue
      label={label}
      value={<span style={{ color }}>{value}</span>}
    />
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
