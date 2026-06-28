// @ts-check
// Check for duplicate events across:
//   1) window.adobeDataLayer
//   2) Web SDK edge network calls
//   3) Per-event duplicate detection (same event fired multiple times)
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

function fingerprint(e) {
  // Compact signature to identify "the same event"
  return [
    e.eventType,
    e.commerce?.purchases?.value ? 'purchase' : '',
    e.commerce?.productListAdds?.value ? 'add' : '',
    e.commerce?.productViews?.value ? 'view' : '',
    e.commerce?.productListRemovals?.value ? 'remove' : '',
    e.commerce?.checkouts?.value ? 'checkout' : '',
    e.commerce?.order?.purchaseID || '',
    (e.productListItems || []).map(p => p.SKU).join(',')
  ].join('|');
}

test('Duplicate event detection — full site walkthrough', async ({ page }) => {
  const edgeCalls = [];
  const allRequests = [];

  page.on('request', (req) => {
    const url = req.url();
    allRequests.push(url);
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      edgeCalls.push({ url, postData, ts: Date.now() });
    }
  });

  // ──────────────────────────────────────────────
  // 1. Home page load
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 1: Home page load ===');
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  console.log(`  Edge calls so far: ${edgeCalls.length}`);

  // Snapshot adobeDataLayer
  const homeDataLayer = await page.evaluate(() =>
    (window.adobeDataLayer || []).map(e => ({ event: e.event, hasAttrs: !!e.attributes }))
  );
  console.log(`  adobeDataLayer entries: ${homeDataLayer.length}`);
  console.log(`  Events: ${homeDataLayer.map(e => e.event).filter(Boolean).join(', ')}`);

  // ──────────────────────────────────────────────
  // 2. Navigate merchandise
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 2: Navigate to /merchandise ===');
  const beforeNav = edgeCalls.length;
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  console.log(`  New edge calls from navigation: ${edgeCalls.length - beforeNav}`);

  // ──────────────────────────────────────────────
  // 3. Click Add to Cart ONCE
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 3: Click Add to Cart ONCE ===');
  const beforeClick = edgeCalls.length;
  const btn = page.locator('.add-cart-btn').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(4000);
  }
  const newCalls = edgeCalls.slice(beforeClick);
  console.log(`  New edge calls from 1 click: ${newCalls.length}`);

  const addToCartCalls = newCalls.filter(c =>
    (c.postData?.events || []).some(e => e.xdm?.commerce?.productListAdds)
  );
  console.log(`  Add to Cart commerce calls: ${addToCartCalls.length}`);

  if (addToCartCalls.length > 1) {
    console.log(`  ⚠️  DUPLICATE — 1 click fired ${addToCartCalls.length} productListAdds calls`);
  } else if (addToCartCalls.length === 1) {
    console.log(`  ✓ Single Add to Cart event fired (no duplicate)`);
  }

  // ──────────────────────────────────────────────
  // 4. Push 'Product viewed' manually ONCE
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 4: Push Product viewed ONCE manually ===');
  const beforePush = edgeCalls.length;
  await page.evaluate(() => {
    window.adobeDataLayer.push({
      event: 'Product viewed',
      attributes: { product_id: 'DUP-TEST', product_name: 'Dup Test', product_price: 99.99, product_category: 'Test' }
    });
  });
  await page.waitForTimeout(3000);
  const productViewCalls = edgeCalls.slice(beforePush).filter(c =>
    (c.postData?.events || []).some(e => e.xdm?.commerce?.productViews)
  );
  console.log(`  Product View commerce calls: ${productViewCalls.length}`);
  if (productViewCalls.length > 1) {
    console.log(`  ⚠️  DUPLICATE — 1 manual push fired ${productViewCalls.length} productViews calls`);
  } else if (productViewCalls.length === 1) {
    console.log(`  ✓ Single Product View event fired (no duplicate)`);
  }

  // ──────────────────────────────────────────────
  // 5. Full adobeDataLayer audit
  // ──────────────────────────────────────────────
  const dlAudit = await page.evaluate(() => {
    const dl = window.adobeDataLayer || [];
    const allEvents = dl.filter(e => e.event).map(e => ({
      event: e.event,
      transaction_id: e.attributes?.transaction_id,
      product_id: e.attributes?.product_id
    }));
    return { totalDl: dl.length, eventEntries: allEvents };
  });
  console.log('\n=== STEP 5: adobeDataLayer audit ===');
  console.log(`  Total dataLayer entries: ${dlAudit.totalDl}`);
  console.log(`  Event entries (with .event): ${dlAudit.eventEntries.length}`);

  // Find duplicates in datalayer
  const dlFingerprints = {};
  dlAudit.eventEntries.forEach(e => {
    const fp = `${e.event}|${e.transaction_id || ''}|${e.product_id || ''}`;
    dlFingerprints[fp] = (dlFingerprints[fp] || 0) + 1;
  });
  const dlDupes = Object.entries(dlFingerprints).filter(([,c]) => c > 1);
  if (dlDupes.length > 0) {
    console.log(`  ⚠️  DUPLICATES in adobeDataLayer:`);
    dlDupes.forEach(([fp, c]) => console.log(`     "${fp}" pushed ${c} times`));
  } else {
    console.log(`  ✓ No duplicates in adobeDataLayer`);
  }

  // ──────────────────────────────────────────────
  // 6. Full Web SDK network audit
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 6: Web SDK network calls audit ===');
  console.log(`  Total Web SDK edge calls: ${edgeCalls.length}`);

  const allEvents = [];
  edgeCalls.forEach((c, ci) => {
    (c.postData?.events || []).forEach((e, ei) => {
      allEvents.push({
        callIdx: ci,
        eventIdx: ei,
        ts: c.ts,
        xdm: e.xdm || {}
      });
    });
  });
  console.log(`  Total event objects across calls: ${allEvents.length}`);

  // Find duplicates by fingerprint
  const xdmFingerprints = {};
  allEvents.forEach(e => {
    const fp = fingerprint(e.xdm);
    if (!xdmFingerprints[fp]) xdmFingerprints[fp] = [];
    xdmFingerprints[fp].push(e);
  });

  const xdmDupes = Object.entries(xdmFingerprints).filter(([,arr]) => arr.length > 1);
  if (xdmDupes.length > 0) {
    console.log(`  ⚠️  DUPLICATES in Web SDK network calls:`);
    xdmDupes.forEach(([fp, arr]) => {
      console.log(`     ${arr.length}x: ${fp.substring(0, 80)}`);
      arr.forEach(e => console.log(`        ts=${e.ts} eventType=${e.xdm.eventType}`));
    });
  } else {
    console.log(`  ✓ No duplicate Web SDK calls`);
  }

  // ──────────────────────────────────────────────
  // 7. Breakdown by eventType
  // ──────────────────────────────────────────────
  console.log('\n=== STEP 7: Event type breakdown ===');
  const typeCount = {};
  allEvents.forEach(e => {
    const t = e.xdm.eventType || 'unknown';
    typeCount[t] = (typeCount[t] || 0) + 1;
  });
  Object.entries(typeCount).forEach(([t, c]) => {
    console.log(`  ${t.padEnd(45)} ${c}`);
  });

  // ──────────────────────────────────────────────
  // 8. Final verdict
  // ──────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   DUPLICATE DETECTION SUMMARY                                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║   Total Web SDK calls:          ${String(edgeCalls.length).padEnd(28)}║`);
  console.log(`║   Total events sent:            ${String(allEvents.length).padEnd(28)}║`);
  console.log(`║   adobeDataLayer entries:       ${String(dlAudit.totalDl).padEnd(28)}║`);
  console.log(`║   adobeDataLayer duplicates:    ${String(dlDupes.length).padEnd(28)}║`);
  console.log(`║   Web SDK call duplicates:      ${String(xdmDupes.length).padEnd(28)}║`);
  console.log(`║   1 click → calls:              ${String(addToCartCalls.length).padEnd(28)}║`);
  console.log(`║   1 manual push → calls:        ${String(productViewCalls.length).padEnd(28)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (xdmDupes.length === 0 && dlDupes.length === 0 && addToCartCalls.length <= 1 && productViewCalls.length <= 1) {
    console.log('\n  ✓ NO DUPLICATES DETECTED');
  } else {
    console.log('\n  ⚠️  DUPLICATES FOUND — review details above');
  }
});
