import { linearRegression } from "./stats";

export type Verdict = "improving" | "flat" | "declining";

/**
 * A verdict is a judgement, so it reads the judgement roles rather than the
 * brand token, in the same pair deltaColor() uses in metricDirection.ts: the
 * Trends page and the delta column of the metric table then state the same
 * thing in the same colour. Before the role split improvement carried the
 * brand and regression carried the tone of a metric that had not moved.
 */
export const VERDICT_COLOR: Record<Verdict, string> = {
  improving: "var(--success-foreground)",
  flat: "var(--muted-foreground)",
  declining: "var(--warning-foreground)",
};

export interface Fit {
  /** Change per day in the metric's own unit. */
  slope: number;
  intercept: number;
  verdict: Verdict;
  /** Fitted value at the first and last day, for drawing the line. */
  startValue: number;
  endValue: number;
}

/**
 * Fits a least-squares line over the series and classifies the direction.
 *
 * A metric counts as flat when the fitted change across the whole window stays
 * inside one standard deviation — a slope that never moves the value out of its
 * own noise is not a trend. Direction then depends on which way is better for
 * that metric, not on the sign of the slope.
 */
export function fitTrend(
  series: (number | null)[],
  betterDirection: "higher" | "lower" | "neutral",
): Fit | null {
  const xs: number[] = [];
  const ys: number[] = [];
  series.forEach((v, i) => {
    if (v != null) {
      xs.push(i);
      ys.push(v);
    }
  });
  if (ys.length < 3) return null;

  const fit = linearRegression(xs, ys);
  if (!fit) return null;

  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance =
    ys.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ys.length;
  const stddev = Math.sqrt(variance);

  const span = series.length - 1;
  const fittedChange = fit.slope * span;

  let verdict: Verdict;
  if (Math.abs(fittedChange) <= stddev || betterDirection === "neutral") {
    verdict = "flat";
  } else {
    const rising = fit.slope > 0;
    const better = betterDirection === "higher" ? rising : !rising;
    verdict = better ? "improving" : "declining";
  }

  return {
    slope: fit.slope,
    intercept: fit.intercept,
    verdict,
    startValue: fit.intercept,
    endValue: fit.intercept + fit.slope * span,
  };
}
