# Protocol coss/ui migration

Preserve features and payloads, adopt coss controls with black/green Protocol
styling. Metrics and Correlations remain desktop-only. Chart engines and health
calculations are not replaced. No personal data may enter fixtures or artifacts.

## Verification ledger

| Area | Acceptance coverage | Status |
| --- | --- | --- |
| All nine routes, desktop/mobile | browser/parity.spec.ts | Baseline passing |
| Sleep date navigation and provisional recovery | browser/parity.spec.ts; recovery.test.ts | Baseline passing |
| Nutrition explanations and food contributions | browser/parity.spec.ts | Baseline passing |
| Nutrition calculation/date semantics | nutrition.test.ts | Baseline passing |
| Metric naming | labels.unit.test.ts | Baseline passing |
| Shared controls, dialogs and dates | controls.unit.test.ts | Pending |
| Theme, drawers, nested details, focus | browser/controls.spec.ts | Pending |
| Settings saves and integrations | browser/settings.spec.ts | Pending |
| Nutrition editor and completion writes | browser/nutrition.spec.ts | Pending |
| CSV, workouts/filtering and correlations | browser/data.spec.ts | Pending |
| Responsive layouts and accessibility | browser/accessibility.spec.ts | Pending |
| Real iPhone gestures and home-screen mode | Operator check; no health screenshots committed | Pending |

## Stages

1. Synthetic baseline and GitHub CI.
2. Coss source, tokens and shared controls.
3. Nutrition drawers, forms and dates.
4. Sleep, Today and Trends presentation.
5. Workouts, Metrics and Correlations controls.
6. All nine Settings sections and redundant-code cleanup.

Run `npm test`, `npm run build` and `npm run test:e2e` from server/web.
Browser tests intercept all API traffic; unhandled API calls fail the suite.
External requests are blocked. Browser artifacts remain ignored.
The test runner uses a separate Vite port and must never write to the real API.
Baseline: 22 browser scenarios pass across Chromium desktop and WebKit mobile.
