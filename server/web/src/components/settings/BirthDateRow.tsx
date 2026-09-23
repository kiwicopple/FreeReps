import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchBirthDate, saveBirthDate } from "../../api";
import { Row } from "./parts";

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
    <Row label="Date of birth">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          className="input num"
          style={{ width: 170 }}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Date of birth"
        />
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
          disabled={saving || draft === stored}
          onClick={() => commit(draft)}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {stored ? (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            disabled={saving}
            onClick={() => {
              setDraft("");
              commit("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <p
        style={{
          font: "400 12px/1.5 var(--font-body)",
          color: "var(--muted-foreground)",
          margin: "8px 0 0",
          maxWidth: "56ch",
        }}
      >
        {error ? (
          <span style={{ color: "var(--success-foreground)" }}>{error}</span>
        ) : query.data?.age ? (
          <>
            Age {query.data.age}. Used only to estimate a maximum heart rate
            when none is set — nothing else reads it.
          </>
        ) : (
          "Used only to estimate a maximum heart rate when none is set — nothing else reads it."
        )}
      </p>
    </Row>
  );
}
