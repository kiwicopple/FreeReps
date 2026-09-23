import { Field, FieldLabel, FieldDescription, FieldError } from "../ui/field";
import { Alert } from "@/components/ui/alert";
import DateControl from "@/components/DateControl";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchBirthDate, saveBirthDate } from "../../api";

/**
 * The only personal detail the app stores, and it has exactly one consumer:
 * the estimated maximum heart rate. The copy says so, because a health app
 * asking for a birth date otherwise invites the question what else it is for.
 */
export default function BirthDateRow() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["birth-date"], queryFn: fetchBirthDate });

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !query.data) return;
    setDraft(query.data.birth_date);
    setLoaded(true);
  }, [loaded, query.data]);

  async function commit(value: string) {
    setSaving(true);
    setError(null);
    try {
      await saveBirthDate(value);
      await queryClient.invalidateQueries({ queryKey: ["birth-date"] });
      // The estimate and the zone bars both read it.
      queryClient.invalidateQueries({ queryKey: ["max-heart-rate"] });
      queryClient.invalidateQueries({ queryKey: ["workout-zones"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const stored = query.data?.birth_date ?? "";

  return (
    <Field className="grid items-baseline gap-2.5 border-b py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
      <FieldLabel className="text-xs font-medium text-muted-foreground">
        Date of birth
      </FieldLabel>
      <div className="min-w-0 space-y-2">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <DateControl
            className="num"
            style={{ width: 240, maxWidth: "100%" }}

            value={draft}
            onValueChange={(value) => setDraft(value)}
            aria-label="Date of birth"
          />
          <Button
            variant="outline"
            type="button"

            style={{ fontSize: 12 }}
            disabled={saving || draft === stored}
            onClick={() => commit(draft)}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {stored ? (
            <Button
              variant="ghost"
              type="button"

              style={{ fontSize: 12 }}
              disabled={saving}
              onClick={() => {
                setDraft("");
                commit("");
              }}
            >
              Clear
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
        <FieldDescription>
          {query.data?.age ? (
            <>
              Age {query.data.age}. Used only to estimate a maximum heart rate
              when none is set — nothing else reads it.
            </>
          ) : (
            "Used only to estimate a maximum heart rate when none is set — nothing else reads it."
          )}
        </FieldDescription>
        <FieldError />
      </div>
    </Field>
  );
}
