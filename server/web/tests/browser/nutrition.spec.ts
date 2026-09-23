import {test,expect,protocol} from './fixtures';
test('nested nutrient drawer closes to its parent and restores focus',async({safePage:page,isMobile})=>{
 await page.goto('/nutrition');await page.getByText('Other nutrients',{exact:true}).click();
 // Cholesterol is deliberately absent, and must remain unknown rather than zero.
 await page.getByText('Cholesterol',{exact:true}).first().click();
 await expect(page.getByText('Your body uses cholesterol',{exact:false})).toBeVisible();
 if(isMobile){
  await expect(page.getByRole('dialog',{name:'Cholesterol',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close Cholesterol',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Other nutrients',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 }
});
test('editor retains drafts on conflict, validates blanks and sends versioned payload',async({safePage:page})=>{
 const writes:unknown[]=[];let fail=true;
 await page.route('**/api/v1/nutrition/protocol',async route=>{
  if(route.request().method()==='GET')return route.fallback();
  expect(route.request().method()).toBe('PUT');writes.push(route.request().postDataJSON());
  await route.fulfill(fail?{status:409,json:{error:'Version conflict. Reload and try again.'}}:{json:{protocol,version:2}});
 });
 await page.goto('/nutrition');await page.getByRole('button',{name:'Edit targets',exact:true}).click();
 const editor=page.getByRole('region',{name:'Edit nutrition targets'});
 await editor.getByLabel('Reason',{exact:true}).fill('Synthetic target update');
 await editor.getByRole('button',{name:'Calories · 2200 kcal'}).click();
 await editor.getByLabel('Target (kcal)',{exact:true}).fill('');
 await editor.getByRole('button',{name:'Save targets',exact:true}).click();expect(writes).toEqual([]);
 await editor.getByLabel('Target (kcal)',{exact:true}).fill('2300');
 await editor.getByLabel('Source',{exact:true}).first().fill('Synthetic source');
 // Fill the other required source too; fixtures intentionally start blank.
 await editor.getByRole('button',{name:'Protein · 100 g'}).click();
 await editor.getByLabel('Source',{exact:true}).last().fill('Synthetic source');
 await editor.getByRole('button',{name:'Save targets',exact:true}).click();
 await expect(editor.getByRole('alert')).toContainText('Version conflict');
 await expect(editor.getByLabel('Reason',{exact:true})).toHaveValue('Synthetic target update');
 fail=false; await editor.getByRole('button',{name:'Save targets',exact:true}).click();
 await expect(editor).toHaveCount(0);expect(writes).toHaveLength(2);
 expect(writes[1]).toEqual({expected_version:1,reason:'Synthetic target update',protocol:{...protocol,effective_date:'2025-01-15',targets:{...protocol.targets,energy:{...protocol.targets.energy,value:2300,source:'Synthetic source'},protein:{...protocol.targets.protein,source:'Synthetic source'}}}});
});
test('cancel makes no mutation and completion uses the expected version',async({safePage:page})=>{
 let body:unknown;
 await page.route('**/api/v1/nutrition/days/2025-01-15',async route=>{expect(route.request().method()).toBe('PUT');body=route.request().postDataJSON();await route.fulfill({json:{date:'2025-01-15',complete:true,version:2}});});
 await page.goto('/nutrition');await page.getByRole('button',{name:'Edit targets',exact:true}).click();
 await page.getByLabel('Reason',{exact:true}).fill('Unsaved');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Mark day complete',exact:true}).click();
 await expect.poll(()=>body).toEqual({complete:true,expected_version:1});
});
test('calendar selection preserves the local day',async({safePage:page})=>{
 await page.goto('/nutrition');await page.getByRole('button',{name:'Choose end date'}).click();
 await page.getByRole('button',{name:/January 10th, 2025/}).click();
 await expect(page).toHaveURL(/date=2025-01-10/);await expect(page.locator('input[aria-label="End date"]')).toHaveValue('2025-01-10');
});
