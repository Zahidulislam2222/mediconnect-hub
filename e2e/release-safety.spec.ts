import { test, expect } from '@playwright/test';

for (const route of ['/', '/auth']) {
  test(`security badges remain qualified at ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('body')).not.toContainText('GDPR Ready');
    await expect(page.locator('body')).not.toContainText('AES-256');
    await expect(page.locator('body')).toContainText(route === '/auth'
      ? 'Security controls under review' : 'not a claim of regulatory certification');
  });
}

test('forged browser state cannot enter private administration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('_mc_auth', 'true');
    localStorage.setItem('user', JSON.stringify({ id: 'test-user', role: 'admin' }));
  });
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('heading', { name: /welcome|sign in/i }).first()).toBeVisible();
});

for (const route of ['/privacy-policy', '/hipaa-compliance', '/terms-of-service']) {
  test(`public notice accurately labels the demonstration at ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('main')).toContainText('Demonstration only.');
    await expect(page.getByRole('main')).not.toContainText('We have signed Business Associate Agreements');
    await expect(page.getByRole('main')).not.toContainText('7 years as required by HIPAA');
  });
}

test('optional consent starts unselected and refusal does not disappear on login-page navigation', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('button', { name: /customize/i }).click();
  const checkboxes = page.locator('input[type="checkbox"]:enabled');
  await expect(checkboxes).toHaveCount(2);
  for (const checkbox of await checkboxes.all()) await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: 'Accept Selected' }).click();
  await page.waitForLoadState('domcontentloaded');
  const consent = await page.evaluate(() => JSON.parse(localStorage.getItem('gdpr_consent') || 'null'));
  expect(consent).toMatchObject({ essential: true, functional: false, analytics: false });
  await page.goto('/privacy-policy');
  await page.goto('/auth');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gdpr_consent') || 'null'))).toEqual(consent);
});
