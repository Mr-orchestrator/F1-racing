// @ts-check
// Trace EXACTLY what fires when Add to Cart button is clicked
const { test } = require('@playwright/test');

test.setTimeout(60000);

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

test('Trace Add to Cart click — what events fire?', async ({ page }) => {
  const webSdkCalls = [];

  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      webSdkCalls.push({ url, postData, ts: Date.now() });
    }
  });

  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Reset to start fresh measurement
  const beforeClick = webSdkCalls.length;
  const dlBefore = await page.evaluate(() => (window.adobeDataLayer || []).length);

  console.log(`\n=== BEFORE CLICK ===`);
  console.log(`  Web SDK calls so far: ${beforeClick}`);
  console.log(`  adobeDataLayer entries: ${dlBefore}`);

  // Click Add to Cart ONCE
  console.log(`\n=== Clicking Add to Cart button ONCE ===`);
  const btn = page.locator('.add-cart-btn').first();
  await btn.click();
  await page.waitForTimeout(3000);

  const afterClick = webSdkCalls.length;
  const newCalls = webSdkCalls.slice(beforeClick);

  // Check what was pushed to adobeDataLayer
  const dlAfter = await page.evaluate((before) => {
    const dl = window.adobeDataLayer || [];
    return dl.slice(before).filter(e => e.event).map(e => ({
      event: e.event,
      hasAttrs: !!e.attributes,
      productId: e.attributes?.product_id
    }));
  }, dlBefore);

  console.log(`\n=== AFTER CLICK ===`);
  console.log(`  New Web SDK calls: ${afterClick - beforeClick}`);
  console.log(`  New adobeDataLayer entries: ${dlAfter.length}`);

  console.log(`\n=== adobeDataLayer pushes from the click ===`);
  dlAfter.forEach((e, i) => {
    console.log(`  ${i + 1}. "${e.event}" ${e.productId ? '(product: ' + e.productId + ')' : ''}`);
  });

  console.log(`\n=== Web SDK calls from the click ===`);
  newCalls.forEach((c, i) => {
    const events = c.postData?.events || [];
    events.forEach((e, ei) => {
      const xdm = e.xdm || {};
      console.log(`\n  Call ${i + 1}.${ei + 1}: ${xdm.eventType || 'unknown'}`);
      if (xdm.commerce) {
        const commerceKeys = Object.keys(xdm.commerce).filter(k => k !== 'order');
        console.log(`    Commerce: ${commerceKeys.join(', ')}`);
      }
      if (xdm.productListItems?.length) {
        console.log(`    Products: ${xdm.productListItems.map(p => p.SKU).join(', ')}`);
      }
      if (xdm.web?.webInteraction) {
        console.log(`    WebInteraction: ${JSON.stringify(xdm.web.webInteraction)}`);
      }
    });
  });

  // Summary
  const eventTypes = {};
  newCalls.forEach(c => {
    (c.postData?.events || []).forEach(e => {
      const t = e.xdm?.eventType || 'unknown';
      eventTypes[t] = (eventTypes[t] || 0) + 1;
    });
  });

  console.log(`\n=== SUMMARY — Events fired per 1 click ===`);
  Object.entries(eventTypes).forEach(([t, c]) => {
    let label = '';
    if (t === 'commerce.productListAdds') label = '(Add to Cart) ✓ EXPECTED';
    else if (t === 'commerce.productViews') label = '(Product Viewed) ✓ EXPECTED from addProduct call';
    else if (t === 'commerce.productListViews') label = '(View Cart) ✗ WRONG — should not fire on Add to Cart';
    else if (t === 'web.webinteraction.linkClicks') label = '(Link Click) — auto from Web SDK Click Collection';
    else if (t === 'web.webpagedetails.pageViews') label = '(Page View) ✗ WRONG — should not fire on click';
    console.log(`  ${t.padEnd(45)} ${c}x ${label}`);
  });
});
