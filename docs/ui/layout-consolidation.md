# Protocol layout consolidation

This release keeps the black/green Protocol theme, Archivo, routes,
768px interaction boundary and all existing domain behavior. Metrics and
Correlations remain desktop-only. There are no backend, schema, data volume,
or API payload changes. The only new local preference is
`protocol.sidebar.collapsed`; nutrition gains an optional `tab` query parameter.

## Shared compositions

- `PageHeader` shows only the page title and essential range/actions in one
  consistent row. Sleep and Nutrition place their date navigation directly
  beneath it. Subtitle lines, sync metadata and the nutrition timezone line
  are omitted; workout timestamps remain in the detail content.
  The secondary bar sticks to the top of the content area at every width. Its measured height reserves scroll clearance
  for keyboard focus and forms, including wrapped date controls and safe areas.
- `PageSection` supplies a semantic heading, description, actions, padded or
  flush content and optional footer using one coss Card. Table sections use
  CardFrame with Table variant="card", without an intermediate bordered Card.
  Frame decorations sit behind content so filter labels and counts stay legible. Table rows and
  secondary nutrient values remain rows, rather than individual cards.
- `SummaryGrid`, `SummaryValue` and `SummaryContent` own the shared key-metric
  card layout, typography and subtle green accent. Cards precede the detail
  sections on Today, Nutrition, Sleep, Workouts/detail, Metrics, Correlations
  and Trends. Callers retain calculations and formatting, including missing
  versus zero values. Secondary nutrient values remain compact rows.
- `DateNavigator` groups Previous/date/Next and keeps Today or Latest adjacent.
  `DatePicker` owns the shared Calendar, Popover/Drawer and validated direct
  entry. Calendar selection applies immediately; Apply/Enter validates typed
  dates. Its public values are local date-only strings. Editable form dates
  keep their blank/required behavior and only one visible calendar trigger.
- `Choice` takes typed option arrays with optional groups and disabled states.
  `Disclosure` takes a trigger and content. `ResponsiveDetails` takes a title,
  trigger and content or content callback. A callback can close the current
  detail and its ancestors when navigating to a trend; ordinary Close actions
  only close the current sheet. No markup inspection or delegated DOM clicks.
  Every nutrient, food entry and supplement opens a right-side Sheet on desktop
  (maximum 512px) and a bottom Drawer on mobile (maximum 90dvh), with independent
  scrolling and visible Close actions. Trend actions wait for the outer sheet
  to finish closing before selecting Overview and focusing the trend section.
  Route, date and tab changes dismiss read-only sheets.
- Editable settings use coss Field/FieldLabel/FieldDescription/FieldError;
  read-only rows and separate save operations remain distinct.
  Identity fields wait for their initial preferences before allowing edits,
  so a delayed response cannot overwrite a new draft. A delayed-response
  acceptance test covers this race in both browsers.

Content is centered at a maximum width of 1440px, with 20px mobile and 32px
desktop padding, 24px section gaps and 16px/24px panel padding. The desktop
analysis panels switch from stacked to adjacent at 960px of available content
width, using the shared PageContent CSS container rather than viewport width. General typography
resets live in the CSS base layer so component utility styles take precedence.
Navigation safe areas and specialized chart/map implementations are retained.

Card, Group, Meter, Sheet, Menu, Tooltip, Breadcrumb, Input Group and required
dependencies come from the MIT
registry at the existing pinned revision recorded in
`server/web/src/components/ui/UPSTREAM.md`. No new dependency was necessary.
Nutrition refreshes automatically while visible and when returning to the app;
failures retain a visible Retry action. There is no nutrition Refresh action; menus are used for integration management.


## Dashboard navigation and page state

- Desktop navigation uses a 224px sidebar from 1280px and a 64px icon rail at
  768–1279px. Wider screens can collapse it using the browser-local preference.
  React Router links preserve routes and active state. Tooltips label rail icons.
- Mobile keeps Today, Sleep, Workouts, Nutrition and More. More opens a Drawer
  with Trends and Settings. Sticky headers and bottom navigation retain safe areas.
- Nutrition keeps macro cards and logging status above Overview, Food log and
  Protocol tabs. `tab=overview|food-log|protocol` defaults to Overview for absent
  or invalid values; tab/date/range updates preserve other query parameters and
  participate in browser history.
- Settings keeps its existing tab identifiers and replace-style URL updates.
  It presents one section at a time: vertical tabs above 960px of content width,
  a labelled Select below. All nine sections remain reachable.
- Visited panels stay mounted, hidden and inert. Settings and protocol drafts
  survive section switches and responsive changes in memory only. Editing a
  nutrition protocol snapshots both its record and expected version; background
  refreshes cannot rebase the draft. Source ordering protects unsaved reordering.
- Today searches only loaded visible metrics and links to customization. Workout
  filtering uses a searchable counted selector and its existing page-reset rules;
  the detail breadcrumb returns to the filtered list. Successful empty detail
  responses get an explicit empty state.
- Sleep gives its overnight chart the main column, with recovery and composition
  alongside when content width permits. Trends uses adaptive cards and compact
  mobile rows, with classification guidance in a labelled explanation Popover.
- Integration Sync actions stay visible; credential editing and confirmed
  disconnect live in Manage menus. Redirect URI Copy has a manual fallback.
  Import Browse and Remove are separate native buttons.
- uPlot keeps its instance during container-only resizes, preserving interaction
  state. Leaflet observes its container and invalidates its size without panning.
  Zero-width hidden charts initialize or re-measure when visible again.

