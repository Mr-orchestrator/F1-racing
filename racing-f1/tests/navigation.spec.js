// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Site Navigation', () => {
  
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Racing F1/);
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.main-nav')).toBeVisible();
  });

  test('navigate to Teams page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="teams.html"], a[href="/teams"]');
    await expect(page).toHaveURL(/teams/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('navigate to Merchandise page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="merchandise.html"], a[href="/merchandise"]');
    await expect(page).toHaveURL(/merchandise/);
  });

  test('navigate to Tickets page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="tickets.html"], a[href="/tickets"]');
    await expect(page).toHaveURL(/tickets/);
  });

  test('navigate to Experiences page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="experiences.html"], a[href="/experiences"]');
    await expect(page).toHaveURL(/experiences/);
  });

  test('navigate to Calendar page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="calendar.html"], a[href="/calendar"]');
    await expect(page).toHaveURL(/calendar/);
  });

  test('navigate to Cart page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="cart.html"], a[href="/cart"]');
    await expect(page).toHaveURL(/cart/);
  });

  test('navigate to Support page', async ({ page }) => {
    await page.goto('/');
    const supportLink = page.locator('a[href="support.html"], a[href="/support"]').first();
    if (await supportLink.isVisible()) {
      await supportLink.click();
      await expect(page).toHaveURL(/support/);
    }
  });

  test('all main nav links are present', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('.main-nav a');
    await expect(navLinks).toHaveCount(5);
  });

});
