import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const safety = JSON.parse(readFileSync(path.join(process.cwd(), 'src/content/symptom-safety.json'), 'utf8')) as Record<string, string>;

interface AuthBridge { __holdSymptomAuth: boolean; __failSymptomLogout: boolean; __releaseSymptomAuth?: () => void }
async function open(page: Page, outcome: 'available' | 'unavailable' | 'malformed' = 'available') {
  const writes: unknown[] = [];
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'symptoms.example.test') return route.abort();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'authorization, content-type, x-user-region',
    } });
    if (request.method() === 'POST') {
      writes.push(request.postDataJSON());
      const json = outcome === 'available'
        ? { success: true, status: 'available', analysis: { risk: 'Unknown', reason: 'Synthetic response' }, pdfBase64: 'JVBERi0xLjQK' }
        : outcome === 'malformed' ? { success: true, analysis: { risk: 'Low', reason: 'Unsupported response' } } : { success: false };
      return route.fulfill({ status: outcome === 'unavailable' ? 503 : 200,
        headers: { 'access-control-allow-origin': '*' }, json });
    }
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { name: 'Synthetic Patient' } });
  });
  for (const [pattern, fixture] of [
    ['**/.vite/deps/aws-amplify_auth.js*', 'symptom-auth.mock.js'],
    ['**/src/config/env.ts*', 'symptom-config.mock.js'],
  ]) await page.route(pattern, route => route.fulfill({ contentType: 'application/javascript',
    body: readFileSync(path.join(process.cwd(), 'e2e/fixtures', fixture), 'utf8') }));
  await page.goto('/e2e/fixtures/symptom-safety.html');
  await expect(page.getByText('Synthetic Patient', { exact: true })).toBeVisible();
  return writes;
}
async function send(page: Page) {
  await page.getByRole('textbox', { name: safety.inputLabel }).fill('Synthetic question');
  await page.getByRole('button', { name: safety.sendLabel }).click();
}

test('real symptom UI labels an explicit available response and PDF as AI draft', async ({ page }) => {
  const writes = await open(page); await send(page);
  await expect(page.getByText(safety.reportLabel, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: safety.downloadLabel })).toBeVisible();
  await expect(page.getByText(/Synthetic response/)).toBeVisible();
  await expect(page.getByText(safety.unverifiedStatus)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Clinical PDF' })).toHaveCount(0);
  expect(writes).toEqual([{ text: 'Synthetic question' }]);
});

for (const outcome of ['unavailable', 'malformed'] as const) test(`real symptom UI does not invent risk for ${outcome}`, async ({ page }) => {
  const writes = await open(page, outcome); await send(page);
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByText(safety.unavailable, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Risk: Low|rest and hydration|Daily Quota/)).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

for (const action of ['leave', 'sign out'] as const) test(`real symptom request cannot dispatch after ${action} during authentication`, async ({ page }) => {
  const writes = await open(page);
  await page.evaluate(() => { (window as unknown as AuthBridge).__holdSymptomAuth = true; });
  await send(page);
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as AuthBridge).__releaseSymptomAuth)).toBe('function');
  if (action === 'leave') await page.getByRole('button', { name: 'Leave test symptoms' }).click();
  else await page.locator('button').filter({ has: page.locator('svg.lucide-log-out') }).click();
  await page.evaluate(async () => { (window as unknown as AuthBridge).__releaseSymptomAuth!(); await Promise.resolve(); });
  await page.waitForLoadState('networkidle');
  expect(writes).toEqual([]);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  if (action === 'sign out') await expect(page.getByLabel('Test location')).toHaveText('/auth');
});

test('failed provider sign-out leaves input closed without a false assessment spinner', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { (window as unknown as AuthBridge).__failSymptomLogout = true; });
  await page.locator('button').filter({ has: page.locator('svg.lucide-log-out') }).click();
  await expect(page.getByText(safety.logoutFailed, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('textbox')).toBeDisabled();
  await expect(page.getByText(safety.loadingLabel)).toHaveCount(0);
  await expect(page.getByLabel('Test location')).toHaveText('/symptom-checker');
});
