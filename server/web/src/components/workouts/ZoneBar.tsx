import { ZONE_COLORS } from "../../utils/stageColors";

interface Props {
  /** Five fractions summing to 1, or null when the session has no HR samples. */
  shares: number[] | null;
  width?: number | string;
  height?: number;
}

/** One div per zone, sized by its share of the session. */
export default function ZoneBar({ shares, width = 170, height = 14 }: Props) {
  if (!shares || shares.every((s) => s === 0)) {
    return (
      <span
        style={{
          font: "400 12px var(--font-body)",
          color: "var(--muted-foreground)",
        }}
      >
        —
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        border: "1px solid var(--border)",
      }}
    >
      {shares.map((share, i) => (
        <div
          key={i}
          style={{ flex: share, background: ZONE_COLORS[i] }}
          title={`Zone ${i + 1}: ${(share * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}
