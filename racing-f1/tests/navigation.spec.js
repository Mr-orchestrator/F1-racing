// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Site Navigation', () => {
  
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Racing F1/);
  });

  test('teams page loads', async ({ page }) => {
    await page.goto('/teams.html');
    await expect(page).toHaveTitle(/Teams|Racing F1/);
  });

  test('merchandise page loads', async ({ page }) => {
    await page.goto('/merchandise.html');
    await expect(page).toHaveTitle(/Merchandise|Racing F1/);
  });

  test('tickets page loads', async ({ page }) => {
    await page.goto('/tickets.html');
    await expect(page).toHaveTitle(/Tickets|Racing F1/);
  });

  test('experiences page loads', async ({ page }) => {
    await page.goto('/experiences.html');
    await expect(page).toHaveTitle(/Experiences|Racing F1/);
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/calendar.html');
    await expect(page).toHaveTitle(/Calendar|Racing F1/);
  });

  test('cart page loads', async ({ page }) => {
    await page.goto('/cart.html');
    await expect(page).toHaveTitle(/Cart|Racing F1/);
  });

  test('booking spa page loads', async ({ page }) => {
    await page.goto('/booking-spa.html');
    await expect(page).toHaveTitle(/Booking|Racing F1/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page).toHaveTitle(/Login|Racing F1/);
  });

  test('support page loads', async ({ page }) => {
    await page.goto('/support.html');
    await expect(page).toHaveTitle(/Support|Racing F1/);
  });

});
