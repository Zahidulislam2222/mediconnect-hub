import { test, expect } from '@playwright/test';

test.describe('Route Protection', () => {
  test('unauthenticated user visiting /patient-dashboard redirects to /auth', async ({ page }) => {
    // Clear any stored auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('_mc_auth');
      localStorage.removeItem('_mc_user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    });

    await page.goto('/patient-dashboard');

    // Should redirect to /auth since user is not authenticated
    await expect(page).toHaveURL(/\/auth/);
  });

  test('unauthenticated user can access / (landing page)', async ({ page }) => {
    // Clear auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('_mc_auth');
      localStorage.removeItem('_mc_user');
    });

    await page.goto('/');

    // Should stay on the landing page, not redirect to /auth
    await expect(page).not.toHaveURL(/\/auth/);
    // Landing page should have some content visible
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('unauthenticated user can access /knowledge (public)', async ({ page }) => {
    // Clear auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('_mc_auth');
      localStorage.removeItem('_mc_user');
    });

    await page.goto('/knowledge');

    // Should stay on knowledge page, not redirect to /auth
    await expect(page).not.toHaveURL(/\/auth/);
  });
});

test.describe('Protected Route Redirects', () => {
  test('unauthenticated user visiting /doctor-dashboard redirects to /auth', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('_mc_auth');
      localStorage.removeItem('_mc_user');
    });

    await page.goto('/doctor-dashboard');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('unauthenticated user visiting /admin/dashboard redirects to /auth', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('_mc_auth');
      localStorage.removeItem('_mc_user');
    });

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth/);
  });
});
