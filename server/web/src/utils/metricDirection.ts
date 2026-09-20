/**
 * Which way is better, per metric. Direction is not per sign — resting heart
 * rate falling is an improvement, steps falling is not — so the mapping lives
 * here rather than being inferred at each call site.
 */
export type Direction = "higher" | "lower" | "neutral";

const DIRECTION: Record<string, Direction> = {
  // Cardiovascular
  resting_heart_rate: "lower",
  walking_heart_rate_average: "lower",
  heart_rate_variability: "higher",
  blood_oxygen_saturation: "higher",
  heart_rate: "neutral",
  respiratory_rate: "neutral",
  body_temperature: "neutral",
  blood_pressure_systolic: "lower",
  blood_pressure_diastolic: "lower",
  // The pulse a blood pressure cuff records with each reading. Kept apart from
  // heart_rate, which is a continuous measurement from a different device.
  blood_pressure_heart_rate: "lower",

  // Fitness
  vo2_max: "higher",
  walking_speed: "higher",
  running_speed: "higher",
  walking_step_length: "higher",
  running_stride_length: "neutral",
  cycling_speed: "neutral",
  cycling_cadence: "neutral",

  // Body
  weight_body_mass: "neutral",
  body_mass_index: "neutral",
  body_fat_percentage: "lower",
  fat_mass: "lower",
  lean_body_mass: "higher",
  muscle_mass: "higher",
  // Bone mass and body water move with total weight and hydration state rather
  // than with anything a training decision follows.
  bone_mass: "neutral",
  body_water: "neutral",
  height: "neutral",

  // Activity
  active_energy: "higher",
  basal_energy_burned: "neutral",
  apple_exercise_time: "higher",
  step_count: "higher",
  distance_walking_running: "higher",
  distance_cycling: "higher",
  distance_swimming: "higher",
  flights_climbed: "higher",
  apple_stand_time: "higher",
  apple_move_time: "higher",

  // Sleep
  sleep_analysis: "higher",
  apple_sleeping_wrist_temperature: "neutral",

  // Hearing — loud is worse.
  environmental_audio_exposure: "lower",
  headphone_audio_exposure: "lower",

  // Oura
  oura_readiness_score: "higher",
  oura_sleep_score: "higher",
  oura_activity_score: "higher",
  oura_temperature_deviation: "neutral",
  oura_stress_high: "lower",
  oura_recovery_high: "higher",

  // Training
  training_tonnage: "higher",
};

export function directionOf(metricName: string): Direction {
  return DIRECTION[metricName] ?? "neutral";
}

/**
 * Improvement carries the positive tone, regression the negative one — a
 * diverging blue/amber pair that stays distinguishable under the common colour
 * vision deficiencies. Regression used to share the neutral tone with movement
 * that carries no judgement, which left the two unable to be told apart.
 *
 * A metric with no direction stays neutral whichever way it moves: weight, BMI,
 * heart rate, respiratory rate and the rest of the "neutral" entries above are
 * not the kind of number that gets better or worse on its own. Genuinely flat
 * movement is neutral-500.
 */
export function deltaColor(metricName: string, delta: number | null): string {
  if (delta == null || delta === 0) return "var(--color-neutral-500)";
  const dir = directionOf(metricName);
  if (dir === "neutral") return "var(--color-neutral-700)";
  const improving = dir === "higher" ? delta > 0 : delta < 0;
  return improving ? "var(--color-positive-700)" : "var(--color-negative-700)";
}
