import type { FoodDay, NutritionTarget, ProtocolRecord } from "../nutritionApi";
export const labels: Record<string, string> = {
  energy: "Calories",
  carbohydrate: "Carbohydrate",
  fiber: "Fiber",
  water: "Water",
  epa: "EPA",
  dha: "DHA",
  ala: "ALA",
  vitamin_a_rae: "Vitamin A (RAE)",
  vitamin_e_alpha_tocopherol: "Vitamin E",
  folate_dfe: "Folate (DFE)",
  folate_total: "Total folate",
  folic_acid: "Folic acid",
  thiamin_b1: "Thiamin (B1)",
  riboflavin_b2: "Riboflavin (B2)",
  niacin_b3: "Niacin (B3)",
  pantothenic_acid_b5: "Pantothenic acid (B5)",
  biotin_b7: "Biotin (B7)",
};
export const nutrientLabel = (key: string) =>
  labels[key] ||
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const unitLabel = (unit: string) => (unit === "ug" ? "µg" : unit);
export const amount = (v: number | null | undefined) =>
  v == null
    ? "Unknown"
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v);
export { localToday, validDate, shiftDate } from "./localDate.ts";
export function protocolForDate(records: ProtocolRecord[], date: string) {
  return records
    .filter((r) => r.protocol.effective_date <= date)
    .sort(
      (a, b) =>
        b.protocol.effective_date.localeCompare(a.protocol.effective_date) ||
        b.version - a.version,
    )[0]?.protocol;
}
export function averageKnown(days: FoodDay[], key: string) {
  const values = days
    .map((d) => d.nutrients[key]?.known_subtotal)
    .filter((v): v is number => v != null);
  return {
    value: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    count: values.length,
  };
}
export function targetStatus(
  value: number | null,
  target: NutritionTarget | undefined,
  complete: boolean,
  covered: boolean,
) {
  if (value == null) return "Unknown";
  if (!target) return "No target";
  if (target.upper != null && value > target.upper)
    return "Above reference limit";
  if (target.kind === "reference") return "Reference only";
  if (target.kind === "maximum")
    return value > target.value
      ? "Above planning limit"
      : complete && covered
        ? "Within planning limit"
        : "Within limit so far";
  const lower = target.kind === "range" ? target.low! : target.value;
  if (value < lower)
    return complete && covered ? "Potential shortfall" : "Below target so far";
  if (target.kind === "range" && value > target.high!)
    return "Above planning range";
  return complete && covered
    ? "Target reached"
    : "Logged amount reaches target";
}
export function sourceURL(source: string) {
  try {
    const u = new URL(source);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
