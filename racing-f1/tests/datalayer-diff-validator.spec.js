// @ts-check
/**
 * Datalayer Expected vs Actual Diff Validator
 * ============================================
 * For each event, defines EXPECTED datalayer parameters, reads ACTUAL
 * values from gridboxLayer + adobeDataLayer + XDM beacons, and shows
 * a side-by-side PASS/FAIL diff per parameter.
 *
 * Events covered:
 *   1. Homepage  — page.pageInfo (pageName, pageID, pageType, language)
 *   2. Add to Cart — ACDL attributes (SKU, name, price, qty, currency)
 *                    + XDM productListItems fields
 *                    + gridboxLayer.cart state after add
 *
 * Run:
 *   npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium --headed
 * Debug:
 *   npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium --debug
 * Replay:
 *   npx playwright show-report
 */
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED datalayer values — single source of truth
// ─────────────────────────────────────────────────────────────────────────────

const EXPECTED = {

  homepage: {
    // gridboxLayer.page — verified from actual site
    'page.pageInfo.pageID':   'HOME',
    'page.pageInfo.pageName': 'Racing F1 - Premium Motorsport Shop',
    'page.category.pageType': 'home',
    // ACDL PageView push attributes
    'acdl.event':                   'PageView',
    'acdl.page_name':               'Racing F1 - Premium Motorsport Shop',
    'acdl.page_type':               'home',
    'acdl.page_url':                'https://racing-f1-rho.vercel.app/',
    'acdl.page_path':               '/',
    'acdl.device_type':             'desktop',
    // XDM beacon (Adobe Edge Network)
    'xdm.eventType':                          'web.webpagedetails.pageViews',
    'xdm.web.webPageDetails.pageViews.value': 1,
    'xdm.web.webPageDetails.URL':             'present',
  },

  productViewed: {
    // ACDL push — event "Product viewed" (exact case from site)
    'acdl.event':             'Product viewed',
    'acdl.product_id':        'RB-JKT-2024',
    'acdl.product_name':      '2024 Team Jacket',
    'acdl.product_price':     '159.99',
    'acdl.product_brand':     'Red Bull Racing',
    'acdl.product_category':  'Apparel',
    // XDM beacon
    'xdm.eventType':                     'commerce.productViews',
    'xdm.commerce.productViews.value':   1,
    'xdm.productListItems[0].SKU':       'RB-JKT-2024',
    'xdm.productListItems[0].priceTotal': 159.99,
  },

  addToCart: {
    // ACDL push — event "Add to cart" (exact case from site)
    'acdl.event':             'Add to cart',
    'acdl.product_id':        'RB-JKT-2024',
    'acdl.product_name':      '2024 Team Jacket',
    'acdl.product_price':     '159.99',
    'acdl.product_category':  'Apparel',
    'acdl.product_quantity':  '1',
    'acdl.cart_total':        '159.99',
    'acdl.item_count':        '1',
    'acdl.currency':          'USD',
    // XDM beacon (Adobe Edge Network)
    'xdm.eventType':                            'commerce.productListAdds',
    'xdm.commerce.productListAdds.value':       1,
    'xdm.productListItems[0].SKU':              'RB-JKT-2024',
    'xdm.productListItems[0].name':             '2024 Team Jacket',
    'xdm.productListItems[0].priceTotal':       159.99,
    'xdm.productListItems[0].quantity':         1,
    'xdm.productListItems[0].currencyCode':     'USD',
    // gridboxLayer.cart after add
    'cart.item[0].productInfo.productID':       'RB-JKT-2024',
    'cart.item[0].quantity':                    1,
    'cart.price.totalPrice.amount':             '≥ 159.99',
    'cart.cartInfo.cartID':                     'present',
    // gridboxLayer.product[0]
    'product[0].productInfo.productID':         'RB-JKT-2024',
    'product[0].productInfo.brand':             'Red Bull Racing',
    'product[0].category.primaryCategory':      'Apparel',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Edge beacon capture
// ─────────────────────────────────────────────────────────────────────────────

function captureEdge(page) {
  const calls = [];
  page.on('request', req => {
    const url = req.url();
    const isEdge =
      /\.data\.adobedc\.net\/ee\//.test(url) ||
      /edge\.adobedc\.net\/ee\//.test(url) ||
      /demdex\.net\/ee\//.test(url) ||
      /adobedc\.net\/ee\//.test(url);
    if (!isEdge) return;
    let postData = null;
    try { postData = req.postDataJSON(); } catch (_) {}
    calls.push({ postData, ts: Date.now() });
  });
  return calls;
}

function getXdm(calls, since = 0) {
  return calls
    .filter(c => c.ts >= since)
    .flatMap(c => (c.postData?.events || []).map(e => e.xdm || {}));
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff printer — shows EXPECTED vs ACTUAL per parameter
// ─────────────────────────────────────────────────────────────────────────────

function diff(label, expected, actual) {
  let pass;
  if (expected === 'present') {
    pass = actual !== undefined && actual !== null && actual !== '';
  } else if (typeof expected === 'string' && expected.startsWith('≥')) {
    pass = Number(actual) >= Number(expected.slice(1).trim());
  } else {
    pass = String(actual) === String(expected);
  }

  const icon   = pass ? '✓' : '✗';
  const expStr = String(expected).slice(0, 50).padEnd(52);
  const actStr = pass ? String(actual).slice(0, 50) : `\x1b[31m${String(actual).slice(0, 50)}\x1b[0m`;
  console.log(`  ${icon}  ${label.padEnd(48)} │ expected: ${expStr} │ actual: ${actStr}`);
  return pass;
}

function section(title) {
  console.log(`\n  ${'─'.repeat(120)}`);
  console.log(`  ${title}`);
  console.log(`  ${'─'.repeat(120)}`);
  console.log(`  ${'Parameter'.padEnd(50)} │ ${'Expected'.padEnd(54)} │ Actual`);
  console.log(`  ${'─'.repeat(120)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read gridboxLayer state from page
// ─────────────────────────────────────────────────────────────────────────────

function readGridbox(page) {
  return page.evaluate(() => {
    const gl = window.gridboxLayer;
    if (!gl) return null;
    return {
      page: gl.page,
      cart: gl.cart,
      product: gl.product,
      user: gl.user,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Spy on adobeDataLayer.push
// ─────────────────────────────────────────────────────────────────────────────

async function spyAcdl(page) {
  await page.addInitScript(() => {
    window.__acdlPushes = [];
    window.adobeDataLayer = window.adobeDataLayer || [];
    const orig = Array.prototype.push.bind(window.adobeDataLayer);
    window.adobeDataLayer.push = function (...args) {
      args.forEach(a => { if (a && a.event) window.__acdlPushes.push(JSON.parse(JSON.stringify(a))); });
      return orig(...args);
    };
  });
}

async function getAcdlPushes(page) {
  return page.evaluate(() => window.__acdlPushes || []);
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST 1 — Homepage datalayer validation
// ═════════════════════════════════════════════════════════════════════════════

test('Homepage — expected vs actual datalayer parameters', async ({ page }) => {
  await spyAcdl(page);
  const edgeCalls = captureEdge(page);

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  const gl  = await readGridbox(page);
  // Use all captured beacons — Edge call fires during navigation, filter from 0
  const xdm = getXdm(edgeCalls, 0);
  const pageViewXdm = xdm.find(e => e.eventType === 'web.webpagedetails.pageViews') || {};
  console.log(`\n  Edge calls captured: ${edgeCalls.length}`);
  console.log(`  XDM events: ${xdm.length}`);
  xdm.forEach(e => console.log(`    → "${e.eventType}"`));

  // Read ACDL directly from the array (not spy) to ensure we get all events
  const acdlAll = await page.evaluate(() =>
    (window.adobeDataLayer || []).filter(x => x && x.event).map(x => ({ event: x.event, attributes: x.attributes || {} }))
  );
  const pageViewAcdl = acdlAll.find(p => p.event === 'PageView') || {};
  const pvAttrs = pageViewAcdl.attributes || {};

  const EXP = EXPECTED.homepage;
  const results = [];

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   HOMEPAGE — DATALAYER EXPECTED vs ACTUAL                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // ── gridboxLayer.page ─────────────────────────────────────────────────────
  section('gridboxLayer.page — Page Identity Parameters');

  results.push(diff('page.pageInfo.pageID',
    EXP['page.pageInfo.pageID'],
    gl?.page?.pageInfo?.pageID
  ));
  results.push(diff('page.pageInfo.pageName',
    EXP['page.pageInfo.pageName'],
    gl?.page?.pageInfo?.pageName
  ));
  results.push(diff('page.category.pageType',
    EXP['page.category.pageType'],
    gl?.page?.category?.pageType
  ));

  // ── ACDL PageView push ────────────────────────────────────────────────────
  section('ACDL push — "PageView" attributes (adobeDataLayer)');

  results.push(diff('acdl.event',       EXP['acdl.event'],       pageViewAcdl.event));
  results.push(diff('acdl.page_name',   EXP['acdl.page_name'],   pvAttrs.page_name));
  results.push(diff('acdl.page_type',   EXP['acdl.page_type'],   pvAttrs.page_type));
  results.push(diff('acdl.page_url',    EXP['acdl.page_url'],    pvAttrs.page_url));
  results.push(diff('acdl.page_path',   EXP['acdl.page_path'],   pvAttrs.page_path));
  results.push(diff('acdl.device_type', EXP['acdl.device_type'], pvAttrs.device_type));

  // ── XDM beacon ────────────────────────────────────────────────────────────
  section('Adobe Edge XDM Beacon — pageViews event');

  results.push(diff('xdm.eventType',
    EXP['xdm.eventType'],
    pageViewXdm.eventType
  ));
  results.push(diff('xdm.web.webPageDetails.URL',
    'present',
    pageViewXdm.web?.webPageDetails?.URL
  ));
  results.push(diff('xdm.web.webPageDetails.pageViews.value',
    EXP['xdm.web.webPageDetails.pageViews.value'],
    pageViewXdm.web?.webPageDetails?.pageViews?.value
  ));

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(Boolean).length;
  const total  = results.length;
  console.log(`\n  Result: ${passed}/${total} parameters matched`);

  await page.screenshot({ path: 'test-results/diff-homepage.png' });
  expect(passed, `Homepage: ${total - passed} parameter(s) mismatched`).toBe(total);
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 2 — Add to Cart datalayer validation
// ═════════════════════════════════════════════════════════════════════════════

test('Add to Cart — expected vs actual datalayer parameters', async ({ page }) => {
  await spyAcdl(page);
  const edgeCalls = captureEdge(page);

  // Navigate to merchandise and click first "Add to Cart"
  const t0 = Date.now();
  await page.goto('/merchandise', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const addBtn = page.locator('button:has-text("Add to Cart"), .add-cart-btn').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 });

  const tClick = Date.now();
  await addBtn.click();
  await page.waitForTimeout(4000);

  // Read ALL ACDL events directly from window.adobeDataLayer array (not just spy pushes)
  const acdlAll = await page.evaluate(() =>
    (window.adobeDataLayer || []).filter(x => x && x.event).map(x => ({ event: x.event, attributes: x.attributes || {} }))
  );
  const gl      = await readGridbox(page);
  const xdmAll  = getXdm(edgeCalls, tClick);

  // exact event names as observed from inspector
  const addToCartAcdl  = acdlAll.find(p => p.event === 'Add to cart');
  const prodViewedAcdl = acdlAll.find(p => p.event === 'Product viewed');
  const atcXdm  = xdmAll.find(e => e.eventType === 'commerce.productListAdds') || {};
  const pvXdm   = xdmAll.find(e => e.eventType === 'commerce.productViews')    || {};
  const atcItem = atcXdm.productListItems?.[0] || {};
  const pvItem  = pvXdm.productListItems?.[0]  || {};
  const cartItem = gl?.cart?.item?.[0] || {};

  const EXP_ATC = EXPECTED.addToCart;
  const EXP_PV  = EXPECTED.productViewed;
  const results  = [];

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   ADD TO CART — DATALAYER EXPECTED vs ACTUAL                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  console.log(`\n  ACDL events in adobeDataLayer: ${acdlAll.length}`);
  acdlAll.forEach(p => console.log(`    → "${p.event}"`));
  console.log(`  XDM events after click: ${xdmAll.length}`);
  xdmAll.forEach(e => console.log(`    → "${e.eventType}"`));

  // ── ACDL: Product viewed push ─────────────────────────────────────────────
  section('ACDL push — "Product viewed" attributes (adobeDataLayer)');

  const pvAttrs = prodViewedAcdl?.attributes || {};
  results.push(diff('acdl.event',           EXP_PV['acdl.event'],          prodViewedAcdl?.event));
  results.push(diff('acdl.product_id',      EXP_PV['acdl.product_id'],     pvAttrs.product_id));
  results.push(diff('acdl.product_name',    EXP_PV['acdl.product_name'],   pvAttrs.product_name));
  results.push(diff('acdl.product_price',   EXP_PV['acdl.product_price'],  pvAttrs.product_price));
  results.push(diff('acdl.product_brand',   EXP_PV['acdl.product_brand'],  pvAttrs.product_brand));
  results.push(diff('acdl.product_category',EXP_PV['acdl.product_category'],pvAttrs.product_category));

  // ── ACDL: Add to cart push ────────────────────────────────────────────────
  section('ACDL push — "Add to cart" attributes (adobeDataLayer)');

  const atcAttrs = addToCartAcdl?.attributes || {};
  results.push(diff('acdl.event',           EXP_ATC['acdl.event'],          addToCartAcdl?.event));
  results.push(diff('acdl.product_id',      EXP_ATC['acdl.product_id'],     atcAttrs.product_id));
  results.push(diff('acdl.product_name',    EXP_ATC['acdl.product_name'],   atcAttrs.product_name));
  results.push(diff('acdl.product_price',   EXP_ATC['acdl.product_price'],  atcAttrs.product_price));
  results.push(diff('acdl.product_category',EXP_ATC['acdl.product_category'],atcAttrs.product_category));
  results.push(diff('acdl.product_quantity',EXP_ATC['acdl.product_quantity'],atcAttrs.product_quantity));
  results.push(diff('acdl.cart_total',      EXP_ATC['acdl.cart_total'],     atcAttrs.cart_total));
  results.push(diff('acdl.item_count',      EXP_ATC['acdl.item_count'],     atcAttrs.item_count));
  results.push(diff('acdl.currency',        EXP_ATC['acdl.currency'],       atcAttrs.currency));

  // ── XDM: Product Viewed beacon ────────────────────────────────────────────
  section('Adobe Edge XDM — commerce.productViews beacon');

  results.push(diff('xdm.eventType',                      EXP_PV['xdm.eventType'],                    pvXdm.eventType));
  results.push(diff('xdm.commerce.productViews.value',    EXP_PV['xdm.commerce.productViews.value'],  pvXdm.commerce?.productViews?.value));
  results.push(diff('xdm.productListItems[0].SKU',        EXP_PV['xdm.productListItems[0].SKU'],      pvItem.SKU));
  results.push(diff('xdm.productListItems[0].priceTotal', EXP_PV['xdm.productListItems[0].priceTotal'], pvItem.priceTotal));

  // ── XDM: Add to Cart beacon ───────────────────────────────────────────────
  section('Adobe Edge XDM — commerce.productListAdds beacon');

  results.push(diff('xdm.eventType',                        EXP_ATC['xdm.eventType'],                        atcXdm.eventType));
  results.push(diff('xdm.commerce.productListAdds.value',   EXP_ATC['xdm.commerce.productListAdds.value'],   atcXdm.commerce?.productListAdds?.value));
  results.push(diff('xdm.productListItems[0].SKU',          EXP_ATC['xdm.productListItems[0].SKU'],          atcItem.SKU));
  results.push(diff('xdm.productListItems[0].name',         EXP_ATC['xdm.productListItems[0].name'],         atcItem.name));
  results.push(diff('xdm.productListItems[0].priceTotal',   EXP_ATC['xdm.productListItems[0].priceTotal'],   atcItem.priceTotal));
  results.push(diff('xdm.productListItems[0].quantity',     EXP_ATC['xdm.productListItems[0].quantity'],     atcItem.quantity));
  results.push(diff('xdm.productListItems[0].currencyCode', EXP_ATC['xdm.productListItems[0].currencyCode'], atcItem.currencyCode));

  // ── gridboxLayer.cart state ───────────────────────────────────────────────
  section('gridboxLayer.cart — cart state after "Add to Cart"');

  results.push(diff('cart.item[0].productInfo.productID',
    EXP_ATC['cart.item[0].productInfo.productID'],
    cartItem.productInfo?.productID
  ));
  results.push(diff('cart.item[0].productInfo.quantity',
    EXP_ATC['cart.item[0].quantity'],
    cartItem.productInfo?.quantity
  ));
  results.push(diff('cart.price.totalPrice.amount',
    EXP_ATC['cart.price.totalPrice.amount'],
    gl?.cart?.price?.totalPrice?.amount
  ));
  results.push(diff('cart.cartInfo.cartID',
    EXP_ATC['cart.cartInfo.cartID'],
    gl?.cart?.cartInfo?.cartID
  ));

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(Boolean).length;
  const total  = results.length;
  const failed = results.filter((r, i) => !r).length;

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   ADD TO CART — DIFF SUMMARY                                         ║');
  console.log(`║   ${passed}/${total} parameters matched   ${failed > 0 ? failed + ' MISMATCH(ES)' : 'ALL PASS'}`.padEnd(73) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  await page.screenshot({ path: 'test-results/diff-add-to-cart.png' });
  expect(passed, `Add to Cart: ${failed} parameter(s) mismatched — see diff above`).toBe(total);
});
