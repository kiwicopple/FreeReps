# Today metric details

Every loaded Today metric has a details action: the configurable hero cards,
desktop table rows and mobile rows. Desktop opens a right sheet; mobile opens a
scrolling bottom drawer. Closing restores the originating control's focus.
Route, page-range and interaction-breakpoint changes close the read-only sheet.
The desktop sheet retains a link to full Metrics analysis; that route remains
desktop-only.

## Content and data

- Latest reading, its original display unit, source and date.
- A plain-language definition and guidance on interpreting the metric.
- A selectable daily chart for 1d, 7d, 30d, 90d and 1y, with exact dated values.
- Recent and previous complete-week averages, recording coverage, and an earlier
  personal range where sufficient history exists.
- Direct educational references and an explanation of comparison methods.

The chart uses the existing `/api/v1/metrics/latest?range=` response and its
`window_start`, preserving the dashboard's source selection and daily totals or
averages. Chart range changes are local to the sheet; they do not change the
page range or its URL. A separate cached 30-day response supplies personal
context when viewing a shorter or longer chart. No endpoints, ingestion,
preferences or storage schemas change. Display multipliers apply exactly once;
missing values stay missing, genuine zero stays zero, and chart gaps remain gaps.
All daily labels retain the server's UTC bucket dates. Today appears in charts
but is excluded from personal comparisons because it can be incomplete.

## Interpretation boundaries

Definitions live in `server/web/src/utils/metricInfo.ts`, with direct references
reviewed on 2026-09-24. Dietary metrics reuse existing nutrient education. The
catalog covers all metric identifiers registered by the repository migrations.
Unknown future metrics still open and show history, but explicitly have no
curated definition, healthy range or preferred direction.

The personal comparison uses the last seven complete days versus the seven
before them and requires at least four recorded days in each. It compares
means of available days, never zero-filling gaps. Changes within 3% of the
earlier mean are labelled little change: this is a descriptive display rule,
not a clinical cutoff or significance test. Sparse and stale history receive
no directional assessment.

The earlier typical range is the 25th to 75th percentile of the 21 days before
the recent week, requiring at least seven recorded days. It is explicitly
labelled as a personal distribution, not a medical target. General adult
reference information is educational and does not classify the user's health.
Context-dependent metrics, including body mass, blood pressure, glucose,
oxygen saturation and medication records, do not get automatic good/bad
judgments. Where a direction can be useful, its interpretation remains
conditional on measurement conditions and the metric's explanation. Existing
Today deltas, recovery calculations and Trends formulas remain unchanged.

## Verification

`metric-insight.unit.test.ts` covers bucket dates, multipliers, missing versus
zero, complete-week exclusions, sparse/stale histories, clinical neutrality and
catalog coverage. `metric-chart.unit.test.tsx` checks axis formatting and gap
semantics. `metric-details.spec.ts` exercises all entrypoints, range selection,
dated values, reference links, loading/errors/retry, keyboard focus, chart sizing,
scrolling and accessibility in Chromium and WebKit with both palettes at 320,
390, 767, 768, 1024 and 1440px. Existing navigation, numerical and exact-payload
acceptance checks remain in the full suite.

Local verification on 2026-09-24 passed 226 browser checks (six intentional
viewport skips), 17 component/unit checks and the existing four nutrition and
recovery checks, plus the production build, Go build/vet/tests and lint.

All fixtures and review screenshots are invented. Generated screenshots remain
ignored and are not committed. Live checks are read-only. Physical iPhone swipe,
keyboard and home-screen safe-area checks remain separate from browser emulation
and require operator verification.