## Feature acceptance mapping

| Area | Retained contract | Acceptance coverage |
| --- | --- | --- |
| Shell and all pages | Routes, back/forward, active navigation, sticky secondary bar, responsive boundaries, themes, reduced motion | `parity.spec.ts`, `sleep.spec.ts`, `controls.spec.ts`, `accessibility.spec.ts`, `cards.spec.ts`, `dashboard.spec.ts` |
| Today | Hero order, values, categories, sources, dates, deltas, sparklines, links | `dashboard.spec.ts`, `parity.spec.ts`, `states.spec.ts`, existing metric-display unit tests |
| Nutrition | Day/7d/30d, four macros, compact secondary rows, unknown/zero/partial values, contributors and education | `nutrition.spec.ts`, `layout.spec.ts`, unchanged numerical suite |
| Nutrition meters | Actual value/target accessible text, visually clamped fill, no absent/invalid target meter, completion stays separate | `layout.spec.ts` |
| Protocol editor | Persistent section, focus entry/return, cancel, drafts after errors/conflicts, profile and every target kind, exact versioned writes, history | `layout.spec.ts`, `nutrition.spec.ts` |
| Dates | Calendar, direct entry, invalid days, limits, next/previous, Today/Latest, keyboard/focus, positive/negative time zones | `layout.spec.ts`, `nutrition.spec.ts`, `sleep.spec.ts`, controls unit tests |
| Sleep | Recovery calculation, excluded baseline nights, HR queries/gaps/lowest point, stages/history and empty nights | `sleep.spec.ts`, `parity.spec.ts`, unchanged recovery suite |
| Workouts/detail | Filters, counts, pagination reset, navigation, exercises, synthetic strength, units, zones, route/HR sizing and absent data | `data.spec.ts`, `states.spec.ts` |
| Metrics/Correlations | Grouped/searchable selection, URL values, lag, stats, chart resizing and exact CSV | `data.spec.ts`, existing stats unit tests |
| Trends | Classification, direction, fitted charts and links | `parity.spec.ts`, existing trend unit tests |
| Nine settings sections | URL tabs/compact picker, credentials/OAuth, priorities, imports, alerts, identity, saves/resets, exact requests and retries | `settings.spec.ts`, `dashboard.spec.ts` |
| Feedback and actions | Automatic nutrition refresh, visible errors/retries, loading/empty/stale states | `states.spec.ts` |
| Details | Independent disclosure drafts, grouped/searchable choices, nested closure/focus, scroll/backdrop/Escape, four macro sheets on both viewports | `controls.unit.test.tsx`, `controls.spec.ts`, `nutrition.spec.ts`, `layout.spec.ts`, `cards.spec.ts` |

Existing behavioral assertions remain; only locators tied to replaced markup
were updated. Browser tests cover 320, 390, 767, 768, 1024, 1279, 1280 and 1440px with intercepted,
invented API fixtures in Chromium and WebKit. No real API captures, screenshots,
logs, browser artifacts or credentials belong in this public repository.

The new overlay axe checks exclude only `[data-base-ui-focus-guard]`: Base UI
1.8 intentionally gives its invisible WebKit VoiceOver cursor sentinels an
unnamed button role. All application controls are still checked. Focus trapping,
keyboard dismissal and restoration are tested separately. The library guards
are unchanged; this exception does not establish a physical VoiceOver audit.

## Release verification

Run type checking/production build, Vitest and existing numerical suites,
Chromium/WebKit acceptance tests, Go build/vet/tests, golangci-lint and the
repository document check. Review synthetic snapshots in both themes. Push the
focused commits to the existing GitHub fork and confirm Web parity CI before
one app-only Docker deployment. Preserve the previously deployed image for
rollback and leave data volumes untouched. Live smoke checks are read-only.

The image preceding this dashboard release is preserved as
`freereps-local-app:pre-dashboard-20260923`; recreating only the app from this image
(without a build) provides rollback without changing data volumes.

Removed per-page section/stat helpers, summary/option child parsing, native
nutrition progress bars, delegated `data-sheet-close`, redundant dividers and
obsolete nutrition grid/progress styling. Specialized chart geometry and domain
presentation remain intentionally. There is no migration flag or dual layout.

The dashboard acceptance additions cover sidebar preference/history, More,
metric search, nutrition tab URLs, snapshot conflicts, retained drafts, nested
sheet navigation, integration menus and pending requests, Copy fallback,
import button semantics and all settings layouts in both palettes.
`chart-resize.unit.test.tsx` covers hidden/visible sizing and instance retention;
`data.spec.ts` checks canvas identity and Leaflet resizing after sidebar changes.
The previous numerical and exact-payload assertions are retained.

Final local verification: 204 browser cases passed with 6 intentional viewport
skips, 11 Vitest cases and all existing nutrition/recovery numerical checks
passed. Type checking, production build, Go build/vet/tests, golangci-lint
(zero issues), document contracts and whitespace checks passed. Synthetic
review images remain in ignored Playwright output only.

## Physical device checks — pending operator verification

WebKit emulation is separate from these checks, which require an actual iPhone:

- Scroll a long nutrient drawer, then open/close a nested nutrient.
- Swipe down to dismiss and verify scrolling does not dismiss accidentally.
- Pick and type a date, dismiss the keyboard, and navigate to Today/Latest.
- Open the home-screen app and check the notch, bottom navigation and safe areas.
- Scroll past the key-metric cards and check the sticky page bar stays usable.

Do not mark these complete based on emulated screenshots or desktop keyboard tests.
