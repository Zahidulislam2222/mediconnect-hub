import { expect, test } from './test';
import content from '../src/content/journey.json' with { type: 'json' };
import routing from '../src/config/journey-routing.json' with { type: 'json' };

for (const role of ['staff', 'patient', 'doctor']) {
  test(`${role} workspace requires the configured account entry`, async ({ page }) => {
    await page.goto(`${routing.application.workspace}/${role}`);
    await expect(page).toHaveURL(new RegExp(`${role === 'staff' ? routing.application.adminAuth : routing.application.auth}$`));
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('.jy-app')).toHaveCount(0);
  });
}

test('main entry preserves the connected-care design', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Care that stays\s*with you\./);
  await expect(page.locator('.jy-track')).toBeVisible();
  await expect(page.locator('.jy-header')).toBeVisible();
  await expect(page.locator('button').filter({ has: page.locator('svg.lucide-message-circle') })).toHaveCount(0);
});

test('clinician information fits a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/for-clinicians');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.viewport + 1);
});

test('public login opens regional authentication and releases public styles', async ({ page }) => {
  await page.goto('/');
  await page.locator('.jy-header').getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('tab', { name: /Patient/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Doctor/i })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('.jy-auth')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/jy-document/);
});

test('public guides preserve the service-backed knowledge route', async ({ page }) => {
  await page.goto('/');
  await page.locator('.jy-header').getByRole('link', { name: content.navigation.knowledge }).click();
  await expect(page).toHaveURL(new RegExp(`${routing.application.knowledge}$`));
  await expect(page.locator('.jy-article-card')).toHaveCount(content.articles.filter(item => item.kind === 'knowledge').length);
  await page.locator('.jy-article-card').first().click();
  await expect(page.locator('.jy-article section')).toHaveCount(3);
  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { name: 'Find Health Information' })).toBeVisible();
  await expect(page.locator('.jy-app')).toHaveCount(0);
});

test('public history does not create a stored identity', async ({ page }) => {
  await page.goto('/about');
  await page.locator('.jy-header').getByRole('link', { name: 'For clinicians' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
});

test('protected routes still require a verified session after public browsing', async ({ page }) => {
  await page.goto('/services');
  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await page.goto('/admin-auth');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('.jy-auth')).toHaveCount(0);
});

test('reduced-motion entry keeps useful navigation without starting the film', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jy-header')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
});
