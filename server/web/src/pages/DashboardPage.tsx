import { Search, X } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import PageContent from "@/components/PageContent";
import PageSection from "@/components/PageSection";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchFrontPage, type FrontPageMetric } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import Sparkline from "../components/Sparkline";
import HeroStrip from "../components/dashboard/HeroStrip";
import MetricRows from "../components/dashboard/MetricRows";
import DetailSheet from "../components/DetailSheet";
import {
  displayDelta,
  displayRange,
  displayValue,
  groupByCategory,
  type MetricGroupSection,
} from "../components/dashboard/metricDisplay";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { deltaColor } from "../utils/metricDirection";
import { formatTimeAgo } from "../utils/format";
import { queryMessage, queryState } from "../utils/queryState";
import { sourceLabel } from "../utils/sourceLabel";

const RANGES = ["1d", "7d", "30d", "90d", "1y"] as const;
type DashboardRange = (typeof RANGES)[number];
const MetricDetailContent = lazy(
  () => import("../components/dashboard/MetricDetailContent"),
);

export default function DashboardPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const requestedRange = params.get("range") as DashboardRange;
  const range = RANGES.includes(requestedRange) ? requestedRange : "30d";

  const query = useQuery({
    queryKey: ["front-page", range],
    queryFn: () => fetchFrontPage(range),
    staleTime: 60_000,
  });
  const { data } = query;
  const state = queryState(query);
  const message = queryMessage(state, query.error);

  const [search, setSearch] = useState("");
  const [detailMetric, setDetailMetric] = useState<FrontPageMetric | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const openMetric = (metric: FrontPageMetric, trigger: HTMLElement) => {
    detailTrigger.current = trigger;
    setDetailMetric(metric);
    setDetailOpen(true);
  };
  const groups = useMemo(
    () =>
      groupByCategory(
        (data?.metrics ?? []).filter((m) =>
          `${m.label} ${m.metric_name}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
      ),
    [data?.metrics, search],
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

  return (
    <>
      <PageHeader
        title="Today"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={setRange}
            name="dashboard-range"
          />
        }
      />

      <PageContent className="space-y-6">
        <HeroStrip
          metrics={heroes}
          loading={state === "loading"}
          onSelect={openMetric}
        />

        <PageSection
          title="All metrics"
          flush
          table={isDesktop}
          actions={
            <Link
              to="/settings?tab=front-page"
              className={buttonVariants({ variant: "outline" })}
            >
              Customize metrics
            </Link>
          }
        >
          <div className="border-b px-4 py-3 md:px-6">
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search metrics"
                placeholder="Search metrics…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                {search && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Clear metric search"
                    onClick={() => setSearch("")}
                  >
                    <X />
                  </Button>
                )}
              </InputGroupAddon>
            </InputGroup>
          </div>
          {message ? (
            <Alert
              variant="error"
              className="page-x"
              style={{
                color: "var(--muted-foreground)",
                fontSize: 13,
                paddingTop: 4,
              }}
            >
              {message}
              <Button variant="outline" onClick={() => query.refetch()}>
                Retry
              </Button>
            </Alert>
          ) : search.trim() && groups.length === 0 ? (
            <Empty>
              No matching metrics.{" "}
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </Empty>
          ) : isDesktop ? (
            <MetricsTable
              groups={groups}
              onSelect={openMetric}
              range={range}
              loading={state === "loading"}
            />
          ) : (
            <MetricRows
              groups={groups}
              loading={state === "loading"}
              onSelect={openMetric}
            />
          )}
        </PageSection>
      </PageContent>
      <DetailSheet
        title={detailMetric?.label ?? "Metric details"}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        returnFocus={detailTrigger.current}
      >
        {detailOpen && detailMetric && (
          <Suspense
            fallback={
              <Skeleton
                className="h-56 w-full"
                aria-label="Loading metric details"
              />
            }
          >
            <MetricDetailContent
              key={detailMetric.metric_name}
              metric={detailMetric}
              initialRange={range}
            />
          </Suspense>
        )}
      </DetailSheet>
    </>
  );
}

type OpenMetric = (metric: FrontPageMetric, trigger: HTMLElement) => void;

function MetricsTable({
  groups,
  onSelect,
  range,
  loading,
}: {
  groups: MetricGroupSection[];
  onSelect: OpenMetric;
  range: DashboardRange;
  loading: boolean;
}) {
  const columns = 7;

  if (loading && groups.length === 0) {
    return <TableSkeleton columns={columns} range={range} />;
  }

  if (groups.length === 0) {
    return (
      <Empty
        className="page-x"
        style={{ color: "var(--muted-foreground)", fontSize: 13 }}
      >
        No metrics selected. Pick which metrics the table lists in Settings.
      </Empty>
    );
  }

  return (
    <Table variant="card">
      <MetricTableHead range={range} />
      <TableBody>
        {groups.map((group) => (
          <MetricGroup
            key={group.category}
            group={group}
            columns={columns}
            onSelect={onSelect}
          />
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
        <TableHead style={{ textAlign: "right", width: 150 }}>
          {range} range
        </TableHead>
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
  onSelect,
}: {
  group: MetricGroupSection;
  columns: number;
  onSelect: OpenMetric;
}) {
  return (
    <>
      <TableRow className="grp">
        <TableCell colSpan={columns} className="kick">
          {group.label}
        </TableCell>
      </TableRow>
      {group.metrics.map((m) => (
        <MetricRow key={m.metric_name} metric={m} onSelect={onSelect} />
      ))}
    </>
  );
}

function MetricRow({
  metric: m,
  onSelect,
}: {
  metric: FrontPageMetric;
  onSelect: OpenMetric;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/50"
      onClick={(event) => {
        const trigger = event.currentTarget.querySelector("button");
        if (trigger) onSelect(m, trigger);
      }}
    >
      <TableCell style={{ fontWeight: 500 }}>
        <Button
          variant="ghost"
          className="h-auto justify-start whitespace-normal p-0 text-left"
          aria-label={`View ${m.label} details`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(m, event.currentTarget);
          }}
        >
          {m.label || m.metric_name}
        </Button>
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
    <Table variant="card">
      <MetricTableHead range={range} />
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: columns }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton style={{ width: j === 0 ? 120 : 60, height: 14 }} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
