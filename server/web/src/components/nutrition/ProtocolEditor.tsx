import { Field, FieldLabel } from "../ui/field";
import NumericField from "../NumericField";
import { Alert } from "../ui/alert";
import DateControl from "@/components/DateControl";
import Choice from "@/components/Choice";
import { Input } from "@/components/ui/input";
import Disclosure from "@/components/Disclosure";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { NutritionProtocol, NutritionTarget } from "../../nutritionApi";
import { saveProtocol } from "../../nutritionApi";
import { nutrientLabel, unitLabel } from "../../utils/nutrition";
type DraftTarget = Omit<NutritionTarget, "value"> & {value:number|null};
type DraftProtocol = Omit<NutritionProtocol,"profile"|"targets"> & {profile: Omit<NutritionProtocol["profile"],"age"|"height_cm"|"weight_kg"> & {age:number|null;height_cm:number|null;weight_kg:number|null}; targets:Record<string,DraftTarget>};
function requiredNumber(value:number|null, label:string) { if(value===null)throw new Error(`${label} is required.`); return value; }
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
  const [draft, setDraft] = useState<DraftProtocol>(() => ({
    ...structuredClone(record),
    effective_date: date,
  }));
  const [reason, setReason] = useState("Updated nutrition planning targets");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState("");
  function update(key: string, patch: Partial<DraftTarget>) {
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
      const protocol: NutritionProtocol = {...draft,
        profile: {...draft.profile, age:requiredNumber(draft.profile.age,"Age"),height_cm:requiredNumber(draft.profile.height_cm,"Height"),weight_kg:requiredNumber(draft.profile.weight_kg,"Weight")},
        targets:Object.fromEntries(Object.entries(draft.targets).map(([key,target])=>{
          if(target.kind==="range"&&(target.low===undefined||target.high===undefined))throw new Error(`${nutrientLabel(key)} range bounds are required.`);
          return [key,{...target,value:requiredNumber(target.value,nutrientLabel(key))}];
        }))
      };
      await saveProtocol(protocol, version, reason);
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
          <Field><FieldLabel>
            Effective from
            </FieldLabel><DateControl
              required

              value={draft.effective_date}
              onValueChange={(value) =>
                setDraft({ ...draft, effective_date: value })
              }
            />
          </Field>
          <Field><FieldLabel>
            Reason
            </FieldLabel><Input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <Disclosure>
          <summary>Profile and preferences</summary>
          <div className="nutrition-form-grid">
            {(["age", "height_cm", "weight_kg"] as const).map((key) => (
              <Field key={key}><FieldLabel>
                {key.replace(/_/g, " ")}
                </FieldLabel><NumericField


                  required
                  value={draft.profile[key]}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      profile: {
                        ...draft.profile,
                        [key]: value,
                      },
                    })
                  }
                />
              </Field>
            ))}
            <Field><FieldLabel>
              Reference sex
              </FieldLabel><Choice
                value={draft.profile.sex}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, sex: value },
                  })
                }
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Choice>
            </Field>
            <Field><FieldLabel>
              Activity
              </FieldLabel><Input
                value={draft.profile.activity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, activity: e.target.value },
                  })
                }
              />
            </Field>
            <Field><FieldLabel>
              Goal
              </FieldLabel><Input
                value={draft.profile.goal}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, goal: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <Field><FieldLabel>
            Food preferences
            </FieldLabel><Textarea
              value={draft.profile.preferences}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  profile: { ...draft.profile, preferences: e.target.value },
                })
              }
            />
          </Field>
          <p className="nutrition-muted">
            Changing profile details does not automatically recalculate targets.
          </p>
        </Disclosure>
        {Object.entries(draft.targets).map(([key, t]) => (
          <Disclosure key={key}>
            <summary>
              {nutrientLabel(key)} · {t.value} {unitLabel(t.unit)}
            </summary>
            <div className="nutrition-form-grid">
              <Field><FieldLabel>
                Target ({unitLabel(t.unit)})
                </FieldLabel><NumericField
                  required

                  min={0.000001}

                  value={t.value}
                  onValueChange={(value) =>
                    update(key, { value: value })
                  }
                />
              </Field>
              <Field><FieldLabel>
                Comparison
                </FieldLabel><Choice
                  value={t.kind}
                  onValueChange={(value) =>
                    update(key, {
                      kind: value as NutritionTarget["kind"],
                      low: undefined,
                      high: undefined,
                    })
                  }
                >
                  <option value="goal">Goal</option>
                  <option value="range">Range</option>
                  <option value="maximum">Planning maximum</option>
                  <option value="reference">Reference only</option>
                </Choice>
              </Field>
              {t.kind === "range" && (
                <>
                  <Field><FieldLabel>
                    Range low
                    </FieldLabel><NumericField
                      required

                      min={0}

                      value={t.low ?? null}
                      onValueChange={(value) =>
                        update(key, { low: value??undefined })
                      }
                    />
                  </Field>
                  <Field><FieldLabel>
                    Range high
                    </FieldLabel><NumericField
                      required

                      min={0}

                      value={t.high ?? null}
                      onValueChange={(value) =>
                        update(key, { high: value??undefined })
                      }
                    />
                  </Field>
                </>
              )}
              <Field><FieldLabel>
                Basis / label
                </FieldLabel><Input
                  required
                  value={t.label}
                  onChange={(e) => update(key, { label: e.target.value })}
                />
              </Field>
              <Field><FieldLabel>
                Source
                </FieldLabel><Input
                  required
                  value={t.source}
                  onChange={(e) => update(key, { source: e.target.value })}
                />
              </Field>
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
                <Field><FieldLabel>
                  Total-intake upper limit (optional)
                  </FieldLabel><NumericField


                    min={t.value??0}
                    value={t.upper ?? null}
                    onValueChange={(value) =>
                      update(key, {
                        upper:
                          value === null
                            ? undefined
                            : value,
                      })
                    }
                  />
                </Field>
              )}
            </div>
            <Button variant="outline"
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
            </Button>
          </Disclosure>
        ))}
        <div className="nutrition-toolbar">
          <Choice searchable
            aria-label="Nutrient to add"
            value={add}
            onValueChange={(value) => setAdd(value)}
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
          </Choice>
          <Button variant="outline"
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
          </Button>
        </div>
        <Field><FieldLabel>
          Protocol notes
          </FieldLabel><Textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="nutrition-toolbar">
          <Button loading={busy} type="submit">
            {busy ? "Saving…" : "Save targets"}
          </Button>
          <Button variant="outline" disabled={busy} type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
