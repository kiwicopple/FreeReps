# Protocol coss/ui migration

## Contract

Keep Protocol's black background, green primary accent, Archivo typography,
branding and mobile navigation. Coss controls define the spacing, borders and
radii; visual parity does not mean pixel equality. All existing routes, URL keys,
preference storage, API methods and payloads stay compatible. Metrics and
Correlations remain desktop-only. No database migration is required.

Only invented health records and credentials are used in tests. Never replace
fixtures with API captures or put personal screenshots, traces, logs, exports or
backups in this repository or public CI artifacts.

## Component map and ownership

| Before                                    | Replacement                                                                      | Acceptance coverage                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Plain action buttons and `.btn`           | Coss Button; Router links with `buttonVariants`                                  | `controls.unit.test.tsx`; navigation and mutation browser tests                     |
| `.input`, handwritten form controls       | Field, Label/FieldLabel, Fieldset, Form, Input, Textarea, Number Field           | `controls.unit.test.tsx`; `nutrition.spec.ts`; `settings.spec.ts`                   |
| Native small selects                      | `Choice` with Coss Select and value callbacks                                    | Target kinds, reference sex, lag and settings payload tests                         |
| Long metric/nutrient selects              | `Choice` with grouped, searchable Coss Combobox                                  | `data.spec.ts`; nutrition trend/target tests                                        |
| SquareCheckbox / SquareSwitch             | Coss Checkbox / Switch                                                           | Keyboard checkbox unit test; front-page visibility; HR overlay; alerts              |
| Desktop range/appearance segments         | `SegmentedControl`, Coss Radio Group with segmented presentation                 | `controls.spec.ts`; theme preference/system/reload checks                           |
| Mobile range overlay                      | Coss Drawer + Radio Group                                                        | Selection, Escape, focus trap/restoration and backdrop tests                        |
| Nutrition custom dialogs / inline details | `ResponsiveDetails`: Coss Drawer on mobile, Collapsible on desktop               | Nested drawers, independent scroll, nutrient-to-trend action, food/protocol details |
| Native `<details>`                        | `Disclosure` over Coss Collapsible                                               | Editor draft stays mounted while independently collapsed                            |
| Browser `confirm()`                       | `ConfirmAction` over Coss Alert Dialog                                           | Cancel: no mutation; confirm: exactly one provider DELETE                           |
| Tags                                      | Coss Badge                                                                       | Sources/ingest state, recovery state, workout effort and trend presentation         |
| Generic tables                            | Coss Table family                                                                | Nutrition history, Today, workout sets, metric and integration rows                 |
| Loading / error / empty presentation      | Skeleton, Spinner, Alert, Empty                                                  | `states.spec.ts`; settings load failures/retry; import failure/retry                |
| Native date control alone                 | `DateControl`: Calendar + Popover desktop / Drawer mobile, direct entry retained | Calendar selection and local date unit test; previous/next/Today/Latest             |
| Settings rail                             | Vertical Coss Tabs linked to `?tab=`                                             | All nine sections; mobile keeps scrolling regions                                   |
| Custom media subscription                 | Upstream `use-media-query`, one `useIsDesktop` wrapper at 768px                  | 767/768px and viewport-resize checks                                                |

Source lives under `server/web/src/components/ui`. Upstream is pinned to coss
revision `59e8c88c4be28cbfdd9eb3cd7274c60ffa91413e`, from the MIT-licensed
`apps/ui/registry/default` tree. See `UPSTREAM.md` and `LICENSE.md` there. Alias
changes and the control-text contrast adjustment are recorded. Update
intentionally; do not regenerate automatically. The lockfile fixes installed
versions.

Semantic Coss tokens now own UI colors, including portals and chart text/grid
colors. Specialized sleep-stage and chart-series colors remain separate. The
`freereps.theme` key and Auto/Light/Dark behavior remain, including first paint
and reacting to system-theme changes. The home-screen manifest names Protocol.

