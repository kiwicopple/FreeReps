# Decisions

Decisions taken about FreeReps, with the reasoning that led to them. One section
per decision, newest first.

A decision belongs here once it has been made — including decisions to *not* do
something, which are the ones most likely to be re-derived from scratch
otherwise. Open work lives in [`ROADMAP.md`](ROADMAP.md); postmortems live in
[`INCIDENTS.md`](INCIDENTS.md).

Structure per entry: **decision**, **reasoning**, **trigger to re-open**, and a
**revisions** log when the decision has changed. A revised decision is edited in
place with the old form recorded under revisions — the entry is not duplicated.

The entries dated before 2026-08-04 were reconstructed on that date from
`CLAUDE.md`, from `app/readiness_assessment.md` (removed in the same change,
last content at commit `2918cef`) and from the commit history. Their reasoning
is as recorded there; where the record named no alternative, none is claimed.

---

## 2026-09-20 — Colour carries four roles, not one

**Decided:** 2026-09-20

**Decision.** `--color-accent` no longer means brand, selection, data and
judgement at once. Four roles, each with its own token:

- **brand** — nav marker, links, buttons, selected states
- **positive** (`--color-positive*`) — a metric moving the right way
- **negative** (`--color-negative*`) — a metric moving the wrong way
- **data** — sleep stages, heart rate zones; still on the brand token, see the
  open item in `ROADMAP.md`

`deltaColor()` in `server/web/src/utils/metricDirection.ts` gives regression
`--color-negative-700` instead of the neutral tone it shared with movement that
carries no judgement. Metrics whose `DIRECTION` is `"neutral"` — weight, BMI,
heart rate, respiratory rate — stay neutral whichever way they move.

Ground and ink move with it: paper is cool-tinted rather than near-white
(`#edf0f1`), ink is blue-grey rather than near-black (`#232c33`), and the
neutral ramp is pulled cool to match. Type, spacing, radii and layout are
untouched.

**Reasoning.** One colour cannot mean "this is us" and "this is good" at the
same time. With a single accent, every hovered table row read as signalled, and
a worsening metric had no colour of its own: `deltaColor()` returned the same
neutral tone for regression and for a number that had not really moved.

Blue against amber rather than green against red. Red-green deficiency affects
roughly 8% of men, while blue and orange stay distinguishable under all the
common deficiencies. Both tones sit at the same lightness and saturation and
differ only in hue, so neither reads as louder than the other.

`--color-positive` deliberately equals `--color-accent` on light ground. It is
a token of its own so brand and improvement can part later without touching a
call site.

**Trigger to re-open.** Data semantics still borrow the brand token
(`stageColors.ts`), which is the piece this change does not finish. Should
brand and positive need to differ, `--color-positive` is already the seam.

---

## 2026-09-20 — Source selection and sample reduction are separate steps

**Decided:** 2026-09-20

**Decision.** Reading a metric resolves the source first and aggregates second,
and the two no longer share one window function.

- The dedup CTE marks every row of the winning source with `rn = 1` through
  `FIRST_VALUE(source)`. Callers keep their `WHERE rn = 1`, which now removes
  competing sources and no longer removes samples of the source that won.
- A cumulative metric resolves its source **per day**, every other metric **per
  5-minute window**.
- A cumulative metric is aggregated as the sum over all rows of the winning
  source. Every other metric is averaged within each 5-minute window and then
  across those windows, with `MIN` and `MAX` taken over the rows.
- A query spanning several metrics resolves each metric with the priority of
  its own category, not with `_default`.

**Reasoning.** The interval a source states a quantity over differs per source:
Oura writes a day's steps as one row, Apple Health writes hourly blocks, and
Health Auto Export can be configured to write per-second samples. Any rule
fixed to one window is therefore wrong for some pairing, which produced 32,361
steps for a day of 16,652 (`INCIDENTS.md`, 2026-09-20).

Resolving per day is right for a counter because the two candidate figures cover
the same day and adding them doubles it. Resolving per day is wrong for a
sampled value because the leading source is not obliged to cover the whole day:
on 2026-09-18 Apple Health held 54 heart rate windows in which Oura had no row,
and a daily choice would have deleted the morning training session from the
day's figure.

