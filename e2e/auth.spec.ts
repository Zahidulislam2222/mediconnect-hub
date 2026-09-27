import { test, expect } from './test';

test.describe('Auth Page', () => {
  test('login form renders with email and password fields', async ({ page }) => {
    await page.goto('/auth');

    // Verify login form is visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('region selector exists with US and EU options', async ({ page }) => {
    await page.goto('/auth');

    // The region selector uses Radix Tabs with US and EU options
    const regionSection = page.getByText('Region', { exact: true });
    await expect(regionSection).toBeVisible();

    const usTab = page.getByRole('tab', { name: /US/i });
    await expect(usTab).toBeVisible();

    const euTab = page.getByRole('tab', { name: /EU/i });
    await expect(euTab).toBeVisible();
  });

  test('role tabs for patient and doctor exist', async ({ page }) => {
    await page.goto('/auth');

    // The auth page has Patient and Doctor role tabs
    const patientTab = page.getByRole('tab', { name: /Patient/i });
    await expect(patientTab).toBeVisible();

    const doctorTab = page.getByRole('tab', { name: /Doctor/i });
    await expect(doctorTab).toBeVisible();
  });

  test('sign in button is present', async ({ page }) => {
    await page.goto('/auth');

    const signInButton = page.getByRole('button', { name: /Sign In/i });
    await expect(signInButton).toBeVisible();
  });

  test('can switch between login and signup views', async ({ page }) => {
    await page.goto('/auth');

    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('checkbox', { name: /Functional/ }).uncheck();
    await page.getByRole('checkbox', { name: /Analytics/ }).uncheck();
    await page.getByRole('button', { name: 'Accept Selected', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Customize', exact: true })).toBeHidden();

    const signUpLink = page.getByRole('button', { name: 'Create one now', exact: true });
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    // Signup exposes the name field that is absent from login.
    const nameInput = page.getByLabel('Full Name', { exact: true });
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(nameInput).toBeHidden();
    await expect(signUpLink).toBeVisible();
  });
});
