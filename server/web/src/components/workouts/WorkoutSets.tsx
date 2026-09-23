import { useQuery } from "@tanstack/react-query";
import { fetchWorkoutSets, WorkoutSet } from "../../api";

const STRENGTH_TYPES = new Set([
  "Traditional Strength Training",
  "Traditionelles Krafttraining",
  "Functional Strength Training",
  "Funktionales Krafttraining",
  "High Intensity Interval Training",
  "Hochintensives Intervalltraining",
  "Core Training",
  "Kerntraining",
]);

/**
 * Renders the effort rating on the scale the source recorded it. Alpha
 * Progression logs RIR, Hevy logs RPE, and the two run in opposite directions —
 * RIR 1 and RPE 9 describe the same set. Labelling the value prevents reading
 * one as the other.
 */
function formatEffort(set: WorkoutSet): string {
  if (set.RPE != null) return `RPE ${set.RPE.toFixed(1)}`;
  if (set.RIR != null && set.RIR >= 0) return `RIR ${set.RIR.toFixed(1)}`;
  return "-";
}

interface Props {
  workoutId: string;
  workoutName: string;
  alphaSessionName?: string;
  workoutStart?: string;
  workoutEnd?: string;
}

export default function WorkoutSets({
  workoutId,
  workoutName,
  alphaSessionName,
  workoutStart,
  workoutEnd,
}: Props) {
  const isStrength = STRENGTH_TYPES.has(workoutName) || !!alphaSessionName;

  const { data, isLoading, error } = useQuery({
    queryKey: ["workoutSets", workoutId],
    queryFn: () => fetchWorkoutSets(workoutId, workoutStart, workoutEnd),
    enabled: isStrength,
  });

  if (!isStrength) return null;

  if (isLoading) {
    return <span className="skel" style={{ width: "100%", height: 120 }} />;
  }

  if (error || !data || data.length === 0) {
    return null; // No sets data — silently hide
  }

  // Group sets by exercise name, preserving order
  const exercises: {
    name: string;
    equipment: string;
    muscle: string;
    sets: WorkoutSet[];
  }[] = [];
  const exerciseMap = new Map<string, number>();

  for (const set of data) {
    const key = set.ExerciseName;
    if (!exerciseMap.has(key)) {
      exerciseMap.set(key, exercises.length);
      exercises.push({
        name: set.ExerciseName,
        equipment: set.Equipment,
        muscle: set.PrimaryMuscleGroup,
        sets: [],
      });
    }
    exercises[exerciseMap.get(key)!].sets.push(set);
  }

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>Exercises</h2>
      <div style={{ borderTop: "2px solid var(--foreground)", marginTop: 12 }}>
        {exercises.map((ex) => (
          <div key={ex.name} style={{ paddingTop: 18, paddingBottom: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span style={{ font: "600 14px var(--font-body)" }}>{ex.name}</span>
              {ex.equipment ? (
                <span
                  style={{
                    font: "400 12px var(--font-body)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {ex.equipment}
                </span>
              ) : null}
              {ex.muscle ? (
                <span className="tag tag-neutral">
                  {ex.muscle.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60, paddingLeft: 0 }}>Set</th>
                  <th style={{ textAlign: "right" }}>Weight</th>
                  <th style={{ textAlign: "right" }}>Reps</th>
                  <th style={{ textAlign: "right", paddingRight: 0 }}>
                    RIR / RPE
                  </th>
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((set, i) => (
                  <tr
                    key={i}
                    style={{
                      color: set.IsWarmup
                        ? "var(--muted-foreground)"
                        : "var(--foreground)",
                    }}
                  >
                    <td
                      className="num"
                      style={{ paddingLeft: 0, paddingTop: 8, paddingBottom: 8 }}
                    >
                      {set.IsWarmup ? "W" : set.SetNumber}
                    </td>
                    <td
                      className="num"
                      style={{ textAlign: "right", paddingTop: 8, paddingBottom: 8 }}
                    >
                      {set.WeightKg > 0
                        ? `${set.WeightKg.toFixed(1)} kg`
                        : set.IsBodyweightPlus
                          ? "BW"
                          : "—"}
                    </td>
                    <td
                      className="num"
                      style={{ textAlign: "right", paddingTop: 8, paddingBottom: 8 }}
                    >
                      {set.Reps}
                    </td>
                    <td
                      className="num"
                      style={{
                        textAlign: "right",
                        paddingRight: 0,
                        paddingTop: 8,
                        paddingBottom: 8,
                      }}
                    >
                      {formatEffort(set)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
