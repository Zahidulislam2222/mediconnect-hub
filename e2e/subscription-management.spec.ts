import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
interface Bridge { __statusMode?: string; __finishStatus?: () => void; __finishPortal?: () => void; __opened: string[] }
async function open(page: Page, mode = 'deferred') {
  await page.addInitScript(mode => {
    const bridge = window as unknown as Bridge; bridge.__statusMode = mode; bridge.__opened = [];
    window.confirm = () => true;
    window.open = url => { bridge.__opened.push(String(url)); return null; };
  }, mode);
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('**/src/context/VerifiedSession.tsx*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'const identity = { id: "test-user", role: "patient", expires: 2000000000 }; export const useVerifiedSession = () => identity;' }));
  await page.route('**/src/lib/subscription.ts*', route => route.fulfill({ contentType: 'application/javascript',
    body: readFileSync(path.join(process.cwd(), 'e2e/fixtures/subscription-api.mock.js'), 'utf8') }));
  await page.goto('/e2e/fixtures/subscription.html');
  await expect(page.getByRole('button', { name: /cancel plan/i })).toBeEnabled();
}
test('real cancellation UI waits for confirmed shared status', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /cancel plan/i }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Bridge).__finishStatus));
  await expect(page.getByText('Cancellation scheduled', { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as Bridge).__finishStatus?.());
  await expect(page.getByText('Cancellation scheduled', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Shared subscription')).toContainText('"cancelAtPeriodEnd":true');
});
test('real failure UI does not claim cancellation confirmation', async ({ page }) => {
  await open(page, 'failure'); await page.getByRole('button', { name: /cancel plan/i }).click();
  await expect(page.getByText('Cancellation not confirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('Cancellation scheduled', { exact: true })).toHaveCount(0);
  await expect(page.getByText('test-private-diagnostic', { exact: true })).toHaveCount(0);
});
test('navigation prevents late shared status and notification', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /cancel plan/i }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Bridge).__finishStatus));
  await page.getByRole('button', { name: 'Leave subscription' }).click();
  await page.evaluate(async () => { (window as unknown as Bridge).__finishStatus?.(); await Promise.resolve(); });
  await expect(page.getByLabel('Shared subscription')).toContainText('"cancelAtPeriodEnd":false');
  await expect(page.getByText('Cancellation scheduled', { exact: true })).toHaveCount(0);
});
test('session clearing prevents a late external billing window', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /manage billing/i }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Bridge).__finishPortal));
  await page.getByRole('button', { name: 'Clear test session' }).click();
  await page.evaluate(async () => { (window as unknown as Bridge).__finishPortal?.(); await Promise.resolve(); });
  expect(await page.evaluate(() => (window as unknown as Bridge).__opened)).toEqual([]);
  await expect(page.getByLabel('Shared subscription')).toHaveText('null');
});
