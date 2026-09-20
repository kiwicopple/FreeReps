-- Three workout names that reached the database unnormalized, because
-- workoutNameMap (internal/ingest/workouts.go) had no entry for them:
--
--   'Radfahren' — the German Apple Health name without a location prefix. The
--     map covered 'Outdoor Radfahren' and 'Innenräume Radfahren' only, so the
--     Health Auto Export REST payload of 2026-09-20 wrote a second name for a
--     sport that already had 276 rows as 'Cycling'.
--   'Dance' — the English Apple Health name, while the canonical value is
--     'Dancing', taken from the Oura entry 'dancing'.
--   'yardwork' — an Oura activity name in the lowercase form that migration
--     000013 normalized for every other Oura activity.
--
-- Row counts at the time of writing: 1, 2, 1.
UPDATE workouts SET name = 'Cycling' WHERE name = 'Radfahren';
UPDATE workouts SET name = 'Dancing' WHERE name = 'Dance';
UPDATE workouts SET name = 'Yard Work' WHERE name = 'yardwork';