Averaging the rows of a sampled metric directly was rejected for the same reason
it looks correct. On 2026-09-18 six workouts covered 16% of the day and held 77%
of the heart rate rows, because a workout samples per second and a quiet hour
does not. An average over rows is an average of the sampling rate as much as of
the heart rate, so the windows are averaged first and weigh alike.

The alternatives considered and rejected:

- **Keep one row per window** (the previous behaviour). Correct for neither
  class: a counter loses every sample but one, and a sampled value is
  represented by whichever row sorted first.
- **Skip the dedup entirely for cumulative metrics**, as proposed in
  `meltforce/FreeReps#1`. It repairs the sample loss and reintroduces the
  double count, because two sources reporting the same day then both contribute.

**Trigger to re-open.** A source that reports a cumulative metric more than once
per day with overlapping coverage, which the daily choice cannot resolve. Also:
Apple Health devices are stored under one empty source name because the HAE
ingest discards the device name from `sources[]`, so iPhone and Watch cannot be
told apart by priority. A user whose export carries both devices separately
would have their steps counted twice; storing the device name is the fix and is
tracked in `ROADMAP.md`.

---

## 2026-09-20 — The OAuth redirect URIs are derived from the request, not configured

**Decided:** 2026-09-20

**Decision.** `/oura/callback` and `/withings/callback` are built per request from
the origin the request arrived on (`internal/server.callbackURL`), honouring
`X-Forwarded-Proto` and `X-Forwarded-Host`. `server.base_url` overrides the origin
and is empty by default. Both integrations report the resulting value in their
status endpoint, and each Settings tab shows it as the string to paste into the
provider's form.

**Reasoning.** The two URIs were compile-time constants naming one deployment's
MagicDNS name, which made the OAuth flow unusable for any other installation and
silently wrong in local development. Three properties decided the shape:

- **The request already carries the right answer.** The user reached the UI on the
  host the provider will redirect back to, so that host is the one to register.
  Deriving it means a fresh installation configures nothing, and renaming a host
  changes the URI without an edit.
- **Start and exchange have to agree.** The provider compares the redirect URI
  sent when the flow opens with the one sent when the code is exchanged. Both
  calls build it the same way, and the callback arrives on the same origin as the
  request that opened the flow.
- **A displayed value beats a documented one.** The URI is the one setup value an
  operator cannot look up, and a guess that differs in scheme, port or hostname
  fails at the last step of the flow rather than when it is entered.

**Why an override exists anyway.** A reverse proxy under a name the forwarding
headers do not carry, and a UI reachable under several names while the provider
accepts one registered URI. A `base_url` carrying a path is refused at startup,
because it would produce `…/app/oura/callback` while the router serves
`/oura/callback` — a mismatch the provider reports at the end of a flow.

**Trigger to re-open.** A provider that requires a URI registered per user rather
than per application, or a deployment that terminates TLS without setting either
forwarding header.

---

## 2026-09-20 — A failing data source reports itself to an ntfy topic

**Decided:** 2026-09-20

**Decision.** FreeReps posts its own alerts as a JSON object to a configured ntfy
topic, in the shape Uptime Kuma's webhook notification produces: `schema` (the
number 1), `monitor_id`, `service` and `status` (0 = problem, 1 = resolved), plus
`hostname`, `monitor_type`, `since` and `msg`. Following Kuma's field names rather
than inventing better ones means a consumer that already parses Kuma's webhooks
needs no second parser.

The ids sit in the block 9200–9299, clear of the monitor ids a Kuma instance on
the same topic hands out from 1 upwards
(`server/internal/alerts/watcher.go`):

| id | Condition |
|---|---|
| 9200 | the manual channel test from Settings → Alerts |
| 9201 / 9202 / 9203 | the Withings, Oura and Hevy sync failing repeatedly |
| 9204 | no Health Auto Export delivery for longer than the silence threshold |

Four sub-decisions that are not obvious from the code:

- **The rules read `import_logs`, they do not hook into the sync loops.** A
  syncer that stopped running writes no row at all, and a rule that fires on a
  failed run would stay silent for exactly that case. The same query then also
  covers the Apple Health path, which this server does not poll — there the
  condition is silence.
