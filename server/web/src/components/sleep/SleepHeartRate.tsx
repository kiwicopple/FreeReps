import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchTimeSeries, type SleepStage } from "../../api";
import { formatClock } from "../../utils/format";
import Hypnogram, { hourTicks } from "./Hypnogram";

/** Heart rate shares the exact stage time axis; missing buckets break the line. */
export default function SleepHeartRate({ stages, compact = false }: { stages: SleepStage[]; compact?: boolean }) {
  const [show, setShow] = useState(true);
  const start = Math.min(...stages.map((s) => Date.parse(s.StartTime)));
  const end = Math.max(...stages.map((s) => Date.parse(s.EndTime)));
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const query = useQuery({
    queryKey: ["sleep-heart-rate", start, end],
    queryFn: () => fetchTimeSeries("heart_rate", new Date(start).toISOString(), new Date(end).toISOString(), "5min"),
    enabled: valid,
  });
  const points = (query.data ?? []).flatMap((p) => {
    const time = Date.parse(p.time);
    if (p.avg == null || !Number.isFinite(p.avg) || p.avg <= 0 || time + 300000 <= start || time >= end) return [];
    // The API clips readings to the requested night before grouping into buckets.
    return [{ time: Math.max(start, time), value: p.avg }];
  }).sort((a, b) => a.time - b.time);
  const lowest = points.reduce<(typeof points)[number] | null>((low, p) => !low || p.value < low.value ? p : low, null);
  const min = Math.floor(Math.min(...points.map((p) => p.value)) / 10) * 10 - 5;
  const max = Math.ceil(Math.max(...points.map((p) => p.value)) / 10) * 10 + 5;
  const x = (t: number) => (t - start) / (end - start) * 100;
  const y = (v: number) => 90 - (v - min) / (max - min) * 80;
  const path = points.map((p, i) => `${i === 0 || p.time - points[i - 1].time > 300000 ? "M" : "L"}${x(p.time)},${y(p.value)}`).join(" ");
  const overlay = show && lowest ? (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Heart rate in five-minute averages. Lowest ${lowest.value.toFixed(0)} beats per minute around ${formatClock(new Date(lowest.time).toISOString())}.`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
      <path d={path} fill="none" stroke="var(--background)" strokeWidth={5} vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {points.map((p) => <path key={p.time} d={`M${x(p.time)},${y(p.value)}h0.01`} stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
      <line x1={x(lowest.time)} x2={x(lowest.time)} y1={0} y2={100} stroke="var(--primary)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={`M${x(lowest.time)},${y(lowest.value)}h0.01`} stroke="var(--foreground)" strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  ) : undefined;
  return <>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
      <label style={{ display: "flex", gap: 7, alignItems: "center", color: "var(--primary)" }}><Switch  checked={show} onCheckedChange={(checked) => setShow(checked)} /> Heart rate</label>
      {show && lowest && <span>{min}–{max} bpm · bottom to top</span>}
    </div>
    <Hypnogram stages={stages} compact={compact} overlay={overlay} />
    {!compact && <div style={{ position: "relative", height: 20, marginLeft: 52 }}>
      {hourTicks(stages).map((tick) => <span key={tick.pct} style={{ position: "absolute", left: `${tick.pct}%`, transform: "translateX(-50%)", fontSize: 11, color: "var(--muted-foreground)" }}>{tick.label}</span>)}
    </div>}
    {compact && valid && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6 }}><span>{formatClock(new Date(start).toISOString())}</span><span>{formatClock(new Date(end).toISOString())}</span></div>}
    <div aria-live="polite" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 12, color: "var(--muted-foreground)" }}>
      {query.isLoading ? "Loading overnight heart rate…" : query.isError ? <>Heart rate could not load. <Button variant="outline" onClick={() => query.refetch()}>Retry</Button></> : lowest ? <><strong style={{ color: "var(--foreground)" }}>Lowest 5-minute average: {lowest.value.toFixed(0)} bpm around {formatClock(new Date(lowest.time).toISOString())}</strong><br />{Math.floor((lowest.time - start) / 3600000)}h {Math.floor((lowest.time - start) / 60000) % 60}m into the recorded night · {points.length} recorded intervals. Gaps indicate missing readings.</> : "No heart-rate readings for this night yet."}
    </div>
  </>;
}
