/** Readable labels for imported metrics that have no configured display name. */
const labels: Record<string, string> = {
  walking_asymmetry_percentage: "Walking Asymmetry",
  walking_double_support_percentage: "Walking Double Support",
  apple_walking_steadiness: "Walking Steadiness",
  heart_rate_recovery_one_minute: "Heart Rate Recovery (1 min)",
  six_minute_walk_test_distance: "6-Minute Walk Distance",
  forced_expiratory_volume_1: "Forced Expiratory Volume (1 sec)",
  distance_wheelchair: "Wheelchair Distance",
  distance_downhill_snow_sports: "Downhill Snow Sports Distance",
  number_of_times_fallen: "Falls",
  dietary_energy_consumed: "Dietary Energy",
  dietary_fat_total: "Total Fat",
  dietary_fat_saturated: "Saturated Fat",
  dietary_fat_monounsaturated: "Monounsaturated Fat",
  dietary_fat_polyunsaturated: "Polyunsaturated Fat",
};

const acronyms: Record<string, string> = {
  bmi: "BMI", bp: "BP", hr: "HR", hrv: "HRV", uv: "UV",
  vo2: "VO2", spo2: "SpO2", ecg: "ECG", hba1c: "HbA1c",
  ldl: "LDL", hdl: "HDL", rmssd: "RMSSD", sdnn: "SDNN",
};

export function metricLabel(name: string, displayLabel?: string): string {
  const configured = displayLabel?.trim();
  if (configured && !configured.includes("_")) return configured;
  if (labels[name]) return labels[name];
  return name
    .replace(/^(oura|apple|dietary)_/, "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => acronyms[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
