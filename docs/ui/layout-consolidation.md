# Protocol layout consolidation

This release keeps the black/green Protocol theme, Archivo, routes, navigation,
768px interaction boundary and all existing domain behavior. Metrics and
Correlations remain desktop-only. There are no backend, schema, data volume,
API payload or preference changes.

## Shared compositions

- `PageHeader` shows only the page title and essential range/actions in one
  consistent row. Sleep and Nutrition place their date navigation directly
  beneath it. Subtitle lines, sync metadata and the nutrition timezone line
  are omitted; workout timestamps remain in the detail content.
- `PageSection` supplies a semantic heading, description, actions, padded or
  flush content and optional footer using coss CardFrame/Card. Table rows and
  secondary nutrient values remain rows, rather than individual cards.
- `SummaryGrid` and `SummaryValue` own spacing and typography. Callers retain
  calculations and formatting, including missing versus zero values.
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
- Editable settings use coss Field/FieldLabel/FieldDescription/FieldError;
  read-only rows and separate save operations remain distinct.
  Identity fields wait for their initial preferences before allowing edits,
  so a delayed response cannot overwrite a new draft. A delayed-response
  acceptance test covers this race in both browsers.

Content is centered at a maximum width of 1440px, with 20px mobile and 32px
desktop padding, 24px section gaps and 16px/24px panel padding. The desktop
analysis panels switch from stacked to adjacent at 1280px. General typography
resets live in the CSS base layer so component utility styles take precedence.
Navigation safe areas and specialized chart/map implementations are retained.

Card, Group, Meter and Group's Separator dependency come from the MIT
registry at the existing pinned revision recorded in
`server/web/src/components/ui/UPSTREAM.md`. No new dependency was necessary.
Nutrition refreshes automatically while visible and when returning to the app;
failures retain a visible Retry action. The manual refresh menu and its unused
coss component have been removed.

## Feature acceptance mapping

| Area | Retained contract | Acceptance coverage |
| --- | --- | --- |
| Shell and all pages | Routes, back/forward, active navigation, responsive boundaries, themes, reduced motion | `parity.spec.ts`, `sleep.spec.ts`, `controls.spec.ts`, `accessibility.spec.ts` |
| Today | Hero order, values, categories, sources, dates, deltas, sparklines, links | `parity.spec.ts`, `states.spec.ts`, existing metric-display unit tests |
| Nutrition | Day/7d/30d, four macros, compact secondary rows, unknown/zero/partial values, contributors and education | `nutrition.spec.ts`, `layout.spec.ts`, unchanged numerical suite |
| Nutrition meters | Actual value/target accessible text, visually clamped fill, no absent/invalid target meter, completion stays separate | `layout.spec.ts` |
| Protocol editor | Persistent section, focus entry/return, cancel, drafts after errors/conflicts, profile and every target kind, exact versioned writes, history | `layout.spec.ts`, `nutrition.spec.ts` |
| Dates | Calendar, direct entry, invalid days, limits, next/previous, Today/Latest, keyboard/focus, positive/negative time zones | `layout.spec.ts`, `nutrition.spec.ts`, `sleep.spec.ts`, controls unit tests |
| Sleep | Recovery calculation, excluded baseline nights, HR queries/gaps/lowest point, stages/history and empty nights | `sleep.spec.ts`, `parity.spec.ts`, unchanged recovery suite |
| Workouts/detail | Filters, counts, pagination reset, navigation, exercises, synthetic strength, units, zones, route/HR sizing and absent data | `data.spec.ts`, `states.spec.ts` |
| Metrics/Correlations | Grouped/searchable selection, URL values, lag, stats, chart resizing and exact CSV | `data.spec.ts`, existing stats unit tests |
| Trends | Classification, direction, fitted charts and links | `parity.spec.ts`, existing trend unit tests |
| Nine settings sections | URL tabs/mobile sections, credentials/OAuth, priorities, imports, alerts, identity, saves/resets, exact requests and retries | `settings.spec.ts` |
| Feedback and actions | Automatic nutrition refresh, visible errors/retries, loading/empty/stale states | `states.spec.ts` |
| Details | Independent disclosure drafts, grouped/searchable choices, nested closure/focus, scroll/backdrop/Escape | `controls.unit.test.tsx`, `controls.spec.ts`, `nutrition.spec.ts`, `layout.spec.ts` |

Existing behavioral assertions remain; only locators tied to replaced markup
were updated. Browser tests cover 320, 390, 767, 768 and 1440px with intercepted,
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

The image preceding header simplification is preserved as
`freereps-local-app:pre-headers-20260923`; recreating only the app from this image
(without a build) provides rollback without changing data volumes.

Removed per-page section/stat helpers, summary/option child parsing, native
nutrition progress bars, delegated `data-sheet-close`, redundant dividers and
obsolete nutrition grid/progress styling. Specialized chart geometry and domain
presentation remain intentionally. There is no migration flag or dual layout.

Automated local results: 176 browser cases passed, with 6 intentional viewport
skips; 10 Vitest cases and the existing nutrition/recovery numerical suites passed.
Type checking, production build, Go build/vet/tests, golangci-lint (zero issues),
the document check and whitespace check passed.

## Physical device checks — pending operator verification

WebKit emulation is separate from these checks, which require an actual iPhone:

- Scroll a long nutrient drawer, then open/close a nested nutrient.
- Swipe down to dismiss and verify scrolling does not dismiss accidentally.
- Pick and type a date, dismiss the keyboard, and navigate to Today/Latest.
- Open the home-screen app and check the notch, bottom navigation and safe areas.

Do not mark these complete based on emulated screenshots or desktop keyboard tests.
