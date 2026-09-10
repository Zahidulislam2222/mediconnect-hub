import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
});

test('the main app opens the owner-approved connected-care design', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Care that stays\s*with you\./);
  await expect(page.locator('.jy-track')).toBeVisible();
  await expect(page.locator('.jy-header')).toBeVisible();
  await expect(page.locator('button').filter({ has: page.locator('svg.lucide-message-circle') })).toHaveCount(0);
});

test('the doctor demonstration fits a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/demo/doctor');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make room for the conversation.');
  const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.viewport + 1);
});

test('journey login reaches real regional authentication and releases journey document styles', async ({ page }) => {
  await page.goto('/');
  await page.locator('.jy-header').getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('tab', { name: /Patient/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Doctor/i })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('.jy-auth')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/jy-document/);
});

test('sample library stays separate from the existing service-backed knowledge route', async ({ page }) => {
  await page.goto('/');
  await page.locator('.jy-header').getByRole('link', { name: 'Knowledge base' }).click();
  await expect(page).toHaveURL(/\/demo\/knowledge$/);
  await expect(page.locator('.jy-article-card')).toHaveCount(6);
  await page.locator('.jy-article-card').first().click();
  await expect(page).toHaveURL(/\/demo\/knowledge\/.+/);
  await expect(page.locator('.jy-article section')).toHaveCount(3);
  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { name: 'Find Health Information' })).toBeVisible();
  await expect(page.locator('.jy-app')).toHaveCount(0);
  await expect(page).toHaveURL(/\/knowledge$/);
});

test('demo state persists between sample roles and clears when entering real authentication', async ({ page }) => {
  await page.goto('/demo/patient');
  await page.getByRole('button', { name: '14:00', exact: true }).click();
  await page.getByRole('link', { name: 'For clinicians' }).click();
  await expect(page.locator('[data-slot]')).toHaveText('14:00');
  await page.locator('.jy-header').getByRole('link', { name: 'Log in' }).click();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-slot]')).toHaveText('10:30');
  expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
});

test('direct protected routes still require a verified session after browsing the demo', async ({ page }) => {
  await page.goto('/demo/patient');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeVisible();
  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await page.goto('/admin-auth');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('.jy-auth')).toHaveCount(0);
});

test('reduced-motion homepage keeps useful navigation without starting the film', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jy-header')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
});
