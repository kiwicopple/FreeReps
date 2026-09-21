# Food intake from chat

Send a photo or a description of something consumed in the connected conversation.
The assistant identifies the foods, estimates the consumed portions, looks up
available nutrition, and saves a structured record in FreeReps. Photos are not
saved by FreeReps. Images attached to a chat remain subject to that chat service's
own retention; this feature does not delete them there.

The original dashboard remains available. A separate Nutrition tab displays
logged intake, effective-dated targets and daily completion. Nutrition is also
available through the local client and the FreeReps MCP/API. A separate ChatGPT conversation needs access to
these tools; creating the database alone does not connect an unrelated chat.

## Logging workflow for the assistant

1. Treat meal photos sent for this established food-log workflow as authorized
   logging requests. Do not ask for repetitive approval. If it is unclear whether
   the meal was actually consumed, ask before recording it. For a package or
   supplement label, establish the amount consumed rather than logging the whole
   container. Do not treat a recipe, menu, or planned meal as eaten.
2. Identify items separately, including drinks, supplements, sauces, oils and
   leftovers when known. Record the amount actually consumed. Ask a short question
   when a hidden ingredient or portion ambiguity materially changes the estimate;
   otherwise record transparent assumptions and an appropriate range. Never
   claim the photograph measures calories, ingredients or micronutrients.
3. Use supplied labels first for a known packaged product, then an actual matching
   food-composition record such as USDA FoodData Central or a manufacturer label.
   Save the reference for each nutrient. Scale per-serving/per-100 g values to the
   consumed portion before saving. `basis=estimate` with an explicit model-estimate
   reference is appropriate when no verified composition source is available.
   Never fabricate source IDs or citations. Confidence includes food identification
   and portion uncertainty, not just confidence in the lookup table.
4. Omit unknown nutrients. Do not infer a zero because a label or database omits a
   vitamin. An entire nutrient map can be empty so a consumed item is still logged.
   Use grams, milligrams and micrograms exactly as the catalog specifies; `ug`
   denotes micrograms. Convert kJ to kcal before saving energy. Do not sum vitamin
   A IU with RAE, or folate DFE with folic acid; these require source-specific
   conversion rules. Supplemental minerals should use the elemental amount.
   Total fat, fat subtypes, omega-3, EPA/DHA, sugar and carbohydrate are overlapping
   measures, not additive ingredients for a grand nutrient total.
5. Use the stated consumption date/time. Default date timezone for this user is
   Asia/Singapore unless they say otherwise. If only the date is known, use
   `time_precision=date_only` and omit `eaten_at`; do not invent a meal time.
   Exact or approximate timestamps must agree with the local date and timezone.
6. Read that day's log before writing. Give each distinct eating event a new UUID,
   retain the same UUID for a retry, and correct the existing record when the user
   clarifies it. Multiple pictures of one meal are one event, not multiple meals.
7. Save, then read back the day's log to verify the entry and totals. Report a short
   food/portion breakdown, rounded estimated calories and macros, significant
   assumptions, and that the entry was saved. Retain its ID/version for subsequent
   corrections. Report only nutrients that have a defensible source or estimate.
   When a write fails, say it was not saved; never claim success from an estimate.
8. Daily totals mean **logged intake**, not proof that the whole day was captured.
   `known_subtotal` sums the available values. Show coverage when some items lack a
   nutrient; zero is a recorded value, while null is unknown. Blood biomarkers
   are separate measurements and must not be written as dietary intake. A food
   photo or incomplete log does not establish nutrient deficiency or sufficiency.

