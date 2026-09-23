import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import NumericField from "../NumericField";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchMaxHeartRate, saveMaxHeartRate } from "../../api";
import { formatNumber } from "../../utils/format";
import { Row } from "./parts";

/**
 * The training zones derive from this figure. Left unset it is measured from
 * the workout history, which makes the bands move retroactively after one hard
 * session — a configured maximum is a physiological constant and holds still.
 */
export default function MaxHeartRateRow() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["max-heart-rate"],
    queryFn: fetchMaxHeartRate,
  });

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !query.data) return;
    setDraft(
      query.data.origin === "configured"
        ? String(Math.round(query.data.bpm))
        : "",
    );
    setLoaded(true);
  }, [loaded, query.data]);

  async function commit(bpm: number) {
    setSaving(true);
    setError(null);
    try {
      await saveMaxHeartRate(bpm);
      await queryClient.invalidateQueries({ queryKey: ["max-heart-rate"] });
      // The zone bars read the same figure.
      queryClient.invalidateQueries({ queryKey: ["workout-zones"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const data = query.data;

  return (
    <Row label="Max heart rate">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <NumericField
          className="num"
          style={{ width: 110 }}

          min={100}
          max={250}

          value={draft === "" ? null : Number(draft)}
          placeholder={data ? String(Math.round(data.observed)) : ""}
          onValueChange={(value) =>
            setDraft(value === null ? "" : String(value))
          }
          aria-label="Maximum heart rate in bpm"
        />
        <span
          style={{
            font: "400 12px var(--font-body)",
            color: "var(--muted-foreground)",
          }}
        >
          bpm
        </span>
        <Button
          variant="outline"
          type="button"

          style={{ fontSize: 12 }}
          disabled={saving || draft === ""}
          onClick={() => commit(Number(draft))}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {data?.origin === "configured" ? (
          <Button
            variant="ghost"
            type="button"

            style={{ fontSize: 12 }}
            disabled={saving}
            onClick={() => {
              setDraft("");
              commit(0);
            }}
          >
            Use automatic
          </Button>
        ) : null}
      </div>

      {(error || query.error) && (
        <Alert variant="error" className="mt-2">
          {error || query.error?.message}
          {query.error && (
            <Button variant="ghost" onClick={() => void query.refetch()}>
              Retry
            </Button>
          )}
        </Alert>
      )}
      <p
        style={{
          font: "400 12px/1.5 var(--font-body)",
          color: "var(--muted-foreground)",
          margin: "8px 0 0",
          maxWidth: "56ch",
        }}
      >
        {!data ? (
          query.isPending ? (
            <Spinner className="size-4" />
          ) : (
            "—"
          )
        ) : data.origin === "configured" ? (
          <>
            Zones derive from your own figure. Without it they would use{" "}
            <span className="num">
              {formatNumber(
                data.estimated > 0 && data.estimated >= data.observed
                  ? data.estimated
                  : data.observed,
                0,
              )}
            </span>{" "}
            bpm
            {data.estimated > 0 && data.estimated >= data.observed
              ? ` — the estimate for age ${data.age}`
              : " — the highest rate your workouts recorded"}
            .
          </>
        ) : data.origin === "estimated" ? (
          <>
            Unset, so zones use the estimate for age {data.age} —{" "}
            <span className="num">{formatNumber(data.estimated, 0)}</span> bpm,
            from 220 minus age. That formula varies by about 10 bpm between
            people, so your own figure is the better one if you know it.
          </>
        ) : (
          <>
            Unset, so zones derive from the highest rate your workouts recorded
            — currently{" "}
            <span className="num">{formatNumber(data.observed, 0)}</span> bpm.
            That figure rises after a hard session and shifts every band with
            it. A date of birth above gives a steadier estimate.
          </>
        )}
      </p>
    </Row>
  );
}