## Feature-to-test ledger

Paths below are relative to `server/web/tests`. Browser checks run in Chromium
at 1440px and WebKit with iPhone emulation. Skips are explicit: desktop-only
analysis on mobile, and drawer-only interactions on desktop.

| Feature group                                                                      | Acceptance tests                                                                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| All nine routes and lazy-loaded entrypoints                                        | `browser/parity.spec.ts`: route cases; production build                                                                     |
| Back/forward, active navigation, Protocol home link, mobile navigation             | `browser/sleep.spec.ts`: route navigation; `browser/parity.spec.ts`                                                         |
| Black/green theme, preference persistence, Auto/system changes                     | `browser/controls.spec.ts`: theme preference and system changes                                                             |
| Today values, units, source, sparkline, metric groups and links                    | `browser/parity.spec.ts`: today and trends; route smoke; `labels.unit.test.ts`                                              |
| Hero visibility, selection order and four-item limit                               | `browser/settings.spec.ts`: front-page visibility, limit, order, save/reset                                                 |
| Nutrition day/7-day/30-day requests, totals, trend selection and day navigation    | `browser/nutrition.spec.ts`: nutrition period totals and trend selection                                                    |
| Missing vs zero, coverage, period averages, effective protocol and target status   | Existing `nutrition.test.ts` numerical cases                                                                                |
| Nutrient education/source links, food contributions and nested Other nutrients     | `browser/parity.spec.ts`; nested drawer case in `browser/nutrition.spec.ts`; all summaries in `domain.unit.test.ts`         |
| Food details and protocol revision history                                         | `browser/nutrition.spec.ts`: period totals, food details and protocol history                                               |
| Independent mobile sheet scrolling and reachable Close                             | `browser/controls.spec.ts`: long nutrition drawer; nested drawer closure test                                               |
| Nutrition profile/preferences, effective date, reason and exact versioned payload  | `browser/nutrition.spec.ts`: profile edits and conflict test                                                                |
| Goal/range/maximum/reference targets, bounds, add/remove targets                   | `browser/nutrition.spec.ts`: comparison parameterization and target addition/removal; `nutrition.test.ts` bounds validation |
| Blank numbers, validation, cancel, pending controls, conflict/draft preservation   | `controls.unit.test.tsx`; editor conflict/cancel cases; alert blank-number case                                             |
| Completion toggle expected-version payload                                         | `browser/nutrition.spec.ts`: cancel and completion                                                                          |
| Sleep previous/next, direct date, Latest and no-data night                         | `browser/parity.spec.ts`; `browser/sleep.spec.ts`; shared date unit/browser cases                                           |
| HR query window, switch, gaps and lowest-point annotation                          | `browser/sleep.spec.ts`: night selection and separate chart segments                                                        |
| Recovery formula, provisional state, baseline exclusion and contributor disclosure | Unchanged `recovery.test.ts`; `browser/sleep.spec.ts`; baseline route checks                                                |
| Sleep stages, composition and night-history presentation                           | Sleep route smoke and synthetic responsive snapshots; original transformations retained                                     |
| Workouts range/type filtering, page reset/counts, detail/back navigation           | `browser/data.spec.ts`: workout pagination/type change; shared range tests                                                  |
| Synthetic strength sessions, exercises/sets and effort units                       | `browser/data.spec.ts`: synthetic strength sessions                                                                         |
| Workout HR timeline, route map, resize and absent-data cases                       | `browser/data.spec.ts`: uPlot and map; workout route and empty/error cases                                                  |
| Metrics grouped selection, URL keys and multiplier-adjusted CSV/filename           | `browser/data.spec.ts`: metric search/CSV and combobox cases                                                                |
| Correlation X/Y/lag selection, pairing, regression and insufficient data           | `browser/data.spec.ts`; `domain.unit.test.ts`; `browser/states.spec.ts`                                                     |
| Trend direction/classification, fitted values and metric links                     | `domain.unit.test.ts`; today/trends case; responsive route checks                                                           |
| Loading, successful, empty, error and retry presentation                           | `browser/states.spec.ts`: six data routes; workout detail error/404 case; settings failures below                           |
| Stale nutrition data and retry without losing loaded totals                        | `browser/states.spec.ts`: refresh failure                                                                                   |
| Responsive layout and chart sizing                                                 | `browser/accessibility.spec.ts`: all routes at 320, 390, 767, 768 and 1440px; map/uPlot resize test                         |
| Accessible names, contrast and keyboard control behavior                           | Axe checks on seven pages; keyboard checkbox, dialog trapping, Escape, backdrop and focus restoration                       |
| Reduced motion and synthetic visual review                                         | All responsive cases emulate reduced motion; optional screenshots with `PW_SCREENSHOTS=1`                                   |

