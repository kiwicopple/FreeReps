import PageSection from "@/components/PageSection";
import SummaryValue, { SummaryGrid } from "@/components/SummaryValue";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchWorkoutZones, fetchWorkouts, type Workout } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import ZoneBar from "../components/workouts/ZoneBar";
import {
  getWorkoutDisplayName,
  getWorkoutFilterKey,
} from "../components/workouts/workoutNames";
import { useIsDesktop } from "../hooks/useMediaQuery";
import {
  formatClock,
  formatDateWithYear,
  formatDuration,
  formatDistance,
  distanceKm,
  formatNumber,
  formatShortDate,
} from "../utils/format";
import { ZONE_COLORS, zoneBands } from "../utils/stageColors";
import { queryMessage, queryState } from "../utils/queryState";
import { sourceLabel } from "../utils/sourceLabel";

const RANGES = ["1d", "7d", "30d", "90d", "1y"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

const PAGE_SIZE = 10;

export default function WorkoutsPage() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const range = (params.get("range") as Range) ?? "90d";
  const typeFilter = params.get("type") ?? "";
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10));

  const days = RANGE_DAYS[range];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const endISO = end.toISOString().split("T")[0];
  const startISO = start.toISOString().split("T")[0];

  const workoutsQuery = useQuery({
    queryKey: ["workouts", startISO, endISO],
    queryFn: () => fetchWorkouts(startISO, endISO),
  });
  const zonesQuery = useQuery({
    queryKey: ["workout-zones", startISO, endISO],
    queryFn: () => fetchWorkoutZones(startISO, endISO),
  });

  const state = queryState(workoutsQuery);
  const message = queryMessage(state, workoutsQuery.error);
  const all = useMemo(() => workoutsQuery.data ?? [], [workoutsQuery.data]);

  const zonesById = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const z of zonesQuery.data?.zones ?? [])
      map.set(z.workout_id, z.shares);
    return map;
  }, [zonesQuery.data]);

  // Counts come from the unfiltered response, so a pill never reads zero
  // because of the filter it would apply.
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of all) {
      const key = getWorkoutFilterKey(w);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(
    () =>
      typeFilter
        ? all.filter((w) => getWorkoutFilterKey(w) === typeFilter)
        : all,
    [all, typeFilter],
  );

  const summary = useMemo(() => summarize(filtered), [filtered]);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const groups = useMemo(() => groupByDate(pageItems), [pageItems]);

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(params);
    if (value == null || value === "") p.delete(key);
    else p.set(key, value);
    if (key !== "page") p.delete("page");
    setParams(p, { replace: true });
  };

  const maxHR = zonesQuery.data?.max_heart_rate ?? 0;

  return (
    <>
      <PageHeader
        kicker={`${formatDateWithYear(start)} – ${formatDateWithYear(end)}`}
        title="Workouts"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={(v) => setParam("range", v)}
            name="workouts-range"
          />
        }
      />

      <div className="page-x space-y-6">
        <SummaryGrid>
          <SummaryValue
            label="Sessions"
            value={String(summary.count)}
            detail={`${summary.perWeek.toFixed(1)} per week`}
          />
          <SummaryValue
            label="Total time"
            value={formatDuration(summary.totalSeconds)}
            detail={
              summary.count > 0
                ? `avg ${formatDuration(summary.totalSeconds / summary.count)} per session`
                : ""
            }
          />
          <SummaryValue
            label="Energy"
            value={formatNumber(summary.energy)}
            unit="kcal"
            detail={
              summary.count > 0
                ? `avg ${formatNumber(summary.energy / summary.count)} per session`
                : ""
            }
          />
          {isDesktop ? (
            <>
              <SummaryValue
                label="Avg heart rate"
                value={summary.avgHR ? formatNumber(summary.avgHR) : "—"}
                unit="bpm"
                detail={
                  summary.peakHR ? `peak ${formatNumber(summary.peakHR)}` : ""
                }
              />
              <SummaryValue
                label="Distance"
                value={formatNumber(summary.distance, 1)}
                unit="km"
                detail={`${summary.withDistance} sessions with GPS`}
              />
            </>
          ) : null}
        </SummaryGrid>

        <div
          className="flex items-center gap-2 overflow-x-auto md:flex-wrap"
          role="group"
          aria-label="Workout type filters"
        >
          <FilterPill
            label="All"
            count={all.length}
            active={typeFilter === ""}
            onClick={() => setParam("type", null)}
          />
          {typeCounts.map(([type, count]) => (
            <FilterPill
              key={type}
              label={type}
              count={count}
              active={typeFilter === type}
              onClick={() => setParam("type", type)}
            />
          ))}
          {isDesktop ? (
            <span
              style={{
                marginLeft: "auto",
                font: "400 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
                whiteSpace: "nowrap",
              }}
            >
              {typeFilter ? `Filtered to ${typeFilter}` : "All types"} · newest
              first
            </span>
          ) : null}
        </div>

        <PageSection title="Sessions" flush>
          {message ? (
            <Alert
              variant="error"
              className="page-x"
              style={{ color: "var(--muted-foreground)", fontSize: 13 }}
            >
              {message}
              <Button variant="outline" onClick={() => workoutsQuery.refetch()}>
                Retry
              </Button>
            </Alert>
          ) : state === "loading" ? (
            <Spinner className="mx-auto my-6 size-6" />
          ) : filtered.length === 0 ? (
            <Empty
              className="page-x"
              style={{ color: "var(--muted-foreground)", fontSize: 13 }}
            >
              No workouts in this window.
            </Empty>
          ) : isDesktop ? (
            <WorkoutTable
              groups={groups}
              zonesById={zonesById}
              onOpen={(id) =>
                navigate(`/workouts/${id}`, {
                  state: { workout: all.find((w) => w.ID === id) },
                })
              }
            />
          ) : (
            <WorkoutCards
              groups={groups}
              zonesById={zonesById}
              onOpen={(id) =>
                navigate(`/workouts/${id}`, {
                  state: { workout: all.find((w) => w.ID === id) },
                })
              }
            />
          )}

          <div
            className="page-x flex items-center gap-4"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
              paddingBottom: 14,
              marginTop: "auto",
            }}
          >
            <span
              className="num"
              style={{
                font: "400 12px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <Pagination className="ml-auto w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    type="button"

                    style={{ marginLeft: "auto", fontSize: 12 }}
                    disabled={page === 0}
                    onClick={() => setParam("page", String(page - 1))}
                  >
                    Prev
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    type="button"

                    style={{ fontSize: 12 }}
                    disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                    onClick={() => setParam("page", String(page + 1))}
                  >
                    Next
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>{" "}
          </div>
        </PageSection>
        {isDesktop && maxHR > 0 ? (
          <div
            className="page-x flex items-center gap-6 flex-wrap"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
              paddingBottom: 40,
            }}
          >
            {zoneBands(maxHR).map((band, i) => (
              <span
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  font: "400 11.5px var(--font-body)",
                  color: "var(--muted-foreground)",
                }}
              >
                <span
                  style={{ width: 11, height: 11, background: ZONE_COLORS[i] }}
                />
                Zone {i + 1}
                <span
                  className="num"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {band}
                </span>
              </span>
            ))}
            <span
              style={{
                marginLeft: "auto",
                font: "400 11px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              Bands from a maximum of {formatNumber(maxHR)} bpm
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

interface DateGroup {
  key: string;
  label: string;
  workouts: Workout[];
}

function WorkoutTable({
  groups,
  zonesById,
  onOpen,
}: {
  groups: DateGroup[];
  zonesById: Map<string, number[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ width: 72 }}>Time</TableHead>
          <TableHead>Workout</TableHead>
          <TableHead style={{ textAlign: "right", width: 100 }}>
            Duration
          </TableHead>
          <TableHead style={{ textAlign: "right", width: 120 }}>
            Avg / max HR
          </TableHead>
          <TableHead style={{ width: 180 }}>HR zones</TableHead>
          <TableHead style={{ textAlign: "right", width: 100 }}>
            Energy
          </TableHead>
          <TableHead style={{ textAlign: "right", width: 110 }}>
            Distance
          </TableHead>
          <TableHead style={{ width: 130 }}>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <Fragment key={group.key}>
            <TableRow className="grp">
              <TableCell colSpan={8} className="kick">
                {group.label}
              </TableCell>
            </TableRow>
            {group.workouts.map((w) => (
              <TableRow
                key={w.ID}
                style={{ cursor: "pointer" }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(w.ID);
                }}
                onClick={() => onOpen(w.ID)}
              >
                <TableCell className="num" style={{ fontSize: 12.5 }}>
                  {formatClock(w.StartTime)}
                </TableCell>
                <TableCell>
                  <span style={{ fontWeight: 600 }}>
                    {getWorkoutDisplayName(w)}
                  </span>
                </TableCell>
                <TableCell
                  className="num"
                  style={{ textAlign: "right", fontWeight: 600 }}
                >
                  {formatDuration(w.DurationSec)}
                </TableCell>
                <TableCell
                  className="num"
                  style={{
                    textAlign: "right",
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {w.AvgHeartRate
                    ? `${formatNumber(w.AvgHeartRate)} / ${w.MaxHeartRate ? formatNumber(w.MaxHeartRate) : "—"}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <ZoneBar shares={zonesById.get(w.ID) ?? null} />
                </TableCell>
                <TableCell
                  className="num"
                  style={{
                    textAlign: "right",
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {energyKcal(w) != null
                    ? `${formatNumber(energyKcal(w)!)} kcal`
                    : "—"}
                </TableCell>
                <TableCell
                  className="num"
                  style={{
                    textAlign: "right",
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {formatDistance(w.Distance, w.DistanceUnits)}
                </TableCell>
                <TableCell
                  style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}
                >
                  {sourceLabel(w.Source)}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

function WorkoutCards({
  groups,
  zonesById,
  onOpen,
}: {
  groups: DateGroup[];
  zonesById: Map<string, number[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {groups.map((group) => (
        <div key={group.key}>
          <div className="kick row-group">{group.label}</div>
          {group.workouts.map((w) => (
            <div
              key={w.ID}
              className="page-x"
              style={{
                paddingTop: 12,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(w.ID);
              }}
              onClick={() => onOpen(w.ID)}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ font: "600 14px var(--font-body)", flex: 1 }}>
                  {getWorkoutDisplayName(w)}
                </span>
                <span
                  className="num"
                  style={{ font: "700 14px var(--font-body)" }}
                >
                  {formatDuration(w.DurationSec)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    font: "400 11.5px var(--font-body)",
                    color: "var(--muted-foreground)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {[noteFor(w), sourceLabel(w.Source)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span
                  className="num"
                  style={{
                    font: "500 11.5px var(--font-body)",
                    color: "var(--muted-foreground)",
                    whiteSpace: "nowrap",
                    flex: "none",
                  }}
                >
                  {w.AvgHeartRate ? `${formatNumber(w.AvgHeartRate)} bpm` : ""}
                  {energyKcal(w) != null
                    ? ` · ${formatNumber(energyKcal(w)!)} kcal`
                    : ""}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <ZoneBar
                  shares={zonesById.get(w.ID) ?? null}
                  width="100%"
                  height={6}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      type="button"
      onClick={onClick}
    >
      {label}
      <span
        className="num"
        style={{ fontWeight: 400, opacity: 0.65, marginLeft: 7 }}
      >
        {count}
      </span>
    </Button>
  );
}

/** Apple Health reports energy in kJ from some sources; kcal is what the UI states. */
function energyKcal(w: Workout): number | null {
  const value = w.ActiveEnergyBurned ?? w.TotalEnergy;
  if (value == null) return null;
  const units = w.ActiveEnergyUnits || w.TotalEnergyUnits;
  return units === "kJ" ? value / 4.184 : value;
}

/** Only what the title does not already say. */
function noteFor(w: Workout): string {
  if (w.Distance) return formatDistance(w.Distance, w.DistanceUnits);
  return "";
}

function groupByDate(workouts: Workout[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const w of workouts) {
    const date = new Date(w.StartTime);
    const key = date.toISOString().split("T")[0];
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.workouts.push(w);
    else groups.push({ key, label: formatShortDate(date), workouts: [w] });
  }
  return groups;
}

function summarize(workouts: Workout[]) {
  let totalSeconds = 0;
  let energy = 0;
  let hrSum = 0;
  let hrCount = 0;
  let peakHR = 0;
  let distance = 0;
  let withDistance = 0;

  for (const w of workouts) {
    totalSeconds += w.DurationSec;
    const kcal = energyKcal(w);
    if (kcal != null) energy += kcal;
    if (w.AvgHeartRate) {
      hrSum += w.AvgHeartRate;
      hrCount++;
    }
    if (w.MaxHeartRate && w.MaxHeartRate > peakHR) peakHR = w.MaxHeartRate;
    const km = distanceKm(w.Distance, w.DistanceUnits);
    if (km != null) {
      distance += km;
      withDistance++;
    }
  }

  const spanDays =
    workouts.length > 1
      ? Math.max(
          1,
          (new Date(workouts[0].StartTime).getTime() -
            new Date(workouts[workouts.length - 1].StartTime).getTime()) /
            86400000,
        )
      : 7;

  return {
    count: workouts.length,
    totalSeconds,
    energy,
    avgHR: hrCount > 0 ? hrSum / hrCount : 0,
    peakHR,
    distance,
    withDistance,
    perWeek: (workouts.length / spanDays) * 7,
  };
}
