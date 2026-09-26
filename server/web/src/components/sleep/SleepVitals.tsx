import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchTimeSeries, type SleepStage } from "../../api";
import { useLocalDay } from "../../hooks/useLocalDay";
import { formatClock } from "../../utils/format";
import {
  prepareSleepVitals,
  sleepWindow,
  type SleepOverlay,
  type SleepVital,
  type SleepWindow,
  type VitalBucket,
} from "../../utils/sleepVitals";
import { queryState } from "../../utils/queryState";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Empty } from "../ui/empty";
import { Spinner } from "../ui/spinner";
import InfoPopover from "../InfoPopover";
import SegmentedControl from "../SegmentedControl";
import Hypnogram, { hourTicks } from "./Hypnogram";

const VITALS = {
  heart_rate: {
    label: "Heart rate",
    unit: "bpm",
    color: "var(--primary)",
    missing: "No heart-rate readings for this night yet.",
  },
  respiratory_rate: {
    label: "Respiratory rate",
    unit: "breaths/min",
    color: "var(--color-respiratory)",
    missing:
      "No respiratory-rate readings for this night yet. Enable detailed Respiratory Rate export in your Apple Health sync.",
  },
} as const;
const OPTIONS = [
  {
    value: "heart_rate",
    label: <span className="text-xs sm:text-sm">Heart rate</span>,
  },
  {
    value: "respiratory_rate",
    label: <span className="text-xs sm:text-sm">Breathing</span>,
  },
  { value: "off", label: <span className="text-xs sm:text-sm">Off</span> },
] as const;
const valueLabel = (n: number) => Number(n.toFixed(1)).toLocaleString("en");
// Include the UTC offset so repeated local hours during travel/DST stay distinguishable.
const intervalLabel = (b: Pick<VitalBucket, "start" | "end">) => {
  const format = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  return `${format.format(b.start)} – ${format.format(b.end)}`;
};

/** Coss owns the controls; the stage plot and vital overlay share one elapsed-time axis. */
export default function SleepVitals({
  stages,
  compact = false,
  value,
  onValueChange,
}: {
  stages: SleepStage[];
  compact?: boolean;
  value: SleepOverlay;
  onValueChange: (value: SleepOverlay) => void;
}) {
  const window = sleepWindow(stages);
  const { timezone } = useLocalDay();
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          options={OPTIONS}
          value={value}
          onChange={onValueChange}
          label="Sleep chart overlay"
        />
        <InfoPopover label="About overnight ranges">
          <p>
            Each bar shows the recorded minimum and maximum in a 15-minute
            interval. A dot means the values were equal or only an average was
            available; the small mark shows the average of recorded five-minute
            averages. Partial ranges include only records with available
            extrema.
          </p>
          <p className="mt-2">
            Empty intervals stay empty. A bar may contain gaps, and record
            counts refer to imported records, not necessarily individual watch
            measurements. Daily summaries cannot reconstruct overnight
            variation; use detailed exports.
          </p>
          <p className="mt-2">
            The lowest five-minute heart-rate average is shown separately from
            the minimum recorded value. Its time identifies an interval, not an
            exact instant.
          </p>
        </InfoPopover>
      </div>
      {value !== "off" && window ? (
        <VitalChart
          key={`${value}-${window.start}-${window.end}-${timezone}`}
          metric={value}
          window={window}
          stages={stages}
          compact={compact}
          timezone={timezone}
        />
      ) : (
        <StagePlot stages={stages} compact={compact} />
      )}
    </div>
  );
}

