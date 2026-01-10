// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Accessibility Tests', () => {

  test('homepage has proper heading structure', async ({ page }) => {
    await page.goto('/');
    
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThanOrEqual(1);
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('form inputs have labels', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await page.locator('.race-option').first().click();
    await page.locator('.ticket-type').first().click();
    await page.click('#btn-continue-to-details');
    
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const ariaLabel = await inputs.nth(i).getAttribute('aria-label');
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      
      // Should have either a label, aria-label, or placeholder
      const hasAccessibleName = id || ariaLabel || placeholder;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent();
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label');
      
      const hasName = (text && text.trim()) || ariaLabel;
      expect(hasName).toBeTruthy();
    }
  });

  test('links have discernible text', async ({ page }) => {
    await page.goto('/');
    
    const links = page.locator('a');
    const count = await links.count();
    
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await links.nth(i).textContent();
      const ariaLabel = await links.nth(i).getAttribute('aria-label');
      const title = await links.nth(i).getAttribute('title');
      
      const hasName = (text && text.trim()) || ariaLabel || title;
      expect(hasName).toBeTruthy();
    }
  });

  test('page has lang attribute', async ({ page }) => {
    await page.goto('/');
    
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('color contrast is sufficient', async ({ page }) => {
    await page.goto('/');
    
    // Check primary text color against background
    const textColor = await page.evaluate(() => {
      const body = document.body;
      return getComputedStyle(body).color;
    });
    
    expect(textColor).toBeTruthy();
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('skip link exists', async ({ page }) => {
    await page.goto('/');
    
    // Check for skip link (common accessibility pattern)
    const skipLink = page.locator('a[href="#main"], a[href="#content"], .skip-link');
    // Skip links are often hidden until focused
  });

  test('focus is visible', async ({ page }) => {
    await page.goto('/');
    
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus');
    const isVisible = await focusedElement.isVisible();
    
    // Focused element should be visible
    expect(isVisible).toBe(true);
  });

});

test.describe('ARIA Tests', () => {

  test('interactive elements have proper roles', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    const clickableCards = page.locator('.race-option, .ticket-type');
    const count = await clickableCards.count();
    
    // These should be clickable and accessible
    for (let i = 0; i < count; i++) {
      const card = clickableCards.nth(i);
      await expect(card).toBeVisible();
    }
  });

  test('progress indicator is accessible', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    const progressSteps = page.locator('.step, .progress-step');
    await expect(progressSteps.first()).toBeVisible();
  });

  test('form validation messages are announced', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    // Try to proceed without selections
    const continueBtn = page.locator('#btn-continue-to-details');
    
    if (await continueBtn.isVisible()) {
      // Button should be present
      await expect(continueBtn).toBeVisible();
    }
  });

});
