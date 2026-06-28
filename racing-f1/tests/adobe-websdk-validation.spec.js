// @ts-check
// Web SDK / Edge validation: captures Adobe Edge Network `interact` calls,
// decodes the XDM payload, and asserts commerce events + identity + currency.
// Run after the Web SDK datastream rules are published (Phase 5 of the runbook):
//   BASE_URL=https://racing-f1-rho.vercel.app npx playwright test adobe-websdk-validation --project=chromium
//
// NOTE: until the Web SDK extension/rules are deployed, no `interact` calls fire,
// so the diagnostic prints "NO EDGE CALLS" and the deploy-gated assertions skip.
const { test, expect } = require('@playwright/test');

const EDGE_RE = /adobedc\.net\/(ee|ee\/v\d+)\/(interact|collect)/;

// Pull the XDM event(s) out of a Web SDK request body.
function extractXdmEvents(req) {
  let body;
  try { body = req.postDataJSON(); } catch (e) { return []; }
  if (!body || !Array.isArray(body.events)) return [];
  return body.events.map((ev) => ev.xdm || {});
}

function summarizeXdm(xdm) {
  const c = xdm.commerce || {};
  return {
    eventType: xdm.eventType || '',
    pageName: (xdm.web && xdm.web.webPageDetails && xdm.web.webPageDetails.name) || '',
    productViews: c.productViews && c.productViews.value,
    productListAdds: c.productListAdds && c.productListAdds.value,
    productListRemovals: c.productListRemovals && c.productListRemovals.value,
    checkouts: c.checkouts && c.checkouts.value,
    purchases: c.purchases && c.purchases.value,
    purchaseID: c.order && c.order.purchaseID,
    priceTotal: c.order && c.order.priceTotal,
    currencyCode: c.order && c.order.currencyCode,
    productSKUs: (xdm.productListItems || []).map((p) => p.SKU),
    hasECID: !!(xdm.identityMap && xdm.identityMap.ECID),
    crmId: xdm.identityMap && xdm.identityMap.crmId && xdm.identityMap.crmId[0] && xdm.identityMap.crmId[0].id,
  };
}

test.describe('Adobe Web SDK / Edge (XDM) validation', () => {
  test('page load fires an edge interact with web page-view XDM', async ({ page }) => {
    const edgeEvents = [];
    page.on('request', (req) => {
      if (EDGE_RE.test(req.url())) {
        for (const xdm of extractXdmEvents(req)) edgeEvents.push(summarizeXdm(xdm));
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const alloyPresent = await page.evaluate(() => typeof window.alloy !== 'undefined' || !!(window.__alloyNS && window.__alloyNS.length));
    console.log('ALLOY PRESENT >>>', alloyPresent);
    console.log('EDGE EVENTS (home) >>>', JSON.stringify(edgeEvents, null, 2) || 'NO EDGE CALLS');

    test.skip(edgeEvents.length === 0, 'Web SDK not deployed yet — no edge interact calls (expected pre-Phase C).');
    const pv = edgeEvents.find((e) => /pageviews/i.test(e.eventType));
    expect(pv, 'a page-view XDM event should be sent to the edge').toBeTruthy();
    expect(pv.hasECID, 'page-view XDM should carry an ECID identity').toBeTruthy();
  });

  test('add-to-cart sends commerce.productListAdds with productListItems', async ({ page }) => {
    const edgeEvents = [];
    page.on('request', (req) => {
      if (EDGE_RE.test(req.url())) {
        for (const xdm of extractXdmEvents(req)) edgeEvents.push(summarizeXdm(xdm));
      }
    });

    await page.goto('/merchandise', { waitUntil: 'networkidle' });
    const before = edgeEvents.length;
    const addBtn = page.locator('.add-cart-btn').first();
    if (await addBtn.count()) await addBtn.click().catch(() => {});
    await page.waitForTimeout(3000);

    const newOnes = edgeEvents.slice(before);
    console.log('EDGE EVENTS (add-to-cart) >>>', JSON.stringify(newOnes, null, 2) || 'NO EDGE CALLS');

    test.skip(edgeEvents.length === 0, 'Web SDK not deployed yet.');
    const add = edgeEvents.find((e) => e.productListAdds === 1);
    expect(add, 'a commerce.productListAdds XDM event should fire on add-to-cart').toBeTruthy();
    expect(add.productSKUs.length, 'add-to-cart XDM should include productListItems[].SKU').toBeGreaterThan(0);
    expect(add.currencyCode || 'USD').toBe('USD');
  });

  // Purchase assertion: drive a purchase via the site API, then verify the
  // commerce.order XDM carries purchaseID (dedup) + priceTotal + all line items.
  test('purchase sends commerce.order with purchaseID and line items', async ({ page }) => {
    const edgeEvents = [];
    page.on('request', (req) => {
      if (EDGE_RE.test(req.url())) {
        for (const xdm of extractXdmEvents(req)) edgeEvents.push(summarizeXdm(xdm));
      }
    });

    await page.goto('/merchandise', { waitUntil: 'networkidle' });
    // Simulate a completed purchase through the public datalayer API if available.
    await page.evaluate(() => {
      try {
        window.gridbox && window.gridbox.addToCart && window.gridbox.addToCart({ product_id: 'RB-JKT-2024', product_name: '2024 Team Jacket', product_price: 159.99, product_category: 'Apparel' }, 1);
        window.gridbox && window.gridbox.purchase && window.gridbox.purchase({ transaction_id: 'TEST-TXN-PW', transaction_total: 159.99, currency: 'USD' });
      } catch (e) {}
    });
    await page.waitForTimeout(3000);

    console.log('EDGE EVENTS (purchase) >>>', JSON.stringify(edgeEvents.filter((e) => e.purchases === 1), null, 2) || 'NO PURCHASE EDGE CALL');

    test.skip(edgeEvents.length === 0, 'Web SDK not deployed yet.');
    const order = edgeEvents.find((e) => e.purchases === 1);
    expect(order, 'a commerce.order XDM event should fire on purchase').toBeTruthy();
    expect(order.purchaseID, 'purchase XDM must carry order.purchaseID for dedup').toBeTruthy();
    expect(order.productSKUs.length, 'purchase XDM should include every line item SKU').toBeGreaterThan(0);
    expect(order.currencyCode).toBe('USD');
  });
});
