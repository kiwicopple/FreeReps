import SummaryValue, { SummaryGrid } from "@/components/SummaryValue";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchWorkoutDetail, type Workout } from "../api";
import PageHeader from "../components/PageHeader";
import HRTimelineChart from "../components/workouts/HRTimelineChart";
import HRZoneBars from "../components/workouts/HRZoneBars";
import RouteMap from "../components/workouts/RouteMap";
import WorkoutSets from "../components/workouts/WorkoutSets";
import { getWorkoutDisplayName } from "../components/workouts/workoutNames";
import {
  distanceKm,
  formatDistance,
  formatDuration,
  formatNumber,
} from "../utils/format";

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const routeWorkout = (location.state as { workout?: Workout } | null)
    ?.workout;
  // Sessions that live only in workout_sets have no row in the workouts table,
  // so their id cannot be fetched — the list already carries everything shown.
  const isSynthetic =
    routeWorkout?.Source === "Alpha Progression" ||
    routeWorkout?.Source === "Hevy";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workout", id],
    queryFn: () => fetchWorkoutDetail(id!),
    enabled: !!id && !isSynthetic,
  });

  const w = isSynthetic ? routeWorkout! : data;

  if (!isSynthetic && isLoading) {
    return (
      <div className="page-x" style={{ paddingTop: 22 }}>
        <Skeleton style={{ width: 220, height: 34 }} />
      </div>
    );
  }

  if (!w || (!isSynthetic && error)) {
    return (
      <>
        <PageHeader
          kicker="Workout"
          title={
            error && !error.message.startsWith("404:")
              ? "Workout unavailable"
              : "Not found"
          }
          actions={
            <Link
              to="/workouts"
              className={buttonVariants({ variant: "outline" })}
            >
              ← Workouts
            </Link>
          }
        />
        <div className="page-x">
          {error && !error.message.startsWith("404:") ? (
            <Alert variant="error">
              The workout could not be loaded.{" "}
              <Button variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </Alert>
          ) : (
            <Empty>This workout is no longer in the database.</Empty>
          )}
        </div>
      </>
    );
  }

  const hasHR =
    !isSynthetic && data?.HeartRateData && data.HeartRateData.length > 0;
  const hasRoute = !isSynthetic && data?.RouteData && data.RouteData.length > 0;

  const stats: { label: string; value: string; unit?: string }[] = [
    { label: "Duration", value: formatDuration(w.DurationSec) },
  ];
  if (w.ActiveEnergyBurned != null) {
    stats.push({
      label: "Active energy",
      value: formatNumber(w.ActiveEnergyBurned),
      unit: "kcal",
    });
  }
  if (w.AvgHeartRate != null) {
    stats.push({
      label: "Avg HR",
      value: formatNumber(w.AvgHeartRate),
      unit: "bpm",
    });
  }
  if (w.MaxHeartRate != null) {
    stats.push({
      label: "Max HR",
      value: formatNumber(w.MaxHeartRate),
      unit: "bpm",
    });
  }
  if (w.Distance != null && w.Distance > 0) {
    stats.push({
      label: "Distance",
      value: formatDistance(w.Distance, w.DistanceUnits).replace(" km", ""),
      unit: "km",
    });
  }
  if (w.ElevationUp != null && w.ElevationUp > 0) {
    stats.push({
      label: "Elevation",
      value: formatNumber(w.ElevationUp),
      unit: "m",
    });
  }

  return (
    <>
      <PageHeader
        kicker={new Date(w.StartTime).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
        title={getWorkoutDisplayName(w)}
        actions={
          <Link
            to="/workouts"
            className={buttonVariants({ variant: "outline" })}
            style={{ fontSize: 12 }}
          >
            ← Workouts
          </Link>
        }
      />

      <div className="page-x mb-6">
        <SummaryGrid>
          {stats.map((s) => (
            <SummaryValue
              key={s.label}
              label={s.label}
              value={s.value}
              unit={s.unit}
            />
          ))}
        </SummaryGrid>
      </div>
      <div className="page-x space-y-6">
        <WorkoutSets
          workoutId={id!}
          workoutName={w.Name}
          alphaSessionName={w.alpha_session_name}
          workoutStart={isSynthetic ? w.StartTime : undefined}
          workoutEnd={isSynthetic ? w.EndTime : undefined}
        />

        {hasHR ? <HRTimelineChart hrData={data!.HeartRateData!} /> : null}
        {hasHR ? <HRZoneBars hrData={data!.HeartRateData!} /> : null}

        {/* Hidden for indoor or zero-distance workouts: there is no track. */}
        {hasRoute &&
        !w.IsIndoor &&
        (distanceKm(w.Distance, w.DistanceUnits) ?? 0) > 0.1 ? (
          <RouteMap route={data!.RouteData!} />
        ) : null}
      </div>
    </>
  );
}