- **The configuration is a database row, edited in the Settings UI**
  (`alert_settings`, one row, seeded once from `config.yaml`). Every other
  integration in this project is configured in that screen, and a value that
  lives only in the deployed config file needs an Ansible run to change. The seed
  is one-directional so a redeploy cannot overwrite what was entered.
- **Three consecutive failed runs for one user, not one.** The Withings sync
  produced isolated DNS failures (`server misbehaving`) among the 2,197 real
  ones; at a 30-minute interval the threshold reports a defect within two hours
  while a single timeout stays out of the session.
- **The state is stored and the message sent on the transition only.** A consumer
  groups messages by `monitor_id`, so repeating `status: 0` every cycle adds
  nothing to what it already shows. The state is written after the send
  succeeded, so an unreachable topic delays an alert instead of swallowing it.
  For the same reason an id stands for one condition permanently: two conditions
  sharing one id become indistinguishable on the receiving side.

**Reasoning.** The Withings integration failed every 30 minutes for 46 days and
nothing said so ([`INCIDENTS.md`](INCIDENTS.md), 2026-09-20); the only signal was
a row in `import_logs` that nothing reads on a schedule. Uptime Kuma cannot close
that gap from outside: the container is healthy and the HTTP endpoint answers
while a source silently delivers nothing, which is what its monitors check.

**Trigger to re-open.** A second consumer of the channel that needs a different
payload shape; a condition whose firing rate makes the channel noisy enough to be
muted; or a move off ntfy, which would change the transport but not the
per-condition id.

**Where the receiving side is documented.** The deployment this was built for
runs the consumer in its own infrastructure repository, which registers the id
blocks of every sender writing to that topic — including this project's
9200–9299. That document is the place to look when an id has to be added; nothing
in FreeReps depends on it.

---

## 2026-08-10 — The Alpha session timezone is configuration, and the natural key stays at the instant

**Decided:** 2026-08-10

**Decision.** The zone the Alpha Progression export's session times are read in
comes from `ingest.session_timezone` (`server/internal/config/config.go`,
default `Europe/Berlin`), never from `time.Local`. Startup fails on an unknown
zone name, on the empty string and on `"Local"` — the two spellings
`time.LoadLocation` accepts as "whatever this host happens to be".

Two sub-decisions that would otherwise be re-derived:

- **The unique constraint keeps identifying a session by its instant.**
  `workout_sets_source_natural_key` stays
  `(user_id, source, session_date, exercise_number, set_number, is_warmup)`.
  Widening it to the calendar day would have caught the duplication, and is
  rejected: two genuine sessions on one day overlap in `exercise_number` and
  `set_number`, so a day-level key silently drops the second session's sets —
  the same class of loss as [`INCIDENTS.md`](INCIDENTS.md), 2026-04-08. The
  instant is the right key; it just has to be computed deterministically.
- **The zone database is compiled into the binary** via a blank
  `time/tzdata` import in `internal/config`. The runtime image installs
  `tzdata` today, so this changes nothing about the current deployment; it
  removes the case where a base-image change turns a valid zone name into a
  startup failure.

**Reasoning.** The export carries a bare wall clock and nothing that identifies
its zone, so some zone has to be supplied. Taking it from the process
environment makes the stored instant a property of the host that ran the
import: the same file produced 08:22Z on a machine in Europe/Berlin and 09:22Z
in the deployed container, which carries no `/etc/localtime` and therefore runs
in UTC. Because that instant is part of the row's natural key,
`ON CONFLICT DO NOTHING` saw two different sessions and stored the full history
twice.

`Europe/Berlin` is the default rather than UTC because it is the zone the stored
history was written in; a different default would move every future session
relative to the sessions already stored, which is the failure this setting
exists to prevent. An installation elsewhere sets the key.

**Trigger to re-open.** A second user in another zone, which turns a server-wide
setting into a per-user one; or Alpha Progression adding a zone or a UTC offset
to its export, which would make the setting unnecessary for new files while the
stored history still depends on it.

---

