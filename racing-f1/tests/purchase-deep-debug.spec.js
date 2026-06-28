// @ts-check
// Deep debug — what's actually being pushed on confirmation and what's fired
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

test('Debug — capture EVERYTHING on confirmation purchase', async ({ page }) => {
  const allEdgeCalls = [];
  const consoleLogs = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('adobedc.net/ee/') || url.includes('demdex.net/ee/')) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      allEdgeCalls.push({ url, postData, ts: Date.now() });
    }
  });

  page.on('console', (msg) => {
    if (msg.text().toLowerCase().includes('alloy') || msg.text().toLowerCase().includes('error')) {
      consoleLogs.push({ type: msg.type(), text: msg.text().substring(0, 300) });
    }
  });

  // Step 1: Navigate to confirmation page
  await page.goto('/confirmation', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Step 2: Capture initial state
  const initialState = await page.evaluate(() => ({
    initialDataLayer: (window.adobeDataLayer || []).map(e => ({ event: e.event, hasAttrs: !!e.attributes })),
    hasGridbox: typeof window.gridbox,
    hasGridboxPurchase: typeof window.gridbox?.purchase,
  }));
  console.log('\n=== INITIAL STATE ===');
  console.log(JSON.stringify(initialState, null, 2));

  // Step 3: Seed order and reload to trigger Purchase
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify({
      orderNumber: 'RF1-DEBUG-' + Date.now(),
      email: 'debug@test.com',
      shipping: { firstName: 'Debug', lastName: 'Test', address: '1', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
      shippingMethod: 'standard', shippingPrice: 9.99,
      items: [{ id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'img.png', quantity: 1 }],
      subtotal: 159.99, tax: 13.20, total: 183.18,
      date: new Date().toISOString(),
      userId: 'debug@test.com', userName: 'Debug Test',
    }));
  });

  console.log('\n=== Order seeded, reloading page ===\n');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Step 4: Capture what's in the datalayer NOW
  const afterReload = await page.evaluate(() => {
    const dl = window.adobeDataLayer || [];
    return {
      totalEvents: dl.length,
      allEventNames: dl.map(e => e.event).filter(Boolean),
      purchaseEvents: dl.filter(e => /purchase/i.test(e.event || '')).map(e => ({
        event: e.event,
        attributes: Object.keys(e.attributes || {}),
        hasTransaction: !!e.attributes?.transaction_id,
        transactionId: e.attributes?.transaction_id
      }))
    };
  });
  console.log('=== AFTER RELOAD - DATA LAYER STATE ===');
  console.log(JSON.stringify(afterReload, null, 2));

  // Step 5: Network analysis
  console.log('\n=== ALL WEB SDK CALLS ===');
  console.log(`Total: ${allEdgeCalls.length}`);
  allEdgeCalls.forEach((c, i) => {
    const events = c.postData?.events || [];
    events.forEach((e, ei) => {
      console.log(`\n  Call ${i+1}.${ei+1}:`);
      console.log(`    eventType: ${e.xdm?.eventType}`);
      if (e.xdm?.commerce) console.log(`    commerce: ${JSON.stringify(e.xdm.commerce).substring(0, 200)}`);
      if (e.xdm?.web?.webInteraction) console.log(`    webInteraction: ${JSON.stringify(e.xdm.web.webInteraction)}`);
    });
  });

  // Step 6: Console errors/alloy logs
  console.log('\n=== CONSOLE LOGS (alloy/errors) ===');
  console.log(`Total: ${consoleLogs.length}`);
  consoleLogs.forEach((c, i) => {
    if (c.text.includes('alloy') || c.text.includes('error')) {
      console.log(`  ${i+1}. [${c.type}] ${c.text.substring(0, 200)}`);
    }
  });

  // Step 7: Manual push - try BOTH "Purchase" AND "Purchase completed"
  console.log('\n=== MANUAL TEST - Pushing both Purchase event variants ===');

  const beforeCount = allEdgeCalls.length;

  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Purchase',
      attributes: {
        transaction_id: 'MANUAL-PURCHASE-' + Date.now(),
        transaction_total: 100,
        currency: 'USD',
        item_count: 1,
        item_0_id: 'MANUAL-TEST',
        item_0_name: 'Manual Test',
        item_0_qty: 1,
        item_0_price: 100
      }
    });
  });
  await page.waitForTimeout(3000);
  const afterPurchaseCount = allEdgeCalls.length;
  console.log(`  After "Purchase" push: ${afterPurchaseCount - beforeCount} new calls`);

  await page.evaluate(() => {
    window.adobeDataLayer.push({
      event: 'Purchase completed',
      attributes: {
        transaction_id: 'MANUAL-COMPLETED-' + Date.now(),
        transaction_total: 200,
        currency: 'USD',
        item_count: 1,
        item_0_id: 'MANUAL-COMPLETED',
        item_0_name: 'Completed Test',
        item_0_qty: 1,
        item_0_price: 200
      }
    });
  });
  await page.waitForTimeout(3000);
  const afterCompletedCount = allEdgeCalls.length;
  console.log(`  After "Purchase completed" push: ${afterCompletedCount - afterPurchaseCount} new calls`);

  // Final check
  const purchaseXdms = [];
  allEdgeCalls.forEach(c => {
    (c.postData?.events || []).forEach(e => {
      if (e.xdm?.commerce?.purchases || e.xdm?.eventType?.includes('purchases')) {
        purchaseXdms.push({
          eventType: e.xdm.eventType,
          purchaseID: e.xdm.commerce?.order?.purchaseID,
          priceTotal: e.xdm.commerce?.order?.priceTotal
        });
      }
    });
  });
  console.log(`\n=== PURCHASE XDMs CAPTURED ===`);
  console.log(`Total: ${purchaseXdms.length}`);
  purchaseXdms.forEach((p, i) => {
    console.log(`  ${i+1}. ${JSON.stringify(p)}`);
  });

  console.log('\n=== DIAGNOSIS ===');
  if (purchaseXdms.length === 0) {
    console.log('  ✗ NO commerce.purchases events fired');
    console.log('  → Purchase rule still not matching event names');
    const purchaseEventsInDL = afterReload.purchaseEvents.map(e => e.event);
    if (purchaseEventsInDL.length > 0) {
      console.log('  → Data layer events with "purchase": ' + JSON.stringify(purchaseEventsInDL));
    }
  } else {
    console.log('  ✓ commerce.purchases WORKING!');
  }
});
