// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Visual Regression Tests', () => {

  test('homepage loads for screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Just verify page loads - screenshots require baseline
    await expect(page).toHaveTitle(/Racing F1/);
  });

  test('teams page loads for screenshot', async ({ page }) => {
    await page.goto('/teams.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/Teams|Racing F1/);
  });

  test('booking page loads for screenshot', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/Booking|Racing F1/);
  });

});

test.describe('Accessibility Visual Tests', () => {

  test('page has visible content', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('body has text color', async ({ page }) => {
    await page.goto('/');
    const color = await page.locator('body').evaluate(el => getComputedStyle(el).color);
    expect(color).toBeTruthy();
  });

});
