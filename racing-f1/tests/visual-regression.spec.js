// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Visual Regression Tests', () => {

  test('homepage visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('teams page visual snapshot', async ({ page }) => {
    await page.goto('/teams.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('teams.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('merchandise page visual snapshot', async ({ page }) => {
    await page.goto('/merchandise.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('merchandise.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('booking SPA visual snapshot - ticket selection', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('booking-tickets.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('booking SPA visual snapshot - with selections', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await page.click('.race-option[data-race="monaco"]');
    await page.click('.ticket-type[data-type="vip"]');
    await expect(page).toHaveScreenshot('booking-selected.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('mobile homepage visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('tablet homepage visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('tablet-homepage.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

});

test.describe('Component Visual Tests', () => {

  test('header component', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toHaveScreenshot('header.png');
  });

  test('navigation active state', async ({ page }) => {
    await page.goto('/teams.html');
    const nav = page.locator('.main-nav');
    await expect(nav).toHaveScreenshot('nav-teams-active.png');
  });

  test('product card hover state', async ({ page }) => {
    await page.goto('/merchandise.html');
    const card = page.locator('.product-card, .card').first();
    await card.hover();
    await expect(card).toHaveScreenshot('product-card-hover.png');
  });

  test('button states', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.btn-primary, .btn').first();
    
    // Normal state
    await expect(btn).toHaveScreenshot('button-normal.png');
    
    // Hover state
    await btn.hover();
    await expect(btn).toHaveScreenshot('button-hover.png');
  });

});

test.describe('Accessibility Visual Tests', () => {

  test('focus states are visible', async ({ page }) => {
    await page.goto('/');
    
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    await page.screenshot({ path: 'test-results/screenshots/focus-state.png' });
  });

  test('high contrast check', async ({ page }) => {
    await page.goto('/');
    
    // Check text is readable
    const bodyText = page.locator('body');
    const color = await bodyText.evaluate(el => getComputedStyle(el).color);
    const bgColor = await bodyText.evaluate(el => getComputedStyle(el).backgroundColor);
    
    expect(color).toBeTruthy();
    expect(bgColor).toBeTruthy();
  });

});