USDA references: [data documentation](https://fdc.nal.usda.gov/data-documentation/)
and [Foundation Foods](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).
Composition records themselves may have incomplete nutrient coverage.

## Access in this workspace

The Mac's local FreeReps service is available to the assistant without exposing
the database or sending the photo to another image-analysis service:

```sh
python3 tools/food-log.py catalog
python3 tools/food-log.py list 2026-01-01 2026-01-02
python3 tools/food-log.py save - < /path/to/private-food-record.json
python3 tools/food-log.py history ENTRY_UUID
```

Prefer sending JSON on stdin. If a temporary file is necessary, keep personal food
records outside Git. `input/` is ignored. Do not put actual intake in examples,
commits, tests or public issues. The local client uses the installation's single
local profile; remote MCP/API calls use the existing authenticated profile.

MCP tools: `get_nutrient_catalog` (includes schema), `save_food_entry`,
`get_food_log`, and `get_food_history`. Existing clients may need to reconnect to
refresh their tool list. The assistant can use the local client in this workspace
without configuring a new external ChatGPT connector.

## Record contract

`POST /api/v1/food` accepts one JSON object (maximum 256 KiB):

- `expected_version`: 0 to create; the version returned by a prior read to correct.
- `reason`: required explanation of this log or revision.
- `entry`: `id` (UUID), `local_date` (ISO date), `timezone` (IANA), optional
  `eaten_at` (RFC3339), `time_precision` (`exact`, `approximate`, `date_only`),
  optional `meal`/`notes`, `status` (`recorded` or `voided`), and `items`.
- Each item has `name`, `kind` (`food`, `drink`, `supplement`), `portion` (consumed
  amount), optional `grams`, `portion_basis` (`weighed`, `label`, `user`,
  `photo_estimate`), `assumptions` (required for photo estimates), and `nutrients`.
- `nutrients` maps catalog keys to `{value, unit, basis, confidence, reference}`.
  `basis` is `label`, `database`, `estimate`, or `measured`; `confidence` is `low`,
  `medium`, or `high`. Optional `low` and `high` must both be supplied and bracket
  `value`. They are assumption ranges, not statistical confidence intervals.
  All amounts are consumed-portion totals. Unknown keys should be omitted.

The response contains the saved entry, its version and creation/update timestamps.
An identical retry returns the current record without another insertion or audit
revision. A different payload with an obsolete version returns HTTP 409. To remove
an item that was not eaten, correct the entry; to exclude an entire entry, save a
new version with `status=voided`. Restoring it is another version with
`status=recorded`. Prior versions remain in the audit history.

`GET /api/v1/food?start=YYYY-MM-DD&end=YYYY-MM-DD` returns records (including
voided records) and daily totals excluding voids. The end date is exclusive.
Queries are limited to 366 days and 2,000 records; larger result sets fail rather
than silently truncating totals. Dates without entries are included as unknown.
Nutrient totals carry `known_items`, `total_items`, `complete_for_logged_items`,
and `estimated_items`; completeness of logged items is not completeness of the
entire diet. Ranges are returned only when every logged item has a range for that
nutrient. Combined ranges are simple sums and do not model correlated uncertainty.

`GET /api/v1/food/catalog` returns canonical nutrient units.
`GET /api/v1/food/{id}/history` returns all revisions in version order.
All reads and writes are scoped by authenticated user, never a body-supplied ID.

## Storage and verification

Migration 000033 adds `food_entries` and `food_entry_revisions`. A short transaction
locks the current record while applying a correction and writing its audit row.
Indexes cover user/date queries and user/entry/version history. This does not add
food estimates to device measurements or count a second import of the same meal.

Unit tests cover validation, missing values, ranges, image-field rejection, and
summary semantics. Storage integration tests cover concurrent duplicate saves,
conflicting corrections, preserved history, void/restore and user isolation on
`freereps_scratch`. Use `skills/verify/SKILL.md` for the broader checks.

## Nutrition dashboard and protocol

The `/nutrition` tab shows a selected local date or a 7-/30-day window ending on
that date. The default date zone is Asia/Singapore. It refreshes on focus and every
60 seconds while visible. Mobile navigation links Trends from More.

`GET /api/v1/nutrition/protocol` returns immutable revisions in version order.
`PUT` at the same path accepts `{expected_version, reason, protocol}`. The
protocol contains `effective_date`, `timezone`, a private `profile` (age, sex,
height_cm, weight_kg, activity, goal, preferences), `notes` and `targets`. A target
contains `value`, canonical `unit`, `kind` (`goal`, `range`, `maximum`, `reference`),
`label`, and `source`. Range targets require `low` and `high`. Optional `upper`
means a total-intake upper limit and is accepted only for supported nutrients
whose forms can be compared safely. It is not a goal. See the model validation
for the allowlist; retinol, supplemental magnesium and folic-acid limits cannot
be applied to undifferentiated nutrient totals.

For each date use the greatest effective date not after that date, breaking ties
by greatest version. Use the latest overall version as the next save's conflict
token. Identical retries return the latest record; stale changes return HTTP 409.
Changing profile inputs does not silently recalculate targets. Personal profiles
and protocol values are saved through the authenticated API, never migrations.

`GET /api/v1/nutrition/days?start=YYYY-MM-DD&end=YYYY-MM-DD` returns saved completion
states; absent dates are incomplete at version 0. `GET /api/v1/nutrition/days/{date}`
returns that default explicitly. `PUT` there accepts `{complete, expected_version}`.
Food creation, correction, voiding or moving reopens affected dates in the same
transaction and increments the day version. Identical food retries do not reopen
completed dates. Completion writes and food changes share a per-user transaction
lock to reject stale completion attempts.

Chat tools: `get_nutrition_protocol`, `save_nutrition_protocol`,
`get_nutrition_days`, `save_nutrition_day`. Mark a day complete only when the user
reports that the day's intake is fully logged. A complete day may still lack
nutrient composition. Missing days are chart gaps and averages exclude missing
values, disclose their denominator, and include partial days. Potential shortfalls
are shown only for completed days with values for every logged item. This is not
a nutrient-deficiency diagnosis. Upper-limit comparisons use known intake only;
values already above a limit can be flagged even when other values are missing.

Creatine is a catalog nutrient in grams. Record the actual dose separately from
powder weight. EPA and DHA are components of omega-3; never sum them into it twice.
Water's reference includes food moisture, and is not a plain-water drinking goal.
The dashboard neither prescribes supplements nor changes targets from exercise
calories. Blood results, recommendations and scheduled reports are separate work.

Frontend calculation checks: `node --experimental-strip-types --test
server/web/tests/nutrition.test.ts`. Storage integration tests cover history,
conflicts, reopening both dates after a move, retry safety and user isolation.
