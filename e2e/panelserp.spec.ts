import { test, expect } from '@playwright/test';

// Requires the Astro dev server running on port 4321 (npm run dev)
// and the FastAPI backend on port 8000 (uvicorn src.main:app --reload)
// Run with: npx playwright test e2e/panelserp.spec.ts

test('login page renders with PanelsERP title and email/password fields', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await expect(page.locator('h1')).toContainText('PanelsERP');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('login with wrong credentials shows error message', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await page.fill('input[name="email"]', 'nobody@test.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
});
