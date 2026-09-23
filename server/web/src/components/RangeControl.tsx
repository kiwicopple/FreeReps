import { useEffect, useId, useState, type ReactNode } from "react";
import { useIsDesktop } from "../hooks/useMediaQuery";

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Radio group name; must be unique when two controls share a page. */
  name?: string;
  /** Shown inside the mobile sheet under the options. */
  note?: ReactNode;
}

const LONG_LABEL: Record<string, string> = {
  "1d": "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "1y": "Last year",
};

/**
 * A real radio group, not buttons. Below the phone breakpoint the segmented
 * control does not fit five options, so it collapses to one chip that opens a
 * sheet.
 */
export default function RangeControl<T extends string>({
  options,
  value,
  onChange,
  name,
  note,
}: Props<T>) {
  const isDesktop = useIsDesktop();
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const [sheetOpen, setSheetOpen] = useState(false);

  // The sheet has no reason to stay open once the layout switches to desktop.
  useEffect(() => {
    if (isDesktop) setSheetOpen(false);
  }, [isDesktop]);

  if (isDesktop) {
    return (
      <span className="seg">
        {options.map((opt) => (
          <label key={opt} className="seg-opt">
            <input
              type="radio"
              name={groupName}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="chip"
        style={{ borderColor: "var(--foreground)", color: "var(--foreground)" }}
        onClick={() => setSheetOpen(true)}
      >
        {LONG_LABEL[value] ?? value}
      </button>

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-30 flex flex-col justify-end"
          style={{
            background: "color-mix(in srgb, var(--foreground) 45%, transparent)",
          }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="bg-background"
            style={{ borderTop: "2px solid var(--foreground)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="kick page-x"
              style={{ paddingTop: 14, paddingBottom: 6 }}
            >
              Range
            </div>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                className="row w-full text-left"
                aria-current={value === opt}
                style={{
                  background:
                    value === opt ? "var(--success-soft)" : "transparent",
                  fontWeight: value === opt ? 600 : 400,
                  minHeight: 48,
                }}
                onClick={() => {
                  onChange(opt);
                  setSheetOpen(false);
                }}
              >
                <span className="flex-1" style={{ fontSize: 14 }}>
                  {LONG_LABEL[opt] ?? opt}
                </span>
                <span className="num kick">{opt}</span>
              </button>
            ))}
            {note ? (
              <p
                className="page-x"
                style={{
                  font: "400 12px/1.5 var(--font-body)",
                  color: "var(--muted-foreground)",
                  paddingTop: 14,
                  paddingBottom: 14,
                  margin: 0,
                }}
              >
                {note}
              </p>
            ) : null}
            <div
              className="page-x"
              style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => setSheetOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
