// @ts-check
// Debug exactly what happens to User logged in event in chained flow
const { test } = require('@playwright/test');

test.setTimeout(90000);

const DEV_LAUNCH_URL = 'https://assets.adobedtm.com/236ca7d75265/a5282319db5b/launch-cc5a36c615c3-development.min.js';
const PROD_LAUNCH_PATTERN = /launch-[a-f0-9]+\.min\.js$/;
const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

test('DEBUG: full state during chained User logged in event', async ({ page }) => {
  // Override prod with dev library
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
  await page.waitForTimeout(3000);

  // Push 5 commerce events first (mimic the chained flow)
  const sequence = [
    { event: 'Product viewed', attributes: { product_id: 'P1', product_name: 'T', product_price: 99, product_category: 'C' } },
    { event: 'Add to cart', attributes: { product_id: 'P2', product_name: 'T', product_price: 99, product_quantity: 1, currency: 'USD' } },
    { event: 'Remove from cart', attributes: { product_id: 'P2', quantity_removed: 1 } },
    { event: 'View cart', attributes: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'BeginCheckout', attributes: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
  ];

  for (const s of sequence) {
    await page.evaluate((e) => window.adobeDataLayer.push(e), s);
    await page.waitForTimeout(2000);
  }

  console.log('\n=== Before User logged in push ===');
  const beforeState = await page.evaluate(() => ({
    dlLength: window.adobeDataLayer?.length,
    dlEvents: (window.adobeDataLayer || []).map((e, i) => `${i}: ${e?.event || '(no event)'}`),
    consumedIndex: window.__dlConsumedIndex,
    webSdkCalls: 'will count from page perspective'
  }));
  console.log(JSON.stringify(beforeState, null, 2));

  const beforeLoginCalls = calls.length;

  // Now push User logged in
  await page.evaluate(() => {
    window.adobeDataLayer.push({
      event: 'User logged in',
      attributes: {
        user_id: 'chained@test.com',
        user_email: 'chained@test.com',
        user_type: 'registered',
        customer_tier: 'gold'
      }
    });
  });
  await page.waitForTimeout(4000);

  console.log('\n=== After User logged in push ===');
  const afterState = await page.evaluate(() => ({
    dlLength: window.adobeDataLayer?.length,
    consumedIndex: window.__dlConsumedIndex,
    userLoginEntry: window.adobeDataLayer?.find(e => e?.event === 'User logged in')
  }));
  console.log(JSON.stringify(afterState, null, 2));

  console.log('\n=== Web SDK calls after User logged in push ===');
  const newCalls = calls.slice(beforeLoginCalls);
  newCalls.forEach((c, i) => {
    const events = c.postData?.events || [];
    events.forEach((e, ei) => {
      console.log(`\nCall ${i + 1}.${ei + 1}:`);
      console.log(`  eventType: ${e.xdm?.eventType}`);
      console.log(`  webInteraction: ${JSON.stringify(e.xdm?.web?.webInteraction)}`);
      console.log(`  identityMap: ${JSON.stringify(e.xdm?.identityMap)}`);
      console.log(`  eVars: ${JSON.stringify(e.xdm?._experience?.analytics?.customDimensions?.eVars)}`);
    });
  });
});
