// @ts-check
// Interactive Web SDK test — triggers events and watches for edge calls
// Run: BASE_URL=https://racing-f1-rho.vercel.app npx playwright test websdk-interactive --project=chromium
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

test('Interactive — trigger events and capture edge traffic', async ({ page }) => {
  const edgeCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('edge.adobedc.net')) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      edgeCalls.push({ url, postData, ts: Date.now() });
    }
  });

  // ============================
  // 1. Home page load
  // ============================
  console.log('\n=== Step 1: Loading home page ===');
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  console.log(`  Edge calls after home: ${edgeCalls.length}`);

  // ============================
  // 2. Force satellite.track to trigger custom event
  // ============================
  console.log('\n=== Step 2: Trying _satellite.track("Add to cart") ===');
  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Add to cart',
      attributes: {
        product_id: 'TEST-001',
        product_name: 'Test Product',
        product_category: 'Test',
        product_price: 99.99,
        product_quantity: 1,
        currency: 'USD'
      }
    });
  });
  await page.waitForTimeout(4000);
  console.log(`  Edge calls after Add to cart push: ${edgeCalls.length}`);

  // ============================
  // 3. Navigate to merchandise
  // ============================
  console.log('\n=== Step 3: Navigating to /merchandise ===');
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  console.log(`  Edge calls after merchandise: ${edgeCalls.length}`);

  // ============================
  // 4. Click real Add to Cart button
  // ============================
  console.log('\n=== Step 4: Clicking real Add to Cart button ===');
  const btn = page.locator('.add-cart-btn').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(4000);
  }
  console.log(`  Edge calls after button click: ${edgeCalls.length}`);

  // ============================
  // 5. Direct alloy call
  // ============================
  console.log('\n=== Step 5: Direct alloy("sendEvent") call ===');
  const directResult = await page.evaluate(() => {
    return window.alloy('sendEvent', {
      xdm: {
        eventType: 'web.webpagedetails.pageViews',
        web: { webPageDetails: { name: 'Direct test', pageViews: { value: 1 } } }
      }
    }).then(() => 'success').catch(e => 'fail: ' + e.message);
  });
  console.log(`  Direct alloy: ${directResult}`);
  await page.waitForTimeout(3000);
  console.log(`  Edge calls after direct alloy: ${edgeCalls.length}`);

  // ============================
  // 6. Inspect what each edge call contained
  // ============================
  console.log('\n=== Edge Call Details ===');
  edgeCalls.forEach((call, i) => {
    const events = call.postData?.events || [];
    events.forEach((e, ei) => {
      console.log(`\n  Call ${i + 1}.${ei + 1}:`);
      console.log(`    eventType: ${e.xdm?.eventType}`);
      console.log(`    commerce:  ${JSON.stringify(e.xdm?.commerce || {})}`);
      console.log(`    products:  ${JSON.stringify(e.xdm?.productListItems || [])}`);
    });
  });

  // ============================
  // 7. Final summary
  // ============================
  console.log('\n=== Summary ===');
  console.log(`  Total edge calls: ${edgeCalls.length}`);
  console.log(`  Direct alloy result: ${directResult}`);

  if (edgeCalls.length === 0) {
    console.log('\n  ✗ NO EDGE CALLS — rules not firing AND direct alloy not firing');
    console.log('  → Web SDK extension config issue OR rule action XDM field broken');
  } else if (directResult === 'success' && edgeCalls.length === 1) {
    console.log('\n  ⚠ Only direct alloy fired — rule action XDM field is misconfigured');
    console.log('  → Open any rule action, verify XDM field shows %XDM - ExperienceEvent%');
  } else {
    console.log('\n  ✓ Web SDK firing correctly');
  }
});