## 2026-08-05 — Withings is read directly, and the Apple Health path stays

**Decided:** 2026-08-05

**Decision.** FreeReps reads weight, body composition and blood pressure from the
Withings Public API (`internal/withings/`, wire format in
[`server/specs/withings-api.md`](server/specs/withings-api.md)), on the same
shape as the Oura integration: per-user app credentials in the database, OAuth2
consent through the settings tab, a 30-minute poll with a 90-day backfill.

Three sub-decisions that are not obvious from the code:

- **The Health Auto Export path is not disabled.** It stays the only route for an
  installation without a Withings account. Overlap is resolved by source
  priority, whose default becomes `["Withings", "Oura", ""]`
  (`internal/config/config.go`).
- **Blood pressure is written as two qty metrics**, `blood_pressure_systolic`
  and `blood_pressure_diastolic`, not through the `Systolic`/`Diastolic` columns
  of `HealthMetricRow`. Those columns exist for the HAE shape, but
  `blood_pressure` has no `metric_allowlist` entry, so rows written that way are
  rejected at ingest. The dashboard, the correlation picker and the iOS app all
  work with the split names.
- **The pulse the blood pressure cuff records gets its own metric**,
  `blood_pressure_heart_rate`, rather than joining `heart_rate`. A single seated
  measurement in the same series as the continuous heart rate from Oura and the
  Apple Watch shifts every daily average, and the two stop being comparable.

**Reasoning.** The measurements existed in FreeReps only via Health Mate → Apple
Health → Health Auto Export. That chain advances when the Health app on the
phone syncs, which is not on a schedule anyone controls. The Withings Public API
tier requires no contract and no approval, so the direct read costs one
registered application.

Two API properties drove the implementation and are the reason the code deviates
from the Oura equivalent in two places:

- **Errors arrive with HTTP 200** and a non-zero `status` in the body. Branching
  on the HTTP status alone turns every failure into a successful empty result.
- **The refresh token rotates** and the previous one stops working within hours.
  `UpsertWithingsToken` is therefore an upsert rather than the bare `UPDATE`
  used for Oura, where a row that does not exist makes the write a silent no-op.

**Trigger to re-open.** Withings moving the measure endpoints behind a paid plan;
a Withings webhook subscription replacing the poll; or the Health Auto Export
path being retired for other reasons, which would remove the need for a priority
rule at all.

---

## 2026-08-05 — The web UI runs on the Modernist design system, with one phone breakpoint

**Decided:** 2026-08-05

**Decision.** The web UI is rebuilt against an external design package
(`design_handoff_freereps_redesign`) rather than continuing the dark Tailwind
default. What that fixes in structure, beyond the visual system:

- **The front page is one request.** `GET /api/v1/metrics/latest` returns, per
  visible metric, the latest value, a 7-day delta, a percentile range and a
  daily series. `GET /api/v1/dashboard/init` is removed; the dashboard no longer
  calls `available-metrics` or `timeseries` at all.
- **Sparklines are inline SVG `<polyline>`**, so no chart library loads on the
  front page. uPlot remains only on the workout detail route.
- **One breakpoint at 768px**, not a second app. The same page component picks
  between a table body and a row body via `useMediaQuery`.
- **Metrics and Correlations are desktop-only.** Both need width the phone does
  not have — a 248px rail beside a 420px chart, and a 720×520 scatter beside a
  440px column. Below 768px they stay reachable by URL and render a notice.

**Reasoning.** The old dashboard rendered ten metric cards plus a full
time-series chart on load: three API calls and a chart library before the first
number appeared. Carrying ~30 floats per metric in the latest payload costs less
than a second round trip, and it lets the front page answer "how am I doing
today" without loading a plotting library at all. Routing every colour through
tokens is what makes the three-way theme switch a variable swap rather than a
second stylesheet.

**Deviations from the package, and why.** The design's Settings rail names five
tabs; the shipped rail has seven. Hevy and Import drive working integrations
that the package does not mention, and dropping them with the old layout would
have removed function, not styling. The Metrics chart is inline SVG rather than
the lazy-loaded uPlot the package suggests, because the design it specifies —
band, gridlines, baseline, two polylines — needs no plotting library.