function VitalChart({
  metric,
  window,
  stages,
  compact,
  timezone,
}: {
  metric: SleepVital;
  window: SleepWindow;
  stages: SleepStage[];
  compact: boolean;
  timezone: string;
}) {
  const vital = VITALS[metric];
  const query = useQuery({
    queryKey: ["sleep-vitals", metric, window.start, window.end, timezone],
    queryFn: () =>
      fetchTimeSeries(
        metric,
        new Date(window.start).toISOString(),
        new Date(window.end).toISOString(),
        "5min",
      ),
  });
  const model = prepareSleepVitals(query.data ?? [], window);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const selected = model.buckets.findIndex((b) => b.start === selectedStart);
  const selectIndex = (index: number | null) =>
    setSelectedStart(
      index == null ? null : (model.buckets[index]?.start ?? null),
    );
  const readoutId = useId();
  const active = model.buckets[selected];
  const state = queryState(query);
  const x = (time: number) =>
    ((time - window.start) / (window.end - window.start)) * 100;
  const y = (v: number) =>
    92 - ((v - model.domain[0]) / (model.domain[1] - model.domain[0])) * 84;
  const overlay = model.buckets.length ? (
    <div
      className="absolute inset-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      role="group"
      aria-label={`${vital.label} intervals. Use Left and Right arrow keys to inspect readings.`}
      aria-describedby={readoutId}
      tabIndex={0}
      onFocus={() => {
        if (selected < 0) selectIndex(0);
      }}
      onKeyDown={(event) => {
        const last = model.buckets.length - 1;
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : event.key === "ArrowRight"
                ? Math.min(last, selected + 1)
                : event.key === "ArrowLeft"
                  ? Math.max(0, selected - 1)
                  : null;
        if (next != null) {
          event.preventDefault();
          selectIndex(next);
        }
        if (event.key === "Escape") selectIndex(null);
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const time =
          window.start +
          ((event.clientX - bounds.left) / bounds.width) *
            (window.end - window.start);
        const index = model.buckets.findIndex(
          (b) => b.start <= time && time < b.end,
        );
        selectIndex(index);
      }}
      onPointerDown={(event) => {
        // Focus first: its keyboard default must not replace a pointer-selected gap.
        event.currentTarget.focus({ preventScroll: true });
        const bounds = event.currentTarget.getBoundingClientRect();
        const time =
          window.start +
          ((event.clientX - bounds.left) / bounds.width) *
            (window.end - window.start);
        const index = model.buckets.findIndex(
          (b) => b.start <= time && time < b.end,
        );
        selectIndex(index);
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block size-full"
        role="img"
        aria-label={`${vital.label} in 15-minute recorded ranges${model.min != null ? `. Minimum ${valueLabel(model.min)}, maximum ${valueLabel(model.max!)} ${vital.unit}` : "; recorded ranges unavailable"}. Gaps indicate missing intervals.`}
      >
        {active && (
          <rect
            x={x(active.start)}
            y={0}
            width={x(active.end) - x(active.start)}
            height={100}
            fill="var(--foreground)"
            opacity={0.08}
          />
        )}
        {model.buckets.map((b, index) => {
          const center = x((b.start + b.end) / 2);
          return (
            <g key={b.start} data-vital-bucket={b.start}>
              <path
                d={`M${center},${y(b.hasRange ? b.min : b.avg)}V${y(b.hasRange ? b.max : b.avg) - 0.01}`}
                fill="none"
                stroke="var(--card)"
                strokeWidth={compact ? 8 : 10}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M${center},${y(b.hasRange ? b.min : b.avg)}V${y(b.hasRange ? b.max : b.avg) - 0.01}`}
                fill="none"
                stroke={vital.color}
                strokeWidth={compact ? 4 : 6}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M${center},${y(b.avg)}h0.01`}
                stroke="var(--foreground)"
                strokeWidth={index === selected ? 4 : 2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        {model.min != null &&
          [model.min, model.max!].map((value, i) => {
            const bucket = model.buckets.find(
              (b) => b.hasRange && (i === 0 ? b.min : b.max) === value,
            )!;
            const center = x((bucket.start + bucket.end) / 2);
            return (
              <g key={i}>
                <path
                  d={`M${center},${y(value)}h0.01`}
                  stroke={vital.color}
                  strokeWidth={compact ? 10 : 12}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`M${center},${y(value)}h0.01`}
                  stroke="var(--card)"
                  strokeWidth={compact ? 5 : 7}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        {metric === "heart_rate" && model.lowestAverage && (
          <line
            x1={x(model.lowestAverage.time)}
            x2={x(model.lowestAverage.time)}
            y1={0}
            y2={100}
            stroke={vital.color}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      {!!model.buckets.length && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            {vital.label}{" "}
            <span className="font-normal text-muted-foreground">
              · {vital.unit}
            </span>
          </span>
          <span className="text-muted-foreground">
            {model.min != null ? (
              <>
                Min{" "}
                <strong className="text-foreground">
                  {valueLabel(model.min)}
                </strong>{" "}
                · Max{" "}
                <strong className="text-foreground">
                  {valueLabel(model.max!)}
                </strong>
              </>
            ) : (
              "Recorded ranges unavailable"
            )}
          </span>
        </div>
      )}
      <StagePlot stages={stages} compact={compact} overlay={overlay} />
      {state === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner />
          Loading overnight {vital.label.toLowerCase()}…
        </p>
      ) : state === "error" || state === "offline" || query.isError ? (
        <Alert variant="error">
          {state === "offline"
            ? "No connection to the server."
            : `${vital.label} could not load.`}
          {query.data && " Showing previously loaded readings."}
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            loading={query.isFetching}
          >
            Retry
          </Button>
        </Alert>
      ) : !model.buckets.length ? (
        <Empty>{vital.missing}</Empty>
      ) : null}
      {!!model.buckets.length && (
        <>
          <div
            className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs"
            id={readoutId}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous recorded interval"
              disabled={selected === 0}
              onClick={() => selectIndex(Math.max(0, selected - 1))}
            >
              <ChevronLeft />
            </Button>
            <div
              className="min-w-0 flex-1 space-y-1"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {active ? (
                <>
                  <p className="font-medium">{intervalLabel(active)}</p>
                  <p>
                    {active.hasRange
                      ? `${valueLabel(active.min)}–${valueLabel(active.max)} ${vital.unit}`
                      : "Range unavailable"}{" "}
                    · Avg {valueLabel(active.avg)} {vital.unit}
                  </p>
                  {active.hasRange && active.partialRange && (
                    <p className="text-muted-foreground">
                      Partial range: some records contain only an average.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {active.count} imported record
                    {active.count === 1 ? "" : "s"} · {active.intervals}{" "}
                    recorded 5-minute interval
                    {active.intervals === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">15-minute recorded ranges</p>
                  <p className="text-muted-foreground">
                    Tap or hover to inspect. Use arrow keys or these buttons to
                    move between intervals.
                  </p>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next recorded interval"
              disabled={selected === model.buckets.length - 1}
              onClick={() =>
                selectIndex(Math.min(model.buckets.length - 1, selected + 1))
              }
            >
              <ChevronRight />
            </Button>
          </div>
          {metric === "heart_rate" && model.lowestAverage && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">
                Lowest 5-minute average: {model.lowestAverage.value.toFixed(0)}{" "}
                bpm around{" "}
                {formatClock(new Date(model.lowestAverage.time).toISOString())}
              </strong>
              <br />
              {Math.floor(
                (model.lowestAverage.time - window.start) / 3_600_000,
              )}
              h{" "}
              {Math.floor((model.lowestAverage.time - window.start) / 60_000) %
                60}
              m into the recorded night · dashed marker.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {model.intervals} recorded 5-minute intervals. Gaps indicate missing
            readings.
            {model.buckets.length < 3 &&
              " Limited overnight data: detailed exports are needed to show variation through the night."}
          </p>
        </>
      )}
    </div>
  );
}

function StagePlot({
  stages,
  compact,
  overlay,
}: {
  stages: SleepStage[];
  compact: boolean;
  overlay?: React.ReactNode;
}) {
  const window = sleepWindow(stages);
  return (
    <div>
      <Hypnogram stages={stages} compact={compact} overlay={overlay} />
      {window && (
        <div
          className={`relative mt-2 h-5 text-[11px] text-muted-foreground ${compact ? "" : "ml-[52px]"}`}
        >
          <span className="absolute left-0">
            {formatClock(new Date(window.start).toISOString())}
          </span>
          {!compact &&
            hourTicks(stages)
              .filter((t) => t.pct > 10 && t.pct < 90)
              .map((tick) => (
                <span
                  key={tick.pct}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${tick.pct}%` }}
                >
                  {tick.label}
                </span>
              ))}
          <span className="absolute right-0">
            {formatClock(new Date(window.end).toISOString())}
          </span>
        </div>
      )}
    </div>
  );
}