### All nine Settings sections

| Section    | Preserved behavior and specific browser coverage (`settings.spec.ts`)                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity   | Identity/version/statistics, birth date save/clear, maximum-HR override/reset, theme. Exact birth-date and bpm payloads, load failure/retry; theme in `controls.spec.ts`.                                       |
| Sources    | Activity, order, save, existing category overrides and removal. Reorder and removal methods/paths/payloads; load failure/retry.                                                                                 |
| Oura       | Credentials, registered redirect URI, authorization, connection state, sync, disconnect and job information. Synthetic OAuth flow, credential/sync/DELETE contract, cancel/confirm, populated status and retry. |
| Withings   | Credentials, redirect URI, authorization, connection state, sync and disconnect. Same provider request and OAuth contract tests.                                                                                |
| Hevy       | API key, historical start date, key updates, sync and disconnect. Exact key/start-date request; confirmation and retry.                                                                                         |
| Front page | Metric visibility, hero order/limit/selection, save and reset. Explicit payload and disabled-state assertions; failure/retry.                                                                                   |
| Ingest     | Current-origin endpoint, logs, inserted counts and status. Populated narrow-phone log check, empty state, failure/retry.                                                                                        |
| Import     | Keyboard/file picker, drag/drop handlers, remove selection, upload, counts and failures. Synthetic file upload/removal/failure/retry; no real upload.                                                           |
| Alerts     | Reporting, destination, hostname, intervals, threshold, silence threshold, save and test action. Mock requests assert units in seconds; empty fields remain blank and prevent save; failure/retry.              |

All nine section names and `?tab=` navigation are asserted. On mobile the same
sections remain individual scrolling regions rather than local tab state.

## Preserved specialized code

The migration retains uPlot and its sizing adapter, SVG sparklines/hypnograms,
sleep composition and night charts, overnight HR transformation, recovery
calculation, correlation scatterplots, zone graphics and Leaflet maps. API
clients, React Query, Router, source priorities, formatting and nutrition
calculations remain in place. No backend endpoints, schemas, authentication,
ingestion or storage were changed.

## Defects found separately from component replacement

These were UI/interaction defects uncovered by the acceptance checks; they did
not require changing health calculations:

- Synthetic Hevy/Alpha sessions depended on route state in the detail page, but
  the list did not pass that state. List navigation now carries its known
  workout metadata. A synthetic strength-session regression test covers it.
- Several narrow layouts overflowed at 320px or just above the desktop
  breakpoint. Hero grids use shrinking columns; settings/status/log rows wrap.
- Empty workout lists appeared while loading. Settings load failures and an
  unavailable workout could look like missing data. Explicit loading/error/
  empty components now distinguish them and expose retry.
- Some controls lacked accessible names, redirect inputs shared an ID, and
  muted text lost contrast through opacity. Names, generated IDs, link
  underlining and full muted-text opacity address these findings.
- Desktop trend labels lacked the metric links in the preservation contract.
  They now open the metric with the selected range; mobile keeps its desktop-only
  analysis boundary.
