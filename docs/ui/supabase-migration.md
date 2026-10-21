# Supabase dashboard migration

Protocol adopts the pinned Supabase Design System while keeping its routes,
preferences, APIs, data calculations and chart engines. Source provenance and
local adaptations are recorded in `server/web/src/components/ui/UPSTREAM.md`.

## Implementation mapping

| Area                        | Shared presentation                                                                                                   | Behavioral verification                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Shell and navigation        | Supabase Studio buttons, tooltips, separators, scroll area and semantic theme; existing sidebar and mobile navigation | dashboard, accessibility, parity, states                                       |
| Page sections and summaries | Supabase cards, compact headings, Inter, semantic surfaces                                                            | cards, layout, nutrition-rows, synthetic visual review                         |
| Chat                        | Supabase fields, buttons, alerts and surfaces; existing visual-viewport layout                                        | chat photo-only, retries, local dates, keyboard and composer tests             |
| Today and metric details    | Summary cards, table, search input group, responsive sheets                                                           | metric-details, dashboard, data                                                |
| Nutrition                   | Tabs, cards, nutrient sheets, field labels, native nullable numeric inputs, measurement meters                        | nutrition, nutrition-rows, layout, dashboard; unchanged numerical tests        |
| Sleep                       | Shared date/calendar controls, radio choices, cards and disclosures                                                   | sleep, sleep-vitals, travel; unchanged recovery and bucket tests               |
| Workouts                    | Searchable selector, tables, breadcrumb, pagination and cards                                                         | data, states, parity, chart-resize                                             |
| Metrics and Correlations    | Searchable Command/Popover choices, Select, cards and table                                                           | data, layout, parity; CSV and query assertions retained                        |
| Trends                      | Shared cards and explanation popovers                                                                                 | parity, accessibility, states                                                  |
| Settings                    | Tabs/compact selector, field compositions, connection menus, alert dialogs                                            | settings, dashboard; exact payload, independent saves and draft tests retained |

## Preserved interfaces

- Date-only values stay local calendar strings. The existing travel handling is unchanged.
- Numeric emptiness is `null`; zero is an entered value. Native numeric validation remains active.
- Selected metric names, query strings, version fields and mutation payloads are unchanged.
- Searchable selectors use a button opening a searchable Supabase Command popover.
- Inactive visited panels retain their drafts in memory and are hidden/inert.
- Desktop sheets and mobile drawers retain independent scrolling, nested navigation,
  explicit close controls and focus restoration.
- uPlot, SVG and Leaflet retain their rendering and data transformations. Only their
  typography and surrounding UI change.
- Existing theme and sidebar preference keys remain unchanged.

## Removed dependencies and custom presentation

Base UI, the former day-picker package and Archivo are removed. The handwritten
black palette, coss components, coss media-query helper and old number-field and
combobox implementations are replaced. Small application wrappers retain domain
semantics; they do not introduce another component system.

Supabase's own compatibility token aliases are retained because this pinned
upstream version still uses them. These differ from Protocol's removed palette.

## Release verification

Run `bash tools/verify-local.sh` with Node 24 and Docker. It checks privacy,
documentation, the production build, unit/calculation tests, Chromium/WebKit,
Go build/vet/tests and lint. Browser fixtures fail on unhandled API calls.

Synthetic screenshots can be generated with `PW_SCREENSHOTS=1` for the
`supabase-review.spec.ts` suite; generated browser artifacts are ignored by Git.
No personal screenshots, API responses or database records are test fixtures.

Physical iPhone gestures, keyboard behavior and installed home-screen safe areas
must be recorded separately from WebKit emulation; emulator results are not a
claim of physical-device verification.

Deploy only after the final local gate passes. Preserve the current Docker image,
create a local ignored database backup, and replace only the app container without
changing database volumes. Finish with read-only live endpoint checks.

### Verified release — 2026-10-20

The full local gate passed: privacy and documentation checks, frontend type check
and production build, unit/calculation tests, 304 Chromium/WebKit browser tests
(with six intentional skips), Go build/vet/tests and lint. Synthetic light/dark
and mobile/desktop screenshots were reviewed. The dependency audit reported zero
known vulnerabilities. Physical iPhone checks have not been performed for this
release and remain separate from the passing WebKit emulation.

### Follow-up style consolidation

Nutrition logging status and Other nutrients, personal metric comparisons, and
integration connection panels use the shared Card/CardContent instead of custom
rounded boxes. Connection indicators use Badge. The import drop zone uses standard
spacing, text and radius utilities. Mobile navigation inherits the Studio button
radius. Removed the separate nutrition panel CSS and redundant summary border
color override. Shared cards retain the pinned Supabase source's 8px rounding.

Responsive layout, safe-area handling, chat keyboard geometry, measurement colors
and accessible focus behavior remain application responsibilities.

### Mobile typography and navigation consistency

Page text and secondary labels use the standard text-sm/text-xs scale instead of
fractional pixel fonts. Action buttons inherit Studio sizes without page-specific
font overrides. Nutrition detail spacing follows the shared spacing scale.
Sidebar links use the pinned Supabase sidebar menu variants (32px rows, 20px icons),
with centered icons in the collapsed rail. Mobile navigation keeps its touch
targets, six destinations and safe-area geometry; editable mobile inputs retain
the Safari focus-zoom safeguards.
