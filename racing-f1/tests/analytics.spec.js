// @ts-check
const { test, expect } = require('@playwright/test');

const pages = [
  { name: 'Homepage', url: '/' },
  { name: 'Teams', url: '/teams.html' },
  { name: 'Merchandise', url: '/merchandise.html' },
  { name: 'Tickets', url: '/tickets.html' },
  { name: 'Experiences', url: '/experiences.html' },
  { name: 'Calendar', url: '/calendar.html' },
  { name: 'Cart', url: '/cart.html' },
  { name: 'Login', url: '/login.html' },
  { name: 'Register', url: '/register.html' },
  { name: 'Checkout', url: '/checkout.html' },
  { name: 'Support', url: '/support.html' },
  { name: 'Privacy', url: '/privacy.html' },
  { name: 'Terms', url: '/terms.html' },
  { name: 'Booking SPA', url: '/booking-spa.html' },
];

test.describe('GridBox Analytics Layer - All Pages', () => {

  for (const p of pages) {
    test(`gridboxLayer exists on ${p.name}`, async ({ page }) => {
      await page.goto(p.url);
      const exists = await page.evaluate(() => typeof window.gridboxLayer !== 'undefined');
      expect(exists).toBe(true);
    });

    test(`gridboxLayer has W3C structure on ${p.name}`, async ({ page }) => {
      await page.goto(p.url);
      const hasStructure = await page.evaluate(() => {
        const gl = window.gridboxLayer;
        return gl && 
               Array.isArray(gl.event) && 
               gl.page !== undefined && 
               Array.isArray(gl.user);
      });
      expect(hasStructure).toBe(true);
    });
  }

  test('gridboxLayer has version', async ({ page }) => {
    await page.goto('/');
    const version = await page.evaluate(() => window.gridboxLayer?.version);
    expect(version).toBe('2.12.0');
  });

});
