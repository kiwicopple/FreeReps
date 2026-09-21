import { useState } from "react";
import type { NutritionProtocol, NutritionTarget } from "../../nutritionApi";
import { saveProtocol } from "../../nutritionApi";
import { nutrientLabel, unitLabel } from "../../utils/nutrition";
export default function ProtocolEditor({
  record,
  version,
  date,
  catalog,
  onClose,
  onSave,
}: {
  record: NutritionProtocol;
  version: number;
  date: string;
  catalog: Record<string, string>;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<NutritionProtocol>(() => ({
    ...structuredClone(record),
    effective_date: date,
  }));
  const [reason, setReason] = useState("Updated nutrition planning targets");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState("");
  function update(key: string, patch: Partial<NutritionTarget>) {
    setDraft((d) => ({
      ...d,
      targets: { ...d.targets, [key]: { ...d.targets[key], ...patch } },
    }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveProtocol(draft, version, reason);
      await onSave();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="nutrition-editor" aria-label="Edit nutrition targets">
      <h2>Edit targets</h2>
      <p className="nutrition-muted">
        Changes apply from the date below. Previous versions remain available.
        Targets are planning references.
      </p>
      <form onSubmit={submit}>
        <div className="nutrition-form-grid">
          <label>
            Effective from
            <input
              required
              type="date"
              value={draft.effective_date}
              onChange={(e) =>
                setDraft({ ...draft, effective_date: e.target.value })
              }
            />
          </label>
          <label>
            Reason
            <input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        <details>
          <summary>Profile and preferences</summary>
          <div className="nutrition-form-grid">
            {(["age", "height_cm", "weight_kg"] as const).map((key) => (
              <label key={key}>
                {key.replace(/_/g, " ")}
                <input
                  type="number"
                  step="any"
                  required
                  value={draft.profile[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      profile: {
                        ...draft.profile,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Reference sex
              <select
                value={draft.profile.sex}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, sex: e.target.value },
                  })
                }
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label>
              Activity
              <input
                value={draft.profile.activity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, activity: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Goal
              <input
                value={draft.profile.goal}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, goal: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <label>
            Food preferences
            <textarea
              value={draft.profile.preferences}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  profile: { ...draft.profile, preferences: e.target.value },
                })
              }
            />
          </label>
          <p className="nutrition-muted">
            Changing profile details does not automatically recalculate targets.
          </p>
        </details>
        {Object.entries(draft.targets).map(([key, t]) => (
          <details key={key}>
            <summary>
              {nutrientLabel(key)} · {t.value} {unitLabel(t.unit)}
            </summary>
            <div className="nutrition-form-grid">
              <label>
                Target ({unitLabel(t.unit)})
                <input
                  required
                  type="number"
                  min="0.000001"
                  step="any"
                  value={t.value}
                  onChange={(e) =>
                    update(key, { value: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Comparison
                <select
                  value={t.kind}
                  onChange={(e) =>
                    update(key, {
                      kind: e.target.value as NutritionTarget["kind"],
                      low: undefined,
                      high: undefined,
                    })
                  }
                >
                  <option value="goal">Goal</option>
                  <option value="range">Range</option>
                  <option value="maximum">Planning maximum</option>
                  <option value="reference">Reference only</option>
                </select>
              </label>
              {t.kind === "range" && (
                <>
                  <label>
                    Range low
                    <input
                      required
                      type="number"
                      min="0"
                      step="any"
                      value={t.low ?? ""}
                      onChange={(e) =>
                        update(key, { low: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Range high
                    <input
                      required
                      type="number"
                      min="0"
                      step="any"
                      value={t.high ?? ""}
                      onChange={(e) =>
                        update(key, { high: Number(e.target.value) })
                      }
                    />
                  </label>
                </>
              )}
              <label>
                Basis / label
                <input
                  required
                  value={t.label}
                  onChange={(e) => update(key, { label: e.target.value })}
                />
              </label>
              <label>
                Source
                <input
                  required
                  value={t.source}
                  onChange={(e) => update(key, { source: e.target.value })}
                />
              </label>
              {[
                "vitamin_d",
                "vitamin_c",
                "calcium",
                "iron",
                "zinc",
                "copper",
                "manganese",
                "selenium",
                "iodine",
                "molybdenum",
                "phosphorus",
                "vitamin_b6",
                "choline",
              ].includes(key) && (
                <label>
                  Total-intake upper limit (optional)
                  <input
                    type="number"
                    step="any"
                    min={t.value}
                    value={t.upper ?? ""}
                    onChange={(e) =>
                      update(key, {
                        upper:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  targets: Object.fromEntries(
                    Object.entries(d.targets).filter(([k]) => k !== key),
                  ),
                }))
              }
            >
              Remove target
            </button>
          </details>
        ))}
        <div className="nutrition-toolbar">
          <select
            aria-label="Nutrient to add"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
          >
            <option value="">Add a target…</option>
            {Object.keys(catalog)
              .filter((k) => !draft.targets[k])
              .sort()
              .map((k) => (
                <option key={k} value={k}>
                  {nutrientLabel(k)}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!add}
            onClick={() => {
              update(add, {
                value: 1,
                unit: catalog[add],
                kind: "goal",
                label: "Personal planning target",
                source: "User-defined target",
              });
              setAdd("");
            }}
          >
            Add
          </button>
        </div>
        <label>
          Protocol notes
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="nutrition-toolbar">
          <button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save targets"}
          </button>
          <button disabled={busy} type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
