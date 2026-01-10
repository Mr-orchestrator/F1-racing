// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Accessibility Tests', () => {

  test('page has lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('page has viewport meta', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
  });

  test('page has charset', async ({ page }) => {
    await page.goto('/');
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset).toBeTruthy();
  });

  test('body is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('ARIA Tests', () => {

  test('booking page has interactive elements', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const cards = page.locator('.race-card, .race-option, .ticket-card, .ticket-type');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('booking page has progress steps', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const steps = page.locator('.step, .progress-step');
    const count = await steps.count();
    expect(count).toBeGreaterThan(0);
  });

});