**The stated range is p05–p95, not min–max.** One dropped sensor reading would
widen a min/max range enough to make the number meaningless.

**The home screen icon carries a light mark, against the package.** The package
draws ink `#201e1d` on the accent field. iOS 18 renders home screen icons in a
light, a dark and a tinted mode, and a web app cannot supply a separate dark
variant — iOS derives it from the one icon. With the mark darker than the field
(luminance 0.013 against 0.200) both collapse toward black in the dark mode and
the icon reads as an empty rounded square. The mark is now `#f3f2f2` at
luminance 0.890, so it stays the brighter element through the conversion. Form,
kerning and the rule are untouched; only the fill changed.

**Distance is normalised to kilometres in one place.** Apple Health reports
walking and cycling distance in metres, and the summary strip summed the raw
field under a fixed "km" label — 428 km rendered as 427 955. Every distance on
screen now passes through `distanceKm`, which converts by the row's own unit.
The same class of failure as the metric units in
[`INCIDENTS.md`](INCIDENTS.md), 2026-03-26: a unit that varies per row and a
label that does not.

**Zone bands derive from the 99.9th percentile heart rate, not the maximum.**
Verified against the deployed instance, `MAX()` returned 210 bpm from a single
strap dropout. At that peak the second zone starts at 126, which put whole
strength sessions in zone 1 and made the bars carry no information. A genuine
maximum effort contributes many samples near the top; one artefact contributes
one.

**An empty `source` reads as "Apple Health", not "—".** HealthKit writes through
Health Auto Export without setting the field, and the priority rules already
match it as the empty string. Six of seventeen visible metrics were showing an
em dash for an origin that is in fact known.

**`GetLatestMetrics` now resolves source priority.** It previously picked by
timestamp alone, so a lower-priority device writing a minute later decided both
the shown value and the source name — beside a sparkline computed from the
higher-priority device, which does dedupe. Priority now decides within a
5-minute bucket and recency between buckets, matching every other query. Same
failure shape as [`INCIDENTS.md`](INCIDENTS.md), 2026-03-25.

**Trigger to re-open.** A screen whose data cannot be served from one request
without a second round trip, or a phone layout that needs different information
rather than a different arrangement of the same information.

---

## 2026-08-05 — How training volume and estimated strength are computed

**Decided:** 2026-08-05

**Decision.** Three conventions underlie every strength aggregate:

- **Volume per muscle group is reported twice** — as sets whose exercise targets
  the muscle directly, and as a weighted count that adds assisting muscles at
  0.5. Neither figure is presented as *the* volume.
- **Estimated one-rep max uses Epley over repetitions plus reps in reserve**:
  `kg × (1 + (reps + rir)/30)`. Sets without an effort rating are excluded.
- **Effort is read from `effort_rir`**, the generated column that resolves RIR
  and RPE, so both logging scales feed the same bands.

**Reasoning.** Each of these is a convention, not a measurement. No data in this
system says how much of a bench press the triceps carry, and Epley is a linear
approximation that drifts above roughly ten effective repetitions. Reporting two
volume figures keeps the 0.5 weighting from disappearing into a single number,
which is what the 2026-02-19 decision against opaque scores asks for. The reps in
reserve enter the strength estimate because a set stopped two short of failure
demonstrates the strength of a longer set — leaving them out understates about
half the sets in this history.

**Also decided.** Every volume figure carries `approximate_pct` per muscle group
and `unmapped_sets` per period. The first says how much of it rests on exercise
names mapped onto a near equivalent, the second how many sets reach no catalog
entry at all. A volume number without them would be a statement about an unknown
fraction of the training.

**Trigger to re-open.** A source that reports muscle involvement per set rather
than per exercise, or an effort scale that does not map onto reps in reserve.

---

## 2026-08-04 — Hevy replaces Alpha Progression, ingested by polling the event feed

**Decided:** 2026-08-04

**Decision.** Hevy Pro replaces Alpha Progression as the training logger. The
server ingests it by polling `GET /v1/workouts/events?since=` on a ticker, in the
same shape as the Oura sync. Hevy's webhook is not used.

