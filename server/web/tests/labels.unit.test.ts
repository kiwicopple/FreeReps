import { expect, test } from 'vitest';
import { metricLabel } from '../src/utils/metricLabel';
// Prevent imported field names from leaking into labels during selector migration.
test('metric labels preserve configured names and format missing ones',()=>{
 expect(metricLabel('walking_asymmetry_percentage')).toBe('Walking Asymmetry');
 expect(metricLabel('future_metric')).toBe('Future Metric');
 expect(metricLabel('heart_rate','Pulse')).toBe('Pulse');
});
