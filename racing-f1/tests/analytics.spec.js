// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('GridBox Analytics Layer', () => {

  test('gridboxLayer exists on page', async ({ page }) => {
    await page.goto('/');
    const exists = await page.evaluate(() => typeof window.gridboxLayer !== 'undefined');
    expect(exists).toBe(true);
  });

  test('gridboxLayer has event array', async ({ page }) => {
    await page.goto('/');
    const hasEventArray = await page.evaluate(() => Array.isArray(window.gridboxLayer?.event));
    expect(hasEventArray).toBe(true);
  });

  test('gridboxLayer has page object', async ({ page }) => {
    await page.goto('/');
    const hasPage = await page.evaluate(() => window.gridboxLayer?.page !== undefined);
    expect(hasPage).toBe(true);
  });

  test('gridboxLayer has user array', async ({ page }) => {
    await page.goto('/');
    const hasUser = await page.evaluate(() => Array.isArray(window.gridboxLayer?.user));
    expect(hasUser).toBe(true);
  });

  test('gridbox API exists', async ({ page }) => {
    await page.goto('/');
    const exists = await page.evaluate(() => typeof window.gridbox !== 'undefined');
    expect(exists).toBe(true);
  });

  test('SPA gridboxLayer exists', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const exists = await page.evaluate(() => typeof window.gridboxLayer !== 'undefined');
    expect(exists).toBe(true);
  });

});
