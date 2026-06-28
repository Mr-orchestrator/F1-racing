// @ts-check
// Print FULL captured XDM for EVERY Web SDK call during chained flow
// This reveals whether identityMap is actually in the captured calls
const { test } = require('@playwright/test');

test.setTimeout(90000);

const DEV_LAUNCH_URL = 'https://assets.adobedtm.com/236ca7d75265/a5282319db5b/launch-cc5a36c615c3-development.min.js';
const PROD_LAUNCH_PATTERN = /launch-[a-f0-9]+\.min\.js$/;
const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

test('FULL CAPTURE — print every Web SDK XDM during 6-event chained flow', async ({ page }) => {
  await page.route('**/launch-*.min.js', async (route) => {
    const url = route.request().url();
    if (PROD_LAUNCH_PATTERN.test(url) && !url.includes('-development')) {
      const response = await page.request.fetch(DEV_LAUNCH_URL);
      await route.fulfill({
        status: response.status(),
        headers: { 'Content-Type': 'application/javascript' },
        body: await response.body()
      });
      return;
    }
    await route.continue();
  });

  const calls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      calls.push({ url, postData, ts: Date.now() });
    }
  });

  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const sequence = [
    { event: 'Product viewed', attributes: { product_id: 'P1', product_name: 'T', product_price: 99, product_category: 'C' } },
    { event: 'Add to cart', attributes: { product_id: 'P2', product_name: 'T', product_price: 99, product_quantity: 1, currency: 'USD' } },
    { event: 'Remove from cart', attributes: { product_id: 'P2', quantity_removed: 1 } },
    { event: 'View cart', attributes: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'BeginCheckout', attributes: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
    { event: 'User logged in', attributes: { user_id: 'chained@test.com', user_email: 'chained@test.com', user_type: 'registered', customer_tier: 'gold' } },
  ];

  for (const s of sequence) {
    await page.evaluate((e) => window.adobeDataLayer.push(e), s);
    await page.waitForTimeout(2500);
  }

  console.log('\n=== ALL CAPTURED WEB SDK CALLS ===');
  console.log(`Total calls: ${calls.length}`);

  calls.forEach((c, ci) => {
    const events = c.postData?.events || [];
    events.forEach((e, ei) => {
      console.log(`\n──── Call ${ci + 1}.${ei + 1} ────`);
      console.log(`eventType: ${e.xdm?.eventType}`);
      console.log(`identityMap: ${JSON.stringify(e.xdm?.identityMap)}`);
      console.log(`commerce: ${JSON.stringify(e.xdm?.commerce)}`);
      console.log(`webInteraction: ${JSON.stringify(e.xdm?.web?.webInteraction)}`);
      console.log(`eVars: ${JSON.stringify(e.xdm?._experience?.analytics?.customDimensions?.eVars)}`);
    });
  });

  // Now look for events with identityMap
  const allXdm = [];
  calls.forEach(c => (c.postData?.events || []).forEach(e => allXdm.push(e.xdm || {})));

  const loginEvents = allXdm.filter(e => e.identityMap?.Email);
  console.log(`\n=== EVENTS WITH identityMap ===`);
  console.log(`Count: ${loginEvents.length}`);
  loginEvents.forEach((e, i) => {
    console.log(`\n  Event ${i + 1}:`);
    console.log(`    eventType: ${e.eventType}`);
    console.log(`    identityMap: ${JSON.stringify(e.identityMap)}`);
  });
});
