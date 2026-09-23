/**
 * Sleep stages and heart rate zones share one sequential data ramp. The order
 * lives in lightness alone, so it survives greyscale and colour vision
 * deficiency. Zones take the steps by index; stages go through the
 * --color-stage-* aliases, because their mapping turns over with the theme —
 * Deep belongs at the dark end of the ramp and Awake at the light one. None of
 * these is the accent, which means brand and selection.
 *
 * One mapping, shared by the desktop and phone layouts.
 */

export const STAGE_COLOR: Record<string, string> = {
  Deep: "var(--color-stage-deep)",
  Core: "var(--color-stage-core)",
  REM: "var(--color-stage-rem)",
  Awake: "var(--color-stage-awake)",
};

/** Top to bottom in the hypnogram: shallowest first. */
export const STAGE_LANES = ["Awake", "REM", "Core", "Deep"] as const;

/** Darkest = deepest, so the composition bar reads as a depth ramp. */
export const STAGE_COMPOSITION_ORDER = [
  "Deep",
  "Core",
  "REM",
  "Awake",
] as const;

export function stageColor(stage: string): string {
  return STAGE_COLOR[stage] ?? "var(--muted-foreground)";
}

export const ZONE_COLORS = [
  "var(--color-data-1)",
  "var(--color-data-2)",
  "var(--color-data-3)",
  "var(--color-data-4)",
  "var(--color-data-5)",
];

/**
 * Zone boundaries as fractions of max heart rate. The screen states the bpm
 * bands computed from the user's own maximum rather than hardcoding them.
 */
export const ZONE_BOUNDS = [0.6, 0.7, 0.8, 0.9];

export function zoneBands(maxHR: number): string[] {
  const edges = ZONE_BOUNDS.map((f) => Math.round(maxHR * f));
  return [
    `< ${edges[0]}`,
    `${edges[0]}–${edges[1]}`,
    `${edges[1]}–${edges[2]}`,
    `${edges[2]}–${edges[3]}`,
    `> ${edges[3]}`,
  ];
}

/** Which zone a heart rate lands in, 0-indexed. */
export function zoneOf(bpm: number, maxHR: number): number {
  const f = bpm / maxHR;
  for (let i = 0; i < ZONE_BOUNDS.length; i++) {
    if (f < ZONE_BOUNDS[i]) return i;
  }
  return ZONE_BOUNDS.length;
}
