import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchFrontPage, type FrontPageMetric } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import Sparkline from "../components/Sparkline";
import HeroStrip from "../components/dashboard/HeroStrip";
import MetricRows from "../components/dashboard/MetricRows";
import {
  displayDelta,
  displayRange,
  displayValue,
  groupByCategory,
  type MetricGroupSection,
} from "../components/dashboard/metricDisplay";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { deltaColor } from "../utils/metricDirection";
import { formatFullDate, formatTimeAgo } from "../utils/format";
import { queryMessage, queryState } from "../utils/queryState";
import { sourceLabel } from "../utils/sourceLabel";

const RANGES = ["1d", "7d", "30d", "90d", "1y"] as const;
type DashboardRange = (typeof RANGES)[number];

export default function DashboardPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const range = (params.get("range") as DashboardRange) ?? "30d";

  const query = useQuery({
    queryKey: ["front-page", range],
    queryFn: () => fetchFrontPage(range),
    staleTime: 60_000,
  });
  const { data } = query;
  const state = queryState(query);
  const message = queryMessage(state, query.error);

  const groups = useMemo(
    () => groupByCategory(data?.metrics ?? []),
    [data?.metrics],
  );

  const heroes = useMemo(() => {
    if (!data) return [];
    const byName = new Map(data.metrics.map((m) => [m.metric_name, m]));
    return data.heroes
      .map((name) => byName.get(name))
      .filter((m): m is FrontPageMetric => m != null);
  }, [data]);

  const setRange = (next: DashboardRange) => {
    const p = new URLSearchParams(params);
    p.set("range", next);
    setParams(p, { replace: true });
  };

  const shown = data?.metrics.length ?? 0;
  const total = data?.total_available ?? 0;
  const hidden = Math.max(total - shown, 0);
  const syncLine = data?.last_sync
    ? `${new Date(data.last_sync).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}${data.last_sources?.length ? ` · ${data.last_sources.join(", ")}` : ""}`
    : "never";

  return (
    <>
      <PageHeader
        kicker={formatFullDate(new Date())}
        title="Today"
        actions={
          isDesktop ? (
            <>
              <span
                style={{
                  font: "400 11.5px var(--font-body)",
                  color: "var(--muted-foreground)",
                }}
              >
                Last sync {syncLine}
              </span>
              <Link
                to="/settings?tab=sources"
                className={buttonVariants({ variant: "outline" })}
                style={{ fontSize: 12 }}
              >
                Sync now
              </Link>
            </>
          ) : (
            <span
              style={{
                font: "400 11px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              Sync {syncLine}
            </span>
          )
        }
      />

      <HeroStrip metrics={heroes} loading={state === "loading"} />

      <div
        className="flex items-baseline justify-between page-x"
        style={{
          paddingTop: isDesktop ? 26 : 14,
          paddingBottom: isDesktop ? 12 : 8,
        }}
      >
        <h2 style={{ fontSize: isDesktop ? 19 : 15, fontWeight: 700 }}>
          All metrics
        </h2>
        <RangeControl
          options={RANGES}
          value={range}
          onChange={setRange}
          name="dashboard-range"
        />
      </div>

      {message ? (
        <p
          className="page-x"
          style={{
            color: "var(--muted-foreground)",
            fontSize: 13,
            paddingTop: 4,
          }}
        >
          {message}
        </p>
      ) : isDesktop ? (
        <MetricsTable
          groups={groups}
          range={range}
          loading={state === "loading"}
        />
      ) : (
        <MetricRows groups={groups} loading={state === "loading"} />
      )}

      <div
        className="page-x flex items-center gap-6 flex-wrap"
        style={{
          borderTop: "2px solid var(--foreground)",
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: "auto",
        }}
      >
        <Link
          to="/settings?tab=front-page"
          className={buttonVariants({ variant: "ghost" })}
          style={{ fontSize: 12.5 }}
        >
          Show {hidden} more metrics →
        </Link>
        <Link to="/trends" className={buttonVariants({ variant: "ghost" })} style={{ fontSize: 12.5 }}>
          Open in Trends →
        </Link>
        {/* Correlations needs width the phone does not have, so its entry
            point falls away below the breakpoint. */}
        {isDesktop ? (
          <>
            <Link
              to="/correlations"
              className={buttonVariants({ variant: "ghost" })}
              style={{ fontSize: 12.5 }}
            >
              Correlate two metrics →
            </Link>
            <span
              style={{
                marginLeft: "auto",
                font: "400 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              {shown} of {total} metrics shown · edit visibility in Settings
            </span>
          </>
        ) : null}
      </div>
    </>
  );
}

function MetricsTable({
  groups,
  range,
  loading,
}: {
  groups: MetricGroupSection[];
  range: DashboardRange;
  loading: boolean;
}) {
  const columns = 7;

  if (loading && groups.length === 0) {
    return <TableSkeleton columns={columns} range={range} />;
  }

  if (groups.length === 0) {
    return (
      <p
        className="page-x"
        style={{ color: "var(--muted-foreground)", fontSize: 13 }}
      >
        No metrics selected. Pick which metrics the table lists in Settings.
      </p>
    );
  }

  return (
    <Table >
      <MetricTableHead range={range} />
      <TableBody>
        {groups.map((group) => (
          <MetricGroup key={group.category} group={group} columns={columns} />
        ))}
      </TableBody>
    </Table>
  );
}

function MetricTableHead({ range }: { range: DashboardRange }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Metric</TableHead>
        <TableHead style={{ textAlign: "right", width: 130 }}>Latest</TableHead>
        <TableHead style={{ textAlign: "right", width: 90 }}>Δ 7d</TableHead>
        <TableHead style={{ textAlign: "right", width: 150 }}>{range} range</TableHead>
        <TableHead style={{ width: 200 }}>{range}</TableHead>
        <TableHead style={{ width: 150 }}>Source</TableHead>
        <TableHead style={{ width: 110 }}>Updated</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function MetricGroup({
  group,
  columns,
}: {
  group: MetricGroupSection;
  columns: number;
}) {
  return (
    <>
      <TableRow className="grp">
        <TableCell colSpan={columns} className="kick">
          {group.label}
        </TableCell>
      </TableRow>
      {group.metrics.map((m) => (
        <MetricRow key={m.metric_name} metric={m} />
      ))}
    </>
  );
}

function MetricRow({ metric: m }: { metric: FrontPageMetric }) {
  return (
    <TableRow>
      <TableCell style={{ fontWeight: 500 }}>
        <Link
          to={`/metrics?metric=${encodeURIComponent(m.metric_name)}`}
          style={{ color: "inherit" }}
        >
          {m.label || m.metric_name}
        </Link>
      </TableCell>
      <TableCell
        className="num"
        style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}
      >
        {displayValue(m)}{" "}
        <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
          {m.unit}
        </span>
      </TableCell>
      <TableCell
        className="num"
        style={{
          textAlign: "right",
          fontSize: 12.5,
          fontWeight: 600,
          color: deltaColor(m.metric_name, m.delta_7d),
        }}
      >
        {displayDelta(m)}
      </TableCell>
      <TableCell
        className="num"
        style={{
          textAlign: "right",
          fontSize: 12.5,
          color: "var(--muted-foreground)",
          whiteSpace: "nowrap",
        }}
      >
        {displayRange(m)}
      </TableCell>
      <TableCell style={{ paddingTop: 8, paddingBottom: 8 }}>
        <Sparkline
          values={m.series}
          width={180}
          height={22}
          cssWidth={180}
          stroke="var(--muted-foreground)"
          strokeWidth={1.4}
        />
      </TableCell>
      <TableCell style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
        {sourceLabel(m.source)}
      </TableCell>
      <TableCell style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
        {m.time ? formatTimeAgo(m.time) : "—"}
      </TableCell>
    </TableRow>
  );
}

/** The rules and labels render immediately; only the values are pending. */
function TableSkeleton({
  columns,
  range,
}: {
  columns: number;
  range: DashboardRange;
}) {
  return (
    <Table >
      <MetricTableHead range={range} />
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: columns }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton

                  style={{ width: j === 0 ? 120 : 60, height: 14 }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
