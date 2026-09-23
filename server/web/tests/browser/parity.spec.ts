import { test, expect } from './fixtures';
// Route smoke tests protect all existing feature entrypoints during replacement.
for (const [path,title] of [['/','Today'],['/nutrition','Nutrition'],['/sleep','Sleep'],['/workouts','Workouts'],['/workouts/synthetic-run','Indoor Run'],['/metrics?metric=heart_rate','Metrics'],['/correlations','Correlations'],['/trends','Trends'],['/settings','Settings']]) {
 test(`route ${path}`,async({safePage:page})=>{
  await page.goto(path);
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
 });
}
test('sleep date and recovery remain available',async({safePage:page})=>{
 await page.goto('/sleep');
 await expect(page.getByText('Protocol recovery · experimental v1')).toBeVisible();
 await expect(page.getByText('Provisional · sleep-only')).toBeVisible();
 await page.getByRole('button',{name:'Previous night'}).click();
 await expect(page).toHaveURL(/date=2025-01-13/);
 await expect(page.getByText('No sleep recorded for this date.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Latest',exact:true}).click();
 await expect(page.getByText('Provisional · sleep-only')).toBeVisible();
});
test('nutrition details preserve education and food contributions',async({safePage:page})=>{
 await page.goto('/nutrition');
 await page.getByText('Calories',{exact:true}).first().click();
 await expect(page.getByText('Calories measure the energy in food and drink.',{exact:false})).toBeVisible();
 await expect(page.getByText('Synthetic oats',{exact:false}).first()).toBeVisible();
});
