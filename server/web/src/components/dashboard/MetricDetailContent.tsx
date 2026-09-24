import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchFrontPage, type FrontPageMetric } from "../../api";
import { getMetricInfo } from "../../utils/metricInfo";
import { metricDays, personalComparison } from "../../utils/metricInsight";
import { formatDelta, formatNumber } from "../../utils/format";
import { sourceLabel } from "../../utils/sourceLabel";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { displayValue } from "./metricDisplay";
import MetricTrendChart from "./MetricTrendChart";
import SegmentedControl from "../SegmentedControl";
import Disclosure from "../Disclosure";
import { Button, buttonVariants } from "../ui/button";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Empty } from "../ui/empty";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";

const RANGES = ["1d", "7d", "30d", "90d", "1y"] as const;
export type MetricRange = (typeof RANGES)[number];
const format = (n: number | null) => (n == null ? "—" : formatNumber(n));

/** Read-only details use the dashboard endpoint so its source priority and totals stay identical. */
export default function MetricDetailContent({
  metric: initial,
  initialRange,
}: {
  metric: FrontPageMetric;
  initialRange: MetricRange;
}) {
  const [range, setRange] = useState(initialRange);
  const desktop = useIsDesktop();
  const query = useQuery({
    queryKey: ["front-page", range],
    queryFn: () => fetchFrontPage(range),
    staleTime: 60_000,
  });
  const baseline = useQuery({
    queryKey: ["front-page", "30d"],
    queryFn: () => fetchFrontPage("30d"),
    staleTime: 60_000,
  });
  const metric = query.data?.metrics.find(
    (m) => m.metric_name === initial.metric_name,
  );
  const reference = baseline.data?.metrics.find(
    (m) => m.metric_name === initial.metric_name,
  );
  const info = getMetricInfo(initial.metric_name);
  const days = useMemo(
    () => (metric ? metricDays(metric, query.data?.window_start ?? "") : []),
    [metric, query.data?.window_start],
  );
  const comparison = useMemo(
    () =>
      personalComparison(
        reference
          ? metricDays(reference, baseline.data?.window_start ?? "")
          : [],
      ),
    [reference, baseline.data?.window_start],
  );
  const available = days.filter((p) => p.value != null);
  const current = metric ?? initial;
  const dated =
    current.time &&
    Number.isFinite(Date.parse(current.time)) &&
    !current.time.startsWith("0001-");
  const moving =
    comparison.motion === "rising" || comparison.motion === "falling";
  const favorable =
    info.direction === "higher"
      ? comparison.motion === "rising"
      : comparison.motion === "falling";
  const hasComparison = comparison.change != null && !baseline.isError;
  const movement =
    comparison.motion === "rising"
      ? "Rising"
      : comparison.motion === "falling"
        ? "Falling"
        : "Little change";
  const sourceName = info.source
    ? new URL(info.source).hostname.replace(
        /^(www\.|support\.|my\.|developer\.)/,
        "",
      )
    : null;

  return (
    <div className="space-y-6 pb-2 text-sm leading-relaxed">
      <section aria-label="Latest reading" className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Latest {initial.is_cumulative ? "recorded daily total" : "reading"}
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {displayValue(current)}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {current.unit}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {sourceLabel(current.source)}
          {dated &&
            ` · ${new Date(current.time).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`}
        </p>
      </section>
      <section aria-label={`About ${initial.label}`} className="space-y-2">
        <h3 className="font-semibold">What it means</h3>
        <p className="text-muted-foreground">{info.summary}</p>
      </section>
      <section aria-label="Your trend" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Your trend</h3>
          <SegmentedControl
            label="Metric trend range"
            options={RANGES.map((value) => ({ value, label: value }))}
            value={range}
            onChange={setRange}
          />
        </div>
        {query.isError && (
          <Alert variant="error">
            {query.data
              ? "History could not refresh. Showing the last loaded data."
              : "Could not load this history."}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry history
            </Button>
          </Alert>
        )}
        {query.isPending ? (
          <Skeleton
            aria-label="Loading metric history"
            className="h-56 w-full"
          />
        ) : available.length ? (
          <>
            <MetricTrendChart
              days={days}
              unit={current.unit}
              cumulative={current.is_cumulative}
              label={initial.label}
            />
            <p className="text-xs text-muted-foreground">
              {available.length} of {days.length} days recorded.{" "}
              {current.is_cumulative ? "Daily totals" : "Daily averages"}; gaps
              mean no reading. Today may be incomplete.
            </p>
          </>
        ) : (
          !query.isError && <Empty>No readings in this period.</Empty>
        )}
      </section>
      <section
        aria-label="Compared with you"
        className="space-y-3 rounded-xl border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Compared with you</h3>
          {hasComparison && <Badge variant="outline">{movement}</Badge>}
        </div>
        {baseline.isError ? (
          <Alert variant="error">
            Could not refresh your personal comparison.
            <Button variant="outline" onClick={() => baseline.refetch()}>
              Retry comparison
            </Button>
          </Alert>
        ) : baseline.isPending ? (
          <Skeleton
            className="h-16 w-full"
            aria-label="Loading personal comparison"
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Recent 7-day average</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {format(comparison.recentMean)} {initial.unit}
                </dd>
                <dd className="text-muted-foreground">
                  {comparison.recentCount}/7 days recorded
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Previous 7-day average
                </dt>
                <dd className="text-base font-semibold tabular-nums">
                  {format(comparison.previousMean)} {initial.unit}
                </dd>
                <dd className="text-muted-foreground">
                  {comparison.previousCount}/7 days recorded
                </dd>
              </div>
            </dl>
            {hasComparison ? (
              <>
                <p>
                  {formatDelta(comparison.change!)} {initial.unit} compared with
                  the previous week.
                  {moving && info.direction !== "context" && (
                    <span>
                      {" "}
                      {favorable
                        ? "A potentially favorable direction"
                        : "Moving against the generally favorable direction"}{" "}
                      for this metric; context still matters.
                    </span>
                  )}
                  {moving &&
                    info.direction === "context" &&
                    " A change here is not inherently good or bad."}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Not enough history for a weekly comparison. At least four
                recorded days in each of the two complete weeks are needed.
              </p>
            )}
            {comparison.typical && (
              <p className="text-xs text-muted-foreground">
                Your earlier typical range:{" "}
                <strong className="font-medium text-foreground">
                  {format(comparison.typical[0])}–
                  {format(comparison.typical[1])} {initial.unit}
                </strong>
                . This is the middle half of {comparison.referenceCount}{" "}
                recorded days before the recent week, not a medical target.
              </p>
            )}
          </>
        )}
      </section>
      <section aria-label="How to read it" className="space-y-2">
        <h3 className="font-semibold">What good looks like</h3>
        <p className="text-muted-foreground">{info.guidance}</p>
        {info.source && (
          <a
            className="text-primary underline underline-offset-4"
            href={info.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more · {sourceName}
          </a>
        )}
      </section>
      {available.length > 0 && (
        <Disclosure trigger="Daily values">
          <div className="max-h-64 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">
                    {current.is_cumulative ? "Total" : "Average"}
                    {current.unit && ` (${current.unit})`}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...days].reverse().map((p) => (
                  <TableRow key={p.time}>
                    <TableCell>
                      {new Date(p.time).toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(p.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Disclosure>
      )}
      <Disclosure trigger="How this comparison works">
        <p className="text-xs text-muted-foreground">
          We compare the last seven complete days with the seven before them
          using the dashboard's daily totals or averages. Missing days are
          omitted, never counted as zero. We require at least four readings per
          week. Changes within 3% of the earlier average are labelled little
          change; this is a display rule, not a clinical cutoff. The typical
          range uses the earlier 21 days where at least seven are recorded.
          Dates follow the stored UTC daily buckets. Today is shown in the chart
          but excluded from the comparison. Device changes, partial logging and
          measurement conditions can affect trends. These explanations are
          general education, not a diagnosis.
        </p>
      </Disclosure>
      {desktop && (
        <Link
          className={buttonVariants({ variant: "outline" })}
          to={`/metrics?metric=${encodeURIComponent(initial.metric_name)}&range=${range}`}
        >
          Open full metric analysis
        </Link>
      )}
    </div>
  );
}
