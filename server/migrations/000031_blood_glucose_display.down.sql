DELETE FROM user_metric_visibility WHERE metric_name = 'blood_glucose';
UPDATE metric_allowlist SET display_unit = '' WHERE metric_name = 'blood_glucose';
