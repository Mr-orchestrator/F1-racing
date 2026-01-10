// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Site Navigation', () => {
  
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Racing F1/);
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.main-nav')).toBeVisible();
    
    // Screenshot for visual verification
    await page.screenshot({ path: 'test-results/screenshots/homepage.png', fullPage: true });
  });

  test('navigate to Teams page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Teams")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/teams/);
    await page.screenshot({ path: 'test-results/screenshots/teams.png', fullPage: true });
  });

  test('navigate to Merchandise page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Merchandise")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/merchandise/);
    await page.screenshot({ path: 'test-results/screenshots/merchandise.png', fullPage: true });
  });

  test('navigate to Tickets page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Ticket")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tickets/);
    await page.screenshot({ path: 'test-results/screenshots/tickets.png', fullPage: true });
  });

  test('navigate to Experiences page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Experience")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/experiences/);
    await page.screenshot({ path: 'test-results/screenshots/experiences.png', fullPage: true });
  });

  test('navigate to Calendar page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Calendar")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/calendar/);
    await page.screenshot({ path: 'test-results/screenshots/calendar.png', fullPage: true });
  });

  test('navigate to Cart page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Cart"), a[href*="cart"]').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/cart/);
    await page.screenshot({ path: 'test-results/screenshots/cart.png', fullPage: true });
  });

  test('all main nav links are present', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('.main-nav a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('logo navigates to homepage', async ({ page }) => {
    await page.goto('/teams.html');
    await page.locator('.logo a, .logo').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/$/);
  });

  test('responsive navigation works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.screenshot({ path: 'test-results/screenshots/mobile-home.png', fullPage: true });
  });

});
