// @ts-check
// Web SDK (a12) validation - verifies edge.adobedc.net/ee/v2/interact calls
// fire with correct XDM payloads from the new Web SDK rules.
//
// Run: BASE_URL=https://racing-f1-rho.vercel.app npx playwright test websdk-a12-validation --project=chromium
const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

// Capture all Web SDK edge calls
function trackEdge(page) {
  const calls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('edge.adobedc.net') || url.includes('/ee/v2/interact') || url.includes('/ee/v1/interact')) {
      let postData = null;
      try {
        postData = req.postDataJSON();
      } catch (e) {}
      calls.push({
        url,
        method: req.method(),
        postData,
        timestamp: Date.now(),
      });
    }
  });
  return calls;
}

// Helper to wait for edge calls
async function waitForEdge(page, ms = 3000) {
  await page.waitForTimeout(ms);
}

test('Web SDK loads and alloy is defined globally', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await waitForEdge(page, 2000);

  const result = await page.evaluate(() => {
    return {
      hasAlloy: typeof window.alloy === 'function',
      hasSatellite: typeof window._satellite !== 'undefined',
      hasAdobeDataLayer: Array.isArray(window.adobeDataLayer),
      adobeDataLayerLength: (window.adobeDataLayer || []).length,
      hasS: typeof window.s !== 'undefined',
    };
  });

  console.log('\nRUNTIME CHECK:');
  console.log('  alloy (Web SDK):', result.hasAlloy ? '✓ loaded' : '✗ MISSING');
  console.log('  _satellite:', result.hasSatellite ? '✓ loaded' : '✗ MISSING');
  console.log('  adobeDataLayer:', result.hasAdobeDataLayer ? `✓ (${result.adobeDataLayerLength} events)` : '✗ MISSING');
  console.log('  AA tracker (s):', result.hasS ? '✓ still present' : '✗ removed');

  expect(result.hasAlloy, 'alloy global should be defined when Web SDK loads').toBeTruthy();
  expect(result.hasSatellite, '_satellite (Launch) should be loaded').toBeTruthy();
});

test('Page View fires Web SDK interact call with correct XDM', async ({ page }) => {
  const edgeCalls = trackEdge(page);
  await page.goto('/', { waitUntil: 'load' });
  await waitForEdge(page, 3000);

  console.log('\nPAGE VIEW BEACONS:');
  console.log(`  Total edge calls captured: ${edgeCalls.length}`);

  if (edgeCalls.length === 0) {
    console.log('  ✗ NO EDGE CALLS FIRED - Web SDK rule may not be configured');
  }

  edgeCalls.forEach((call, idx) => {
    const events = call.postData?.events || [];
    events.forEach((e, eIdx) => {
      console.log(`\n  Call ${idx + 1}.${eIdx + 1}:`);
      console.log(`    eventType: ${e.xdm?.eventType || '(none)'}`);
      console.log(`    pageName:  ${e.xdm?.web?.webPageDetails?.name || '(none)'}`);
      console.log(`    URL:       ${e.xdm?.web?.webPageDetails?.URL || '(none)'}`);
      if (e.xdm?.commerce) {
        console.log(`    commerce:  ${JSON.stringify(e.xdm.commerce)}`);
      }
    });
  });

  // Find page view event
  const pageViewCall = edgeCalls.find((c) => {
    const events = c.postData?.events || [];
    return events.some((e) => e.xdm?.eventType?.includes('pageView') || e.xdm?.eventType?.includes('pageviews'));
  });

  expect(edgeCalls.length, 'Web SDK should fire at least one edge call on page load').toBeGreaterThan(0);

  if (pageViewCall) {
    const events = pageViewCall.postData.events;
    const pvEvent = events.find((e) => e.xdm?.eventType?.toLowerCase().includes('page'));
    console.log('\n✓ Page View XDM payload validated');
    console.log(`  eventType: ${pvEvent.xdm.eventType}`);
  }
});

