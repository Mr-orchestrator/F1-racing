// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Booking SPA Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/booking-spa.html');
  });

  test('booking page loads with ticket selection', async ({ page }) => {
    await expect(page.locator('.page-view.active')).toBeVisible();
    await expect(page.locator('[data-page-id="TICKETSELECTION"]')).toHaveClass(/active/);
    await expect(page.locator('.race-option').first()).toBeVisible();
  });

  test('can select a race', async ({ page }) => {
    const monacoOption = page.locator('.race-option[data-race="monaco"]');
    await monacoOption.click();
    await expect(monacoOption).toHaveClass(/selected/);
    
    // Check summary updates
    await expect(page.locator('#sum-race')).toContainText('Monaco');
  });

  test('can select ticket type', async ({ page }) => {
    // First select a race
    await page.click('.race-option[data-race="monaco"]');
    
    // Then select ticket type
    const vipTicket = page.locator('.ticket-type[data-type="vip"]');
    await vipTicket.click();
    await expect(vipTicket).toHaveClass(/selected/);
    
    // Check summary updates
    await expect(page.locator('#sum-type')).toContainText('VIP');
  });

  test('can change ticket quantity', async ({ page }) => {
    const plusBtn = page.locator('#qty-plus');
    const qtyValue = page.locator('#qty-value');
    
    await expect(qtyValue).toHaveText('2');
    await plusBtn.click();
    await expect(qtyValue).toHaveText('3');
    
    const minusBtn = page.locator('#qty-minus');
    await minusBtn.click();
    await expect(qtyValue).toHaveText('2');
  });

  test('complete booking flow - ticket selection to details', async ({ page }) => {
    // Step 1: Select race
    await page.click('.race-option[data-race="monaco"]');
    
    // Step 2: Select ticket type
    await page.click('.ticket-type[data-type="grandstand"]');
    
    // Step 3: Continue to details
    await page.click('#btn-continue-to-details');
    
    // Verify navigation to details page
    await expect(page.locator('[data-page-id="TRAVELERDETAILS"]')).toHaveClass(/active/);
    await expect(page.locator('#firstName')).toBeVisible();
  });

  test('complete booking flow - details to confirmation', async ({ page }) => {
    // Navigate through ticket selection
    await page.click('.race-option[data-race="silverstone"]');
    await page.click('.ticket-type[data-type="general"]');
    await page.click('#btn-continue-to-details');
    
    // Fill in contact details
    await page.fill('#firstName', 'John');
    await page.fill('#lastName', 'Doe');
    await page.fill('#email', 'john.doe@example.com');
    await page.fill('#phone', '+1234567890');
    
    // Fill in payment details
    await page.fill('#cardNumber', '4242424242424242');
    await page.fill('#expiry', '12/28');
    await page.fill('#cvv', '123');
    
    // Complete booking
    await page.click('#btn-complete-booking');
    
    // Verify confirmation page
    await expect(page.locator('[data-page-id="CONFIRMATION"]')).toHaveClass(/active/);
    await expect(page.locator('.confirmation-title')).toContainText('Booking Confirmed');
    await expect(page.locator('#order-number')).toBeVisible();
  });

  test('can go back from details to ticket selection', async ({ page }) => {
    // Navigate to details
    await page.click('.race-option[data-race="monaco"]');
    await page.click('.ticket-type[data-type="vip"]');
    await page.click('#btn-continue-to-details');
    
    // Go back
    await page.click('#btn-back-to-tickets');
    
    // Verify back on ticket selection
    await expect(page.locator('[data-page-id="TICKETSELECTION"]')).toHaveClass(/active/);
  });

  test('progress steps update correctly', async ({ page }) => {
    const steps = page.locator('.step');
    
    // Initial state - first step active
    await expect(steps.nth(0)).toHaveClass(/active/);
    
    // Navigate to details
    await page.click('.race-option[data-race="monaco"]');
    await page.click('.ticket-type[data-type="general"]');
    await page.click('#btn-continue-to-details');
    
    // Second step should be active, first completed
    await expect(steps.nth(0)).toHaveClass(/completed/);
    await expect(steps.nth(1)).toHaveClass(/active/);
  });

  test('order summary calculates correctly', async ({ page }) => {
    // Select Monaco ($350 base) with VIP (3x multiplier)
    await page.click('.race-option[data-race="monaco"]');
    await page.click('.ticket-type[data-type="vip"]');
    
    // 350 * 3 = 1050 per ticket, 2 tickets = 2100 subtotal
    await expect(page.locator('#sum-subtotal')).toContainText('$2100');
    
    // Service fee 10% = 210
    await expect(page.locator('#sum-fee')).toContainText('$210');
    
    // Total = 2310
    await expect(page.locator('#sum-total')).toContainText('$2310');
  });

});