**Reasoning.** The Alpha path was a manual CSV upload and it did not hold: on the
day of this decision the newest row in `workout_sets` dated 2026-05-16 while
`workouts` carried strength sessions from Apple Health up to 2026-06-05. Hevy's
event feed delivers updates *and* deletions since a timestamp, which makes an
outbound poll idempotent and lets a correction made in the app reach the server.

**Alternative considered.** Liftosaur, whose Liftoscript programs carry the
progression rule inside the plan, and whose API can validate a generated program
before it goes live. Rejected because its history format needs a parser where
Hevy returns JSON, because it has no delta endpoint, and because RPE per set —
which the existing intensity analysis depends on — is documented for Hevy and was
not confirmed for Liftosaur.

**Alternative considered.** Hevy's webhook, which POSTs to a registered URL when
a workout is saved. Rejected because it requires a publicly reachable endpoint
with its own authentication, which would reopen the 2026-03-15 decision below,
and because its payload carries only a workout id — the data still has to be
fetched outbound. Its only gain is latency.

**Cost accepted.** Hevy routines carry no progression logic, so load progression
between two planning passes is carried by rep ranges and the previous-session
values the app displays, not by the plan itself.

**Trigger to re-open.** Hevy drops the event feed, RPE stops arriving per set, or
the progression gap turns out to need automation after all.

---

## 2026-08-04 — FreeReps stays the system of record; planning lives outside it

**Decided:** 2026-08-04

**Decision.** Training planning and analysis run in a separate Claude Code
project that talks to the FreeReps MCP server and to a Hevy MCP server. FreeReps
gains no planning logic, no prescription engine and no writes back into the
training app.

**Reasoning.** This keeps the 2026-02-19 decision intact — data and
visualization, no computed scores, no coaching. It also puts the split where the
data is: analysis belongs on FreeReps, which is the only place that sees training
alongside sleep, HRV and readiness. The current plan exists only in Hevy, so
reading and writing it belongs there.

**Consequence for the MCP setup.** Both servers offer overlapping read tools —
`hevy-mcp` ships `get-training-summary` next to the FreeReps `get_training_summary`.
The planning project denies the Hevy analysis tools so evaluation cannot
accidentally run on training data alone, without the recovery context.

**Trigger to re-open.** A prescription that needs recovery data as an input — a
deload triggered by a measured HRV decline rather than by a calendar week — since
no external service can compute that.

---

## 2026-08-04 — Forgejo is the source of truth, GitHub is a mirror

**Decided:** 2026-08-04 (commit `3ba3b75`)

**Decision.** `git.coydog-fence.ts.net/meltforce.net/freereps` is `origin` and
the only push target. `github.com/meltforce/FreeReps` receives a
`git push --mirror`. Two workflows stay on GitHub — `ios.yml` and `release.yml`
— because they need a macOS runner and Docker Hub respectively.

**Reasoning.** CI, registry and deploy target are all inside the tailnet; a run
that starts on GitHub has to reach in from outside. The exception is the Xcode
build, for which no macOS runner exists on the Forgejo side.

**Consequence that bites.** `--mirror` force-pushes *and* prunes refs absent on
Forgejo. Anything that must survive on GitHub has to exist on Forgejo first — a
branch created only on GitHub is deleted at the next sync.

**Trigger to re-open.** A macOS runner becomes available inside the tailnet, or
the mirror's pruning costs something that outweighs having one source of truth.

---

## 2026-03-25 — Oura and Apple Health are merged at query time, not at ingest

**Decided:** 2026-03-25 (commit `a12046a`, extended by `71785c0`)

**Decision.** Both sources write their own rows. Deduplication happens in the
query path through a per-user, per-category source priority, configurable in
Settings. No source is normalized away on ingest.

**Reasoning.** The two sources disagree about the same night in ways that are not
resolvable at write time: Oura reports one long sleep session, Apple Health
reports several fragments, and which one is right depends on the metric. Keeping
both rows preserves the raw data the project is built around, and priority is
then a display decision that can be changed without re-importing.

**Alternative considered.** Merging on ingest into one canonical row. Rejected
because it destroys data at the point of no return, and because the correct
priority differs per metric category.

