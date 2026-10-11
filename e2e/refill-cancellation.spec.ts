import { expect, test, type Page } from './test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
type FixtureWindow = typeof window & { __refillScenario: string; __refillCalls: { path: string; body: unknown }[]; __finishCancellation?: () => void };
async function open(page: Page, scenario: string) {
  for (const [pattern, name] of [
    ['**/.vite/deps/aws-amplify_auth.js*', 'symptom-auth.mock.js'],
    ['**/src/lib/api.ts*', 'refill-cancellation-api.mock.js'],
  ]) await page.route(pattern, route => new URL(route.request().url()).searchParams.has('refill-fixture-original')
    ? route.fallback() : route.fulfill({ contentType: 'application/javascript', body: readFileSync(path.join(process.cwd(), 'e2e/fixtures', name), 'utf8') }));
  await page.route('**/src/components/layout/DashboardLayout.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const DashboardLayout = ({children}) => children;' }));
  await page.addInitScript(value => { const w = window as FixtureWindow; w.__refillScenario = value; w.__refillCalls = []; }, scenario);
  await page.goto('/e2e/fixtures/refill-cancellation.html');
  await page.getByText('Synthetic Patient', { exact: true }).click();
  await page.getByRole('tab', { name: /refill/i }).click();
  await page.getByRole('button', { name: 'Cancel prescription' }).click();
  await expect(page.getByRole('dialog')).toContainText('Unpaid bills are closed');
}
test('dismissal does not cancel; confirmation uses the chosen prescription and shows server confirmation', async ({ page }) => {
  await open(page, 'confirmed');
  await page.getByRole('button', { name: 'Keep prescription' }).click();
  expect(await page.evaluate(() => (window as FixtureWindow).__refillCalls)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel prescription' }).click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByText('Prescription cancelled', { exact: true })).toBeVisible();
  await expect(page.getByText('Refill Requested', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as FixtureWindow).__refillCalls)).toEqual([{ path: '/prescriptions/test-rx/cancel', body: {} }]);
});
test('a refused cancellation keeps the prescription and exposes the safe service reason', async ({ page }) => {
  await open(page, 'refused'); await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByText('The prescription changed. Refresh before updating it.', { exact: true })).toBeVisible();
  await expect(page.getByText('Refill Requested', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel prescription' })).toBeEnabled();
});
test('an unknown outcome cannot be retried or followed by approval', async ({ page }) => {
  await open(page, 'uncertain'); await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByText('Cancellation outcome unconfirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('Refill Requested', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel prescription' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
});
test('a pending confirmation cannot be submitted twice', async ({ page }) => {
  await open(page, 'pending'); await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Keep prescription' })).toBeDisabled();
  expect(await page.evaluate(() => (window as FixtureWindow).__refillCalls.length)).toBe(1);
  await page.evaluate(() => (window as FixtureWindow).__finishCancellation?.());
  await expect(page.getByText('Prescription cancelled', { exact: true })).toBeVisible();
});