- The existing home-screen manifest still said FreeReps. It now matches the
  Protocol page title and branding.

## Staged implementation and cleanup

| Stage                                    | Commit      | Verification / deployment                                                                 |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 0: synthetic baseline and GitHub CI      | `e500ed4`   | Original 22 browser scenarios; numerical tests; type check/build                          |
| 1: pinned Coss source and semantic theme | `da52e9d`   | Theme/build/parity checks; local deployment                                               |
| 2: shared controls, ranges and shell     | `918c9f1`   | Keyboard/theme/route checks; local deployment                                             |
| 3: nutrition drawers, forms and dates    | `194bfeb`   | Nested details, exact writes, blank/conflict/cancel/calendar checks; local deployment     |
| 4: sleep, Today and Trends               | `9a293cd`   | Overnight query/gap/recovery and navigation checks; local deployment                      |
| 5: workouts and desktop analysis         | `7e74855`   | CSV, filters, search, resize/map checks; local deployment                                 |
| 6: Settings and consolidation            | This change | Full browser/unit/build suite, Go verification, docs check; local deployment after checks |

Stage 5's first GitHub run exposed a test timing race: a type-filter URL changed
before its rows finished rendering. The test now waits for the filtered count
before selecting a workout. It must not assume navigation has already rendered.

Removed SquareCheckbox/SquareSwitch, old overlay/portal/body-scroll code, old
form helpers, unused toggle/separator sources and unused direct `date-fns`
dependency (DayPicker's required transitive copy stays). No legacy `.btn`,
`.input`, `.seg`, `.tag`, `.table`, `.rail-item`, `.chip`, `.skel`, custom overlay
rules or temporary theme aliases remain. Domain layout/chart CSS and thin
behavior compositions remain intentionally. No migration flag or dual UI.

## Repeatable release checks

From `server/web`:

```sh
npm ci
npm run build
npm test
npx playwright install chromium webkit
npm run test:e2e
# Optional local-only synthetic screenshots:
PW_SCREENSHOTS=1 npm run test:e2e
```

The GitHub fork's `.github/workflows/web.yml` runs type checking (as part of the
build), production build, tests and Chromium/WebKit browser checks alongside
existing Forgejo checks. There is no artifact-upload step. `test-results` and
Playwright reports are ignored; traces, screenshots and video are off by default.

Browser tests use a separate Vite port, a fixed synthetic time and an allowlisted
fixture API. An unhandled application API request fails the test. All non-test
origins are blocked. OAuth, maps, alerts and imports are intercepted. Mutation
tests assert methods, paths and payloads before responding with invented data.
Only read-only availability checks are performed against the deployed app.

Repository verification also includes Go build, vet, unit tests, golangci-lint
and `tools/check-docs.sh --all`. No Go/SQL changes were made, so database
integration tests are not part of this UI change.

The pre-migration local Docker image is preserved as
`freereps-local-app:pre-coss-20260923`. To roll back, point the app service at that
image and recreate only the app container, without building or touching volumes.

## Final automated verification

- 152 browser cases passed; 6 intentionally skipped by viewport applicability.
- 9 Vitest unit/component cases passed, plus the existing nutrition and recovery
  numerical suites.
- Type checking, production build, Go build/vet/tests, golangci-lint (zero
  issues), documentation check and whitespace check passed.
- Synthetic Nutrition, Sleep, Today and Settings screenshots were visually
  reviewed in Chromium and WebKit. They remain ignored local artifacts.

## Remaining device release check

- [ ] On a physical iPhone, including home-screen mode: open a nutrient, scroll
      the long sheet, open/close a nested nutrient, swipe down to dismiss, select a
      previous sleep date, and check sticky navigation/notch/bottom safe areas.

An operator check was requested. WebKit emulation, focus, backdrop and scrolling
checks pass independently; they do not establish actual iPhone gesture or
home-screen behavior. Keep this item open until the operator reports the result.
