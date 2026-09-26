# Overnight vital overlays

## Chart decision

Reviewed on 2026-09-26 before implementation. Retain the existing SVG hypnogram
and uPlot for other time-series views. The sleep chart combines stage intervals
with a small number of recorded vital ranges on one shared elapsed-time axis.
No additional chart dependency is needed for this feature. Non-chart controls
use the existing pinned coss components and theme tokens.

| Option | Strength | Decision for this change |
| --- | --- | --- |
| SVG plus existing uPlot | Exact stage/range geometry, small payload, established theme integration | Keep; isolate bucket preparation and test chart interaction |
| Recharts | React composition, ranged bars, responsive container and keyboard accessibility | Revisit if several dashboard charts need shared cursor/brush behavior |
| Apache ECharts | Linked zoom, many series types, custom rendering and touch targeting | More lifecycle/configuration work than this small overnight view requires |
| visx | Modular React/D3 geometry primitives | Still requires application-owned interaction and accessibility |

Primary references: [coss catalogue](https://coss.com/ui/docs),
[coss segmented controls](https://coss.com/ui/docs/components/segmented-control),
[uPlot](https://github.com/leeoniya/uPlot),
[Recharts Bar](https://recharts.github.io/en-US/api/Bar/),
[Recharts accessibility](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx),
[ECharts modular imports](https://echarts.apache.org/handbook/en/basics/import/),
[ECharts touch targeting](https://echarts.apache.org/handbook/en/how-to/interaction/coarse-pointer/),
[visx](https://github.com/airbnb/visx).

## Interaction and data contract

- Heart rate / Breathing / Off is a coss radio-based segmented control. Heart
  rate is the default; selection survives night changes and responsive layout
  changes while the Sleep page remains open.
- Query the existing `timeseries` endpoint with `heart_rate` or
  `respiratory_rate`, the exact stage-window timestamps, `agg=5min` and the
  device time zone. No endpoint, ingestion, storage or recovery changes.
- Combine five-minute points into 15-minute UTC-aligned intervals. This preserves
  the repeated hour at DST fall-back. Clip first/last interval bounds to the
  requested night; the API filters actual records before bucketing.
- Bars show known imported minima/maxima; the small mark shows the equally
  weighted mean of recorded five-minute averages, matching the API's weighting.
  Higher sampling frequency does not overweight the displayed average.
- Missing intervals remain absent. Equal values render a dot. Average-only data
  also render a dot, explicitly without a measured range. Mixed records retain
  their known extrema and disclose partial ranges in the readout.
- Min/max circles identify the first interval containing each extreme, not the
  exact measurement time. Preserve the existing lowest five-minute heart-rate
  average, its approximate time and elapsed offset as a separate dashed marker.
- Pointer movement/tap selects recorded intervals. One keyboard focus target
  supports arrows, Home, End and Escape; coss previous/next buttons offer the
  same inspection on touch. The live readout includes interval bounds and UTC
  offsets, range, average and imported record count. Selection uses interval
  identity rather than array index so refreshes do not change it silently.
- Loading, empty, offline and failed queries remain distinct. Failed refreshes
  identify cached readings and offer Retry. Selecting Off leaves the stage plot.

## Interpretation limits

Imported records are not necessarily individual watch measurements. The current
API does not expose observation duration or provenance on time-series points.
For example, Oura respiratory data can be one nightly average stored under its
date; daily Health Auto Export summaries also cannot reconstruct overnight
variation. The interface describes recorded intervals, flags very sparse data,
and explains that detailed exports are needed. It does not interpolate a full
night, infer exact times of extrema, classify readings medically, or change the
recovery score.

## Verification

Synthetic unit tests cover extrema, equal weighting, partial/absent ranges,
lowest-average ties, empty/constant histories, malformed values, clipped bounds,
DST repeated hours and selection retention after background refreshes. Browser
checks exercise query parameters, both metrics, Off, sparse gaps, pointer/touch
and keyboard inspection, errors/retry, dates and responsive state.

Chromium/WebKit checks cover both palettes, reduced motion, accessible controls,
sidebar resizing and widths 320, 390, 767, 768, 1024, 1279, 1280 and 1440px.
Optional review screenshots use invented data and stay in ignored test output.
Existing recovery and other acceptance assertions remain in the full suite.
Physical iPhone scrolling, home-screen safe areas and real-device gestures need
operator verification separately from WebKit emulation.
