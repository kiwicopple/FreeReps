# Roadmap

**This file contains open work only.** Every row carries the status token
`[open]`. Closed work is not struck through here — it is removed and lives in
[`DECISIONS.md`](DECISIONS.md) (decisions, with their reasoning) or
[`INCIDENTS.md`](INCIDENTS.md) (postmortems).

Columns: **Status** is always `[open]`. **Where** names the artifact the work
touches. **Trigger** carries the condition for items that are deliberately
deferred, and is empty for items that are simply pending. **Notes** carries the
reasoning.

Before closing an item, check its entry for residual work, dates or triggers —
each becomes its own `[open]` row before the entry is moved out.

## Dashboard

| Status | Item | Where | Trigger | Notes |
|---|---|---|---|---|
| `[open]` | The front page's last ~0.65s sits in the latest-value lookup | `server/internal/storage/health_metrics.go`, or the chunk layout | It becomes a complaint again | From ~5s to ~0.65s across `a3c634c`, `5a75915`, `8c1ed3d`, four cores and the homelab memory fix. **`pg_stat_statements` is enabled — use it before forming a theory.** It attributes 531ms of 652ms to one statement: the per-metric `LATERAL … LIMIT 1` in `GetLatestMetricsFor`, against 76ms for the daily series and under 1ms for everything else. **Two dead ends, both measured:** widening or staging the time window does nothing — cost scales with the number of per-metric lookups, not the window (`bc4196a`, reverted in `03cbb3b`, made it a third slower). A continuous aggregate would not have helped either; it addresses the 76ms half. What is left is a different shape: merge the 514 7-day chunks into fewer, or derive the latest value from the daily-series query that already runs, which needs `max(time)` and the winning source added to it. |
| `[open]` | Persist the selected time range per screen | `server/web/src/`, `server/internal/storage/preferences.go` | | Metric selection and the four hero numbers persist in `user_preferences`; the range does not, and resets to each screen's default on a fresh session. The table and the `GetPreference`/`SetPreference` pair are already in place — this is one more key. |
| `[open]` | Manual entry for muscle mass | `server/web/src/`, `server/internal/server/`, `server/internal/storage/health_metrics.go` | | Measured once a year at the doctor, and that measurement is considerably more precise than the scale's impedance estimate. The metric `muscle_mass` already exists in the allowlist (migration `000026`), so this is an entry form plus a write path, not a schema change. **It needs a source name of its own** — writing it under `Withings` would put the annual measurement and the scale reading in the same priority bucket, where the winner per five-minute bucket is undefined; a distinct name ranked above `Withings` in `source_priority` resolves it. The conflict is dormant today because the scale's body composition series ends 2026-04-11, and it returns the moment the impedance scale is used again. |
| `[open]` | Lag correlation over the full series, server-side | `server/internal/storage/health_metrics.go`, `server/web/src/pages/CorrelationPage.tsx` | Windows beyond one year | The Correlations screen fetches both metrics as daily series and pairs them in the browser to compute r at four lags from one payload. At a 1y window that is two arrays of 365; beyond that the pairing belongs in SQL. |

## Training data

| Status | Item | Where | Trigger | Notes |
|---|---|---|---|---|
| `[open]` | Tonnage ignores body weight | `server/internal/storage/training_metrics.go`, `training_summary.go`, `training_volume.go` | | `SUM(weight_kg * reps)` counts external load only. 827 working sets are body-weight-plus, where Alpha recorded just the added weight: at 81.2 kg and 8285 reps that is 672,742 kg uncounted, about 31 % of total tonnage. A further 292 sets carry no weight at all — hanging leg raises, chin-ups — and contribute zero. Tonnage is therefore a relative measure at a stable exercise mix, not an absolute workload. A fix needs a decision on which body weight to use: the measurement nearest the session, or a rolling average. |
| `[open]` | Planning project | outside this repo | | Separate Claude Code project with both MCP servers, permissions denying the Hevy analysis tools. See [`DECISIONS.md`](DECISIONS.md), 2026-08-04. |
| `[open]` | Backfill the Alpha history into Hevy | outside this repo | | Roughly the last 8 to 12 weeks via `POST /v1/workouts`, so the app shows previous-session values from day one. Set `is_private` on the created workouts. The ingest cutoff in `hevy_credentials.sync_from` keeps them from flowing back. |
| `[open]` | Source deduplication in the training aggregates | `server/internal/storage/training_summary.go`, `training_intensity.go` | Two sources cover one period | Both queries sum across `workout_sets` without filtering on `source`. The cutoff currently keeps the periods disjoint; if they ever overlap, tonnage and set counts double. Same failure shape as [`INCIDENTS.md`](INCIDENTS.md), 2026-03-26. |
| `[open]` | `Bench Press` names two different exercises | `server/internal/storage/training_metrics.go`, `exercise_name_map` | | Barbell through 2026-06-23, dumbbells from 2026-07-03 at 30 kg per hand. The estimated-1RM series for that exercise mixes both, so the drop at the changeover reads as lost strength rather than a different lift. Alpha writes the equipment into its own column, which is what separates the two; the exercise name alone does not. Found 2026-08-10 alongside [`INCIDENTS.md`](INCIDENTS.md), 2026-08-10, and deliberately left out of that change. |
| `[open]` | 2026-05-02 holds nine sets, all flagged as warm-ups | `server/internal/storage/training_summary.go`, `training_volume.go`, or the data | | Four exercises, each ramping in weight, with no working set after them — either an abandoned session or a logging gap. Every aggregate filters on `NOT is_warmup`, so the day contributes nothing and appears as a rest day; the session is not visible as an anomaly anywhere. Decide whether it is data to correct or a case the aggregates should surface, and do not fix it by relaxing the warm-up filter, which would inflate every other period. Found 2026-08-10. |
| `[open]` | Detail view for sessions without a workout row | `server/web/src/pages/WorkoutDetailPage.tsx` | | Alpha and Hevy sessions render from route state because `GET /api/v1/workouts/{id}` cannot resolve a synthetic id. Reloading such a page loses the data. Hevy now supplies a stable `external_id` to resolve against. |

## Operations

| Status | Item | Where | Trigger | Notes |
|---|---|---|---|---|
| `[open]` | Tear down the App Store review test server | `https://freereps-test.meltforce.net/` | App Store approval received | Public-facing instance without Tailscale, deployed for review only. It carries demo data, not real health data, but it is the one FreeReps endpoint reachable outside the tailnet. |
