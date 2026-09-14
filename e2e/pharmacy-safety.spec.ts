import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
type FixtureWindow = Window & { __pharmacyScenario: string; __pharmacyCalls: { path: string; body: { prescriptionId?: string } }[]; __pharmacyPayments: { amount: number }[]; __finishPharmacy?: () => void };
async function open(page: Page, scenario: string) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  for (const [pattern, name] of [
    ['**/.vite/deps/aws-amplify_auth.js*', 'symptom-auth.mock.js'],
    ['**/src/lib/api.ts*', 'pharmacy-api.mock.js'],
    ['**/src/context/CheckoutContext.tsx*', 'pharmacy-payment.mock.js'],
  ]) await page.route(pattern, route => route.fulfill({ contentType: 'application/javascript', body: readFileSync(path.join(process.cwd(), 'e2e/fixtures', name), 'utf8') }));
  await page.addInitScript(value => { const fixture = window as FixtureWindow; fixture.__pharmacyScenario = value; fixture.__pharmacyCalls = []; fixture.__pharmacyPayments = []; }, scenario);
  await page.goto('/e2e/fixtures/pharmacy-safety.html');
  await expect(page.getByText('test-alpha', { exact: true })).toBeVisible();
}
test('missing server token never opens a pickup dialog', async ({ page }) => {
  await open(page, 'missing'); await page.getByRole('button', { name: 'Pickup Code' }).first().click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).__pharmacyCalls.length)).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('valid pickup renders the exact token', async ({ page }) => {
  await open(page, 'valid'); await page.getByRole('button', { name: 'Pickup Code' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('PICKUP-test-alpha');
});
test('first refill click targets the chosen prescription', async ({ page }) => {
  await open(page, 'refill'); await page.getByRole('button', { name: /Refill/ }).nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).__pharmacyCalls)).toEqual([{ path: '/pharmacy/request-refill', body: { prescriptionId: 'test-beta' } }]);
  await expect(page.getByText(/Doctor notified/)).toHaveCount(0);
});
test('pending payment uses bill amount and remains blocked after syncing', async ({ page }) => {
  await open(page, 'payment'); await page.getByRole('button', { name: /Pay/ }).first().click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).__pharmacyPayments[0]?.amount)).toBe(12);
  await expect(page.getByText('Check billing before another payment')).toBeVisible();
  await page.getByRole('button', { name: 'Sync' }).click();
  await expect(page.getByRole('button', { name: /Pay/ }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pickup Code' })).toHaveCount(0);
});
test('leaving the page discards a late pickup result', async ({ page }) => {
  await open(page, 'hold'); await page.getByRole('button', { name: 'Pickup Code' }).first().click();
  await expect.poll(() => page.evaluate(() => typeof (window as FixtureWindow).__finishPharmacy)).toBe('function');
  await page.getByRole('button', { name: 'Leave test pharmacy' }).click();
  await page.evaluate(() => (window as FixtureWindow).__finishPharmacy?.());
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