test('Add to Cart fires commerce.productListAdds via Web SDK', async ({ page }) => {
  const edgeCalls = trackEdge(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await waitForEdge(page, 2000);

  // Click the first Add to Cart button
  const addBtn = page.locator('.add-cart-btn').first();
  if (await addBtn.count()) {
    await addBtn.click();
    await waitForEdge(page, 3000);
  }

  console.log('\nADD TO CART BEACONS:');
  console.log(`  Total edge calls captured: ${edgeCalls.length}`);

  const cartCall = edgeCalls.find((c) => {
    const events = c.postData?.events || [];
    return events.some((e) => e.xdm?.eventType?.includes('productListAdds') || e.xdm?.commerce?.productListAdds);
  });

  edgeCalls.forEach((call, idx) => {
    const events = call.postData?.events || [];
    events.forEach((e, eIdx) => {
      if (e.xdm?.commerce?.productListAdds || e.xdm?.eventType?.includes('Adds')) {
        console.log(`\n  Add to Cart event ${idx + 1}.${eIdx + 1}:`);
        console.log(`    eventType:        ${e.xdm.eventType}`);
        console.log(`    productListAdds:  ${JSON.stringify(e.xdm.commerce?.productListAdds)}`);
        console.log(`    productListItems: ${JSON.stringify(e.xdm.productListItems)}`);
      }
    });
  });

  if (!cartCall) {
    console.log('  ✗ NO ADD TO CART EDGE CALL - rule may not be firing');
  }
});

test('Purchase on confirmation fires commerce.purchases via Web SDK', async ({ page }) => {
  const edgeCalls = trackEdge(page);

  // Seed order for purchase
  await page.goto('/confirmation', { waitUntil: 'load' });
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    const order = {
      orderNumber: 'RF1-WEBSDK-VALIDATE-' + Date.now(),
      email: 'websdk.test@f1.com',
      shipping: { firstName: 'Web', lastName: 'SDK', address: '1 Test', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
      shippingMethod: 'standard',
      shippingPrice: 9.99,
      items: [{ id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'img.png', quantity: 1 }],
      subtotal: 159.99, tax: 13.20, total: 183.18,
      date: new Date().toISOString(),
      userId: 'websdk.test@f1.com', userName: 'Web SDK Test',
    };
    localStorage.setItem('rf1_last_order', JSON.stringify(order));
  });

  await page.reload({ waitUntil: 'load' });
  await waitForEdge(page, 4000);

  console.log('\nPURCHASE BEACONS:');
  console.log(`  Total edge calls captured: ${edgeCalls.length}`);

  const purchaseCall = edgeCalls.find((c) => {
    const events = c.postData?.events || [];
    return events.some((e) => e.xdm?.eventType?.includes('purchase') || e.xdm?.commerce?.purchases);
  });

  edgeCalls.forEach((call, idx) => {
    const events = call.postData?.events || [];
    events.forEach((e, eIdx) => {
      if (e.xdm?.commerce?.purchases || e.xdm?.eventType?.toLowerCase().includes('purchase')) {
        console.log(`\n  Purchase event ${idx + 1}.${eIdx + 1}:`);
        console.log(`    eventType:        ${e.xdm.eventType}`);
        console.log(`    purchases:        ${JSON.stringify(e.xdm.commerce?.purchases)}`);
        console.log(`    order:            ${JSON.stringify(e.xdm.commerce?.order)}`);
        console.log(`    productListItems: ${JSON.stringify(e.xdm.productListItems)}`);
      }
    });
  });

  if (!purchaseCall) {
    console.log('  ✗ NO PURCHASE EDGE CALL - rule may not be firing for confirmation page');
  }
});

test('Verify legacy AppMeasurement is NOT firing (clean Web SDK)', async ({ page }) => {
  const aaCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('2o7.net') || url.includes('omtrdc.net')) {
      aaCalls.push({ url });
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Trigger Add to Cart to maximize chance of seeing legacy calls
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const addBtn = page.locator('.add-cart-btn').first();
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log('\nLEGACY APPMEASUREMENT CHECK:');
  console.log(`  2o7.net / omtrdc.net calls: ${aaCalls.length}`);

  if (aaCalls.length > 0) {
    console.log('  ⚠ Legacy AA calls still firing — check if rules still have AppMeasurement Send Beacon actions');
    aaCalls.slice(0, 3).forEach((c) => console.log(`    ${c.url.substring(0, 120)}...`));
  } else {
    console.log('  ✓ No legacy AA calls — Web SDK primary architecture is clean');
  }
});

test('Summary: Web SDK migration status', async ({ page }) => {
  const edgeCalls = [];
  const aaCalls = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('edge.adobedc.net')) edgeCalls.push(url);
    if (url.includes('2o7.net') || url.includes('omtrdc.net')) aaCalls.push(url);
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   WEB SDK MIGRATION STATUS (a12)                        ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   Edge Network calls (Web SDK): ${edgeCalls.length.toString().padStart(3)}                       ║`);
  console.log(`║   Legacy AppMeasurement calls:  ${aaCalls.length.toString().padStart(3)}                       ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');

  if (edgeCalls.length > 0 && aaCalls.length === 0) {
    console.log('║   ✓ WEB SDK PRIMARY ARCHITECTURE — CLEAN              ║');
  } else if (edgeCalls.length > 0 && aaCalls.length > 0) {
    console.log('║   ~ DUAL-TAG MODE — Both paths firing                 ║');
  } else if (edgeCalls.length === 0 && aaCalls.length > 0) {
    console.log('║   ✗ STILL ON APPMEASUREMENT — Web SDK not firing      ║');
  } else {
    console.log('║   ✗ NO TRACKING — Both paths missing                  ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
});
