-- The same night's sleep stages were stored twice for every user whose sleep
-- comes from a provider that also writes into HealthKit.
--
-- Oura reaches FreeReps through its own API, where parseSleepPhases cuts
-- sleep_phase_5_min into segments on a 5-minute grid. The Oura app also writes
-- the night into HealthKit, from where the FreeReps iOS app forwards it as
-- HKCategoryTypeIdentifierSleepAnalysis category samples with second-precision
-- bounds — plus an "In Bed" sample spanning the whole night, which the API
-- never sends. Both carry source = 'Oura', and the bounds differ, so neither
-- the unique index nor a source priority separated them.
--
-- Measured on the deployed instance on 2026-09-20 for the night of the 19th:
-- 135 stage rows, 59 overlapping pairs, 17.27 hours of stages against 8.6
-- hours in bed, and 38 awakenings where the ring reports about half that.
--
-- The rows that came through the ingest endpoint are identifiable: each one
-- has a category sample with the same user and the same start and end. Those
-- are deleted, and only for users whose sleep resolves to a provider that
-- syncs on its own — the same condition the ingest now applies going forward
-- (internal/ingest/health/provider.go, sleepClaimedBySync). A user without
-- such a provider keeps every row, because for them this path is the only one.
--
-- The session rows are untouched. They are written from Oura's long_sleep
-- entry alone and were always correct, which is why the headline figures on
-- the sleep screen were right while the stage composition was not.
DELETE FROM sleep_stages s
USING category_samples c
WHERE c.user_id = s.user_id
  AND c.type = 'HKCategoryTypeIdentifierSleepAnalysis'
  AND c.start_date = s.start_time
  AND c.end_date = s.end_time
  AND (
    SELECT sp.sources[1]
    FROM source_priority sp
    WHERE sp.user_id = s.user_id
      AND sp.category IN ('sleep', '_default')
    -- A category rule outranks the default, exactly as ResolveSourcePriority reads it.
    ORDER BY (sp.category = 'sleep') DESC
    LIMIT 1
  ) IN ('Oura', 'Withings');
