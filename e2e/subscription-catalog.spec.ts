import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('catalog data changes reach the actual page without changing server entitlement', async ({ page }) => {
  const catalog = JSON.parse(readFileSync(path.join(process.cwd(), 'src/content/subscription-plans.json'), 'utf8'));
  catalog.plans[1].name = 'Test Plus Updated'; catalog.plans[1].price = 23.5; catalog.plans[1].discountPercent = 27;
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('**/src/context/VerifiedSession.tsx*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'const identity = { id: "test-user", role: "patient", expires: 2000000000 }; export const useVerifiedSession = () => identity;' }));
  await page.route('**/src/lib/api.ts*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'export const api = { get: async () => ({ planId: "plus", status: "active", discountPercent: 11, freeGpVisitsRemaining: 0, familyMembers: [], cycleStart: "", cycleEnd: "", cancelAtPeriodEnd: false }) };' }));
  await page.route('**/src/content/subscription-plans.json*', route => route.fulfill({ contentType: 'application/javascript',
    body: `export default ${JSON.stringify(catalog)};` }));
  await page.goto('/e2e/fixtures/subscription.html');
  await expect(page.getByRole('heading', { name: 'Test Plus Updated', exact: true })).toBeVisible();
  await expect(page.getByText('Test Plus Updated').filter({ has: page.getByText('Active', { exact: true }) })).toBeVisible();
  await expect(page.getByText('$23.5', { exact: true })).toBeVisible();
  await expect(page.getByText('27% off every visit', { exact: true })).toBeVisible();
  await expect(page.getByText('27% discount on all visits', { exact: true })).toBeVisible();
  await expect(page.getByText('11% discount on all visits', { exact: true })).toBeVisible();
  await expect(page.getByText('MediConnect Plus', { exact: true })).toHaveCount(0);
});
