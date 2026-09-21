export interface NutrientValue {
  value: number;
  unit: string;
  basis: string;
  confidence: string;
  reference: string;
  low?: number;
  high?: number;
}
export interface FoodItem {
  name: string;
  kind: string;
  portion: string;
  assumptions: string;
  nutrients: Record<string, NutrientValue>;
}
export interface FoodRecord {
  version: number;
  entry: {
    id: string;
    local_date: string;
    eaten_at?: string;
    time_precision: string;
    timezone: string;
    meal: string;
    notes: string;
    status: string;
    items: FoodItem[];
  };
}
export interface NutrientTotal {
  unit: string;
  known_subtotal: number | null;
  known_items: number;
  total_items: number;
  complete_for_logged_items: boolean;
  estimated_items: number;
  low?: number;
  high?: number;
}
export interface FoodDay {
  date: string;
  entries: number;
  items: number;
  nutrients: Record<string, NutrientTotal>;
}
export interface FoodLog {
  entries: FoodRecord[];
  days: FoodDay[];
}
export interface NutritionTarget {
  value: number;
  unit: string;
  kind: "goal" | "range" | "maximum" | "reference";
  low?: number;
  high?: number;
  label: string;
  source: string;
  upper?: number;
}
export interface NutritionProfile {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  activity: string;
  goal: string;
  preferences: string;
}
export interface NutritionProtocol {
  effective_date: string;
  timezone: string;
  profile: NutritionProfile;
  notes: string;
  targets: Record<string, NutritionTarget>;
}
export interface ProtocolRecord {
  protocol: NutritionProtocol;
  version: number;
  reason: string;
  recorded_at: string;
}
export interface DayCompletion {
  date: string;
  complete: boolean;
  version: number;
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    "/api/v1/" + path,
    body === undefined
      ? undefined
      : {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.error || `Request failed (${res.status})`);
  }
  return res.json();
}
export const getFoodLog = (start: string, end: string) =>
  request<FoodLog>(`food?start=${start}&end=${end}`);
export const getCatalog = () => request<Record<string, string>>("food/catalog");
export const getProtocols = () =>
  request<ProtocolRecord[]>("nutrition/protocol");
export const getNutritionDays = (start: string, end: string) =>
  request<DayCompletion[]>(`nutrition/days?start=${start}&end=${end}`);
export const saveProtocol = (
  protocol: NutritionProtocol,
  expected_version: number,
  reason: string,
) =>
  request<ProtocolRecord>("nutrition/protocol", {
    protocol,
    expected_version,
    reason,
  });
export const saveCompletion = (
  date: string,
  complete: boolean,
  expected_version: number,
) =>
  request<DayCompletion>(`nutrition/days/${date}`, {
    complete,
    expected_version,
  });
