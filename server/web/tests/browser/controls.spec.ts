import {test,expect} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
test('range selection, keyboard dismissal and focus restoration',async({safePage:page,isMobile})=>{
 await page.goto('/sleep');
 if(isMobile){
  const trigger=page.getByRole('button',{name:'Last 30 days',exact:true});
  await trigger.click(); await expect(page.getByRole('dialog',{name:'Range'})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole('radio',{name:'Last 7 days',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }else await page.getByRole('radio',{name:'7d',exact:true}).click();
 await expect(page).toHaveURL(/range=7d/);
});
test('theme preference and system changes preserve black and green',async({safePage:page})=>{
 await page.emulateMedia({colorScheme:'dark'}); await page.goto('/settings');
 await expect(page.locator('html')).toHaveClass(/dark/);
 expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--background').trim())).toBe('#000000');
 await page.getByRole('radio',{name:'Light',exact:true}).click();
 await expect(page.locator('html')).not.toHaveClass(/dark/);
 await page.reload(); await expect(page.locator('html')).not.toHaveClass(/dark/);
 await page.getByRole('radio',{name:'Auto',exact:true}).click();
 await page.emulateMedia({colorScheme:'light'}); await expect(page.locator('html')).not.toHaveClass(/dark/);
 await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass(/dark/);
});
test('sleep controls have no serious accessibility violations',async({safePage:page})=>{
 await page.goto('/sleep'); await expect(page.getByText('Provisional · sleep-only')).toBeVisible();
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(results.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});
