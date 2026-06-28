const { test, expect } = require('@playwright/test');
const PROD = 'https://racing-f1-rho.vercel.app/';
test('Tealium utag loads on PROD', async ({ page }) => {
  const utagReqs = [];
  page.on('request', r => { if (/tiqcdn\.com\/utag\//.test(r.url())) utagReqs.push(r.url()); });
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.utag && window.utag.cfg), null, { timeout: 20000 });
  const info = await page.evaluate(() => ({
    hasUtag: !!window.utag, profile: window.utag && window.utag.cfg && window.utag.cfg.utid,
    v: window.utag && window.utag.cfg && window.utag.cfg.v, hasGridbox: !!window.gridbox
  }));
  console.log('PROD_TEALIUM ' + JSON.stringify({ ...info, utagReqs: utagReqs.length }));
  expect(info.hasUtag).toBe(true);
  expect(info.profile).toContain('f1racing');
});
