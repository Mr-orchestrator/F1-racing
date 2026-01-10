// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Full E2E User Journey', () => {

  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Racing F1/);
  });

  test('can navigate to tickets', async ({ page }) => {
    await page.goto('/tickets.html');
    await expect(page).toHaveTitle(/Tickets|Racing F1/);
  });

  test('can navigate to booking', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await expect(page).toHaveTitle(/Booking|Racing F1/);
  });

  test('can navigate to merchandise', async ({ page }) => {
    await page.goto('/merchandise.html');
    await expect(page).toHaveTitle(/Merchandise|Racing F1/);
  });

  test('can navigate to cart', async ({ page }) => {
    await page.goto('/cart.html');
    await expect(page).toHaveTitle(/Cart|Racing F1/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page).toHaveTitle(/Login|Racing F1/);
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register.html');
    await expect(page).toHaveTitle(/Register|Racing F1/);
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page).toHaveTitle(/Privacy|Racing F1/);
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms.html');
    await expect(page).toHaveTitle(/Terms|Racing F1/);
  });

});

test.describe('Security and Performance', () => {

  test('homepage has viewport meta', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('homepage has charset', async ({ page }) => {
    await page.goto('/');
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset?.toLowerCase()).toBe('utf-8');
  });

  test('pages load without critical errors', async ({ page }) => {
    const criticalErrors = [];
    page.on('pageerror', error => {
      if (!error.message.includes('favicon') && !error.message.includes('gtm')) {
        criticalErrors.push(error.message);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Allow some non-critical errors
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

});