**Cost accepted.** Every query that reads a metric carries the dedup CTE.
`67e35d5` added a covering index for it after the dashboard first load became
measurably slow.

**Trigger to re-open.** A third source arrives whose overlap cannot be expressed
as a priority order.

---

## 2026-03-15 — Tailscale is the authentication layer; the app adds none

**Decided:** 2026-03-15 (recorded in `app/readiness_assessment.md` § 2, commit `2918cef`)

**Decision.** No application-level authentication — no API keys, no bearer
tokens. The server runs `tsnet`; iPhone and server must be on the same tailnet,
which supplies TLS and identity.

**Reasoning.** Adding an application auth layer would duplicate what Tailscale
already provides and introduce credential management for no gain in the
deployment model this project targets.

**Alternative considered.** API keys per device. Rejected on the above; it also
moves a secret onto the phone, which the current design avoids entirely.

**Where it does not hold.** The app accepts an arbitrary host/port/HTTPS
configuration for local development and App Store review. There, securing the
endpoint is the operator's responsibility — see the open row about the review
test server in [`ROADMAP.md`](ROADMAP.md).

**Trigger to re-open.** A deployment that cannot use a tailnet, or multi-user
support, which is a v1 non-goal below.

---

## 2026-02-19 — Data and visualization, no computed scores

**Decided:** 2026-02-19 (project start; stated in `README.md` § Design Principles)

**Decision.** FreeReps stores raw data and visualizes it. It computes no
composite scores — no Recovery, no Exertion, no readiness figure. Analysis is
delegated to Claude through the MCP server.

**Reasoning.** A proprietary score is an opaque function of inputs the user
cannot inspect, and every such algorithm encodes assumptions that do not
generalize across bodies. Raw data plus a free correlation explorer plus an LLM
gives the same answers with the derivation visible.

**Not doing, for the same reason.** Workout planning and automated coaching.

**Trigger to re-open.** A score that can state its inputs and its formula in the
UI, and that answers a question the correlation explorer cannot.

---

## 2026-02-19 — Non-goals for v1

**Decided:** 2026-02-19 (project start)

**Decision.** Out of scope: a native iOS/watchOS app beyond the sync companion,
direct Apple HealthKit integration on the server, multi-user support, third-party
integrations such as Strava, and push notifications.

**Reasoning.** Each of them widens the surface without serving the core loop —
collect, store, visualize, expose over MCP. Multi-user in particular would reach
into every query and into the auth decision above, which currently rests on
"one tailnet, one person".

**Note.** Per-user rows already exist in the schema (metric visibility, source
priority, Oura tokens). That is per-identity storage behind Tailscale identity,
not multi-user support: there is no tenancy boundary and no sharing model.

**Trigger to re-open.** A second person actually uses an instance.

---

## 2026-02-19 — Stack: Go, React, PostgreSQL + TimescaleDB

**Decided:** 2026-02-19 (project start; the table this replaces lived in `CLAUDE.md`)

**Decision.**

| Component | Choice | Reasoning |
|---|---|---|
| Backend | Go | Single binary with the web UI embedded via `go:embed`, which is what makes the self-hosted deployment one artifact. |
| Frontend | React 19 + Vite + Tailwind CSS 4 | Chart ecosystem and TypeScript. |
| Charts | uPlot for time series, Recharts for bar and scatter | uPlot renders the large series without dropping frames; Recharts composes declaratively where the data is small. |
| Database | PostgreSQL + TimescaleDB | Hypertables and rolling aggregates for time-series queries. |
| MCP transport | stdio and SSE | stdio for a local Claude Code session, SSE for remote access over the tailnet. |
| Deployment | Docker Compose | Database and app in one stack, multi-stage build. |

**Consequence that bites.** The `go:embed web/dist` directive means the backend
does not compile without that directory. Every build path needs the frontend
built first, or a stub — `.forgejo/workflows/ci.yml` creates the stub explicitly,
and `server/CLAUDE.md` documents the local equivalent.

**Trigger to re-open.** TimescaleDB licensing or packaging changes, or a chart
requirement neither library covers.
