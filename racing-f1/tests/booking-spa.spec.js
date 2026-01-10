// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Booking SPA Flow', () => {
  
  test('booking page loads', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await expect(page).toHaveTitle(/Booking|Racing F1/);
  });

  test('race options are visible', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const raceOptions = page.locator('.race-card, .race-option');
    const count = await raceOptions.count();
    expect(count).toBeGreaterThan(0);
  });

  test('ticket types are visible', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const ticketTypes = page.locator('.ticket-card, .ticket-type');
    const count = await ticketTypes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('progress steps exist', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const steps = page.locator('.step, .progress-step');
    const count = await steps.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('can click on race option', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const firstRace = page.locator('.race-card, .race-option').first();
    await firstRace.click();
    // Should not throw error
  });

  test('can click on ticket type', async ({ page }) => {
    await page.goto('/booking-spa.html');
    const firstTicket = page.locator('.ticket-card, .ticket-type').first();
    await firstTicket.click();
    // Should not throw error
  });

});
