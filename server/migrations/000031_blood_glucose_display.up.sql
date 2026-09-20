-- blood_glucose has been on the allowlist since 000008 and appears in the
-- dropdowns for any user who has data, but without display metadata. The label
-- is covered by the frontend fallback ("Blood Glucose"); the unit is not.
--
-- The unit is read from the stored rows rather than written as a constant,
-- because Apple Health reports mg/dL or mmol/L depending on the device region
-- and metric_allowlist holds one row for all users. Where no rows exist the
-- unit stays empty and the UI omits it.
UPDATE metric_allowlist a
SET display_unit = COALESCE((
        SELECT h.units
        FROM health_metrics h
        WHERE h.metric_name = 'blood_glucose' AND h.units <> ''
        GROUP BY h.units
        ORDER BY count(*) DESC, h.units
        LIMIT 1
    ), a.display_unit)
WHERE a.metric_name = 'blood_glucose';

-- Make the metric visible for users who already have data. defaultVisibleMetrics
-- in Go applies only where no override row exists, so a user who has opened the
-- settings page once would never see it. DO NOTHING keeps a deliberate choice.
INSERT INTO user_metric_visibility (user_id, metric_name, visible)
SELECT DISTINCT h.user_id, 'blood_glucose', true
FROM health_metrics h
WHERE h.metric_name = 'blood_glucose'
ON CONFLICT (user_id, metric_name) DO NOTHING;
