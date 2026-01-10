// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Full E2E User Journey', () => {

  test('complete user journey: browse → select tickets → book → confirm', async ({ page }) => {
    // 1. Start on homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Racing F1/);
    
    // 2. Navigate to tickets page
    await page.click('a[href*="tickets"]');
    await expect(page).toHaveURL(/tickets/);
    
    // 3. Click to book (should go to booking SPA)
    const bookButton = page.locator('a[href*="booking"], .btn').filter({ hasText: /book/i }).first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
    } else {
      // Direct navigation to booking
      await page.goto('/booking-spa.html');
    }
    
    // 4. Verify on booking page
    await expect(page.locator('.race-option').first()).toBeVisible();
    
    // 5. Select Monaco GP
    await page.click('.race-option[data-race="monaco"]');
    await expect(page.locator('.race-option[data-race="monaco"]')).toHaveClass(/selected/);
    
    // 6. Select Grandstand tickets
    await page.click('.ticket-type[data-type="grandstand"]');
    await expect(page.locator('.ticket-type[data-type="grandstand"]')).toHaveClass(/selected/);
    
    // 7. Increase quantity to 3
    await page.click('#qty-plus');
    await expect(page.locator('#qty-value')).toHaveText('3');
    
    // 8. Verify order summary
    await expect(page.locator('#sum-race')).toContainText('Monaco');
    await expect(page.locator('#sum-type')).toContainText('Grandstand');
    await expect(page.locator('#sum-qty')).toHaveText('3');
    
    // 9. Continue to details
    await page.click('#btn-continue-to-details');
    await expect(page.locator('[data-page-id="TRAVELERDETAILS"]')).toHaveClass(/active/);
    
    // 10. Fill contact information
    await page.fill('#firstName', 'Michael');
    await page.fill('#lastName', 'Schumacher');
    await page.fill('#email', 'michael@f1legend.com');
    await page.fill('#phone', '+49123456789');
    
    // 11. Fill payment details
    await page.fill('#cardNumber', '4111111111111111');
    await page.fill('#expiry', '12/30');
    await page.fill('#cvv', '999');
    
    // 12. Complete booking
    await page.click('#btn-complete-booking');
    
    // 13. Verify confirmation
    await expect(page.locator('[data-page-id="CONFIRMATION"]')).toHaveClass(/active/);
    await expect(page.locator('.confirmation-title')).toContainText('Booking Confirmed');
    await expect(page.locator('#order-number')).toBeVisible();
    await expect(page.locator('#conf-race')).toContainText('Monaco');
    await expect(page.locator('#conf-qty')).toContainText('3');
    
    // 14. Return to home
    await page.click('a[href="index.html"], a[href="/"]');
    await expect(page).toHaveURL(/\/$|index/);
  });

  test('browse merchandise and add to cart flow', async ({ page }) => {
    // 1. Start on homepage
    await page.goto('/');
    
    // 2. Navigate to merchandise
    await page.click('a[href*="merchandise"]');
    await expect(page).toHaveURL(/merchandise/);
    
    // 3. Check products are displayed
    const products = page.locator('.product-card, .merchandise-item, .card');
    await expect(products.first()).toBeVisible();
    
    // 4. Navigate to cart
    await page.click('a[href*="cart"]');
    await expect(page).toHaveURL(/cart/);
  });

  test('authentication flow: login and register pages', async ({ page }) => {
    // Test login page
    await page.goto('/login.html');
    await expect(page.locator('input[type="email"], input[name="email"], #email')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"], #password')).toBeVisible();
    
    // Test register page
    await page.goto('/register.html');
    await expect(page.locator('form, .register-form, .card')).toBeVisible();
  });

  test('footer links and legal pages accessible', async ({ page }) => {
    await page.goto('/');
    
    // Check privacy policy
    await page.goto('/privacy.html');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Check terms
    await page.goto('/terms.html');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Check support
    await page.goto('/support.html');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('checkout flow accessible', async ({ page }) => {
    await page.goto('/checkout.html');
    await expect(page.locator('form, .checkout-form, .card')).toBeVisible();
  });

  test('experiences page shows VIP options', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href*="experiences"]');
    await expect(page).toHaveURL(/experiences/);
    await expect(page.locator('h1, h2, .experience-card, .card').first()).toBeVisible();
  });

  test('calendar page shows race schedule', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href*="calendar"]');
    await expect(page).toHaveURL(/calendar/);
    await expect(page.locator('.calendar, .race-calendar, .schedule, .card').first()).toBeVisible();
  });

});

test.describe('Security and Performance', () => {

  test('pages load without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out non-critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics') &&
      !e.includes('gtm')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('no mixed content warnings', async ({ page }) => {
    const mixedContent = [];
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('mixed content')) {
        mixedContent.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(mixedContent.length).toBe(0);
  });

  test('pages have proper meta tags', async ({ page }) => {
    await page.goto('/');
    
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset?.toLowerCase()).toBe('utf-8');
  });

  test('external links have proper attributes', async ({ page }) => {
    await page.goto('/');
    
    const externalLinks = page.locator('a[href^="http"]:not([href*="racing-f1"])');
    const count = await externalLinks.count();
    
    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      if (rel) {
        expect(rel).toContain('noopener');
      }
    }
  });

});
