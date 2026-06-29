// @ts-check
/**
 * FULL-FUNNEL CROSS-STREAM VALIDATOR
 * ==================================
 * Drives ONE product through the entire funnel (ProductView → AddToCart → BeginCheckout →
 * Purchase) on a real page, captures all four streams at each step, compares parameter values
 * across streams, and writes a timestamped Excel + JSON report.
 *
 * Streams captured per step
 *   GridBox  — window.gridboxLayer.event[]      (SOURCE OF TRUTH — expected values come from here)
 *   Adobe    — window.adobeDataLayer            (ACDL chokepoint, fed by analytics.js)
 *   GTM      — window.dataLayer                 (GTM → GA4 tag)
 *   GA4 net  — /g/collect requests              (the actual network hit)
 *   Adobe net— edge.adobedc.net/ee, omtrdc      (the actual network hit)
 *
 * Output
 *   validation-reports/<YYYY-MM-DD_HH-mm-ss>/
 *     ├── cross-stream-report.xlsx   (Summary | Events | Parameters | GA4 Network | Adobe Network)
 *     └── cross-stream-report.json   (same data, machine-readable)
 *
 * Run
 *   BASE_URL=http://localhost:3000 npx playwright test tests/full-funnel-validator.spec.js --project=chromium
 *
 * Debug / replay
 *   npx playwright test --ui                                            # UI mode (live debug)
 *   npx playwright show-trace test-results/<...>/trace.zip              # trace replay
 *   PWDEBUG=1 npx playwright test tests/full-funnel-validator.spec.js   # inspector
 */
const { test, expect } = require('@playwright/test');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// ── network matchers ────────────────────────────────────────────────────────────────────────
const isGA4 = (u) => /google-analytics\.com\/(g|j)\/collect|analytics\.google\.com\/g\/collect|region\d*\.google-analytics\.com\/g\/collect/.test(u);
const isAdobe = (u) => /edge\.adobedc\.net\/ee|\/ee\/v\d+\/interact|\.sc\.omtrdc\.net|\.demdex\.net/.test(u);

function parseGA4(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams;
    const out = { en: q.get('en'), cu: q.get('cu'), value: q.get('epn.value') || q.get('ep.value'), tid: q.get('tid'), all: {} };
    q.forEach((v, k) => { out.all[k] = v; });
    return out;
  } catch { return null; }
}

// ── timestamped report folder ──────────────────────────────────────────────────────────────
const STAMP = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..*$/, ''); // 2026-06-29_14-22-05
const REPORT_DIR = path.join(__dirname, '..', 'validation-reports', STAMP);
fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── funnel definition: one product through the full purchase journey ────────────────────────
const PRODUCT = {
  id: 'TKT-VIP-MONACO',
  name: 'VIP Ticket — Monaco Grand Prix',
  price: '850',
  category: 'tickets',
  brand: 'F1',
  quantity: 1,
  currency: 'USD'
};

const STEPS = [
  {
    step: 'ProductView',
    gridboxKey: 'ProductView', // stable
    ga4Expected: 'view_item',
    action: (p) => window.gridbox.addProduct && window.gridbox.addProduct({
      productId: p.id, productName: p.name, productPrice: p.price,
      productCategory: p.category, productBrand: p.brand
    }),
    paramsToCheck: ['product_id', 'product_name', 'product_price', 'product_category']
  },
  {
    step: 'AddToCart',
    gridboxKey: 'AddToCart',
    ga4Expected: 'add_to_cart',
    action: (p) => window.gridbox.addToCart && window.gridbox.addToCart({
      productId: p.id, productName: p.name, productPrice: p.price,
      productCategory: p.category, quantity: p.quantity, currency: p.currency
    }),
    paramsToCheck: ['product_id', 'product_name', 'product_price', 'product_category', 'product_quantity', 'currency']
  },
  {
    step: 'BeginCheckout',
    gridboxKey: 'gb_checkout_begin', // site uses gb_ key for this one
    ga4Expected: 'begin_checkout',
    action: (p) => window.gridbox.beginCheckout && window.gridbox.beginCheckout({ cartTotal: p.price, currency: p.currency }),
    paramsToCheck: ['currency', 'cart_total']
  },
  {
    step: 'Purchase',
    gridboxKey: 'gb_purchase_complete', // site uses gb_ key
    ga4Expected: 'purchase',
    action: (p) => {
      window.gridbox.setUser && window.gridbox.setUser({ id: 'guest-1001', email: 'test@example.com', type: 'guest_checkout' });
      window.gridbox.purchase && window.gridbox.purchase({
        transactionId: 'TXN-' + Date.now(), transactionTotal: p.price, currency: p.currency
      });
    },
    paramsToCheck: ['transaction_id', 'transaction_total', 'currency']
  }
];

// ── helpers ────────────────────────────────────────────────────────────────────────────────
function flat(attrs) {
  const o = {};
  if (Array.isArray(attrs)) attrs.forEach((a) => { if (a && a.key != null) o[a.key] = a.value; });
  else if (attrs && typeof attrs === 'object') Object.assign(o, attrs);
  return o;
}

function expectedGA4Name(key, eventCategory, eventAction) {
  const COMMERCE = {
    ProductView: 'view_item', 'Product viewed': 'view_item',
    AddToCart: 'add_to_cart', 'Add to cart': 'add_to_cart',
    TicketAddedToCart: 'add_to_cart', MerchandiseAddedToCart: 'add_to_cart',
    RemoveFromCart: 'remove_from_cart', 'Remove from cart': 'remove_from_cart',
    BeginCheckout: 'begin_checkout', 'Begin checkout': 'begin_checkout', gb_checkout_begin: 'begin_checkout',
    Purchase: 'purchase', 'Purchase completed': 'purchase', gb_purchase_complete: 'purchase'
  };
  const norm = (s) => String(s).trim().replace(/\s+/g, '_').toLowerCase();
  if (COMMERCE[key]) return COMMERCE[key];
  if (eventCategory && eventAction) return 'ga4_' + norm(eventCategory) + '_' + norm(eventAction);
  return 'page_view';
}

// Compare actual value to expected. Strings, numbers, and "stringified numbers" are equal.
function valuesEqual(expected, actual) {
  if (expected == null && actual == null) return true;
  if (expected == null || actual == null) return false;
  const a = String(expected).trim().toLowerCase();
  const b = String(actual).trim().toLowerCase();
  if (a === b) return true;
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  return false;
}

// ── the main spec — one test, one product, full funnel, one report ─────────────────────────
test('Full funnel: one product → ProductView → AddToCart → BeginCheckout → Purchase', async ({ page }) => {
  test.setTimeout(120000);

  // capture network hits for the whole test
  /** @type {Array<{when:string, url:string, ga4:any}>} */
  const ga4Hits = [];
  /** @type {Array<{when:string, url:string}>} */
  const adobeHits = [];
  /** @type {Array<{ts:number, type:string, text:string}>} */
  const consoleErrors = [];

  page.on('request', (req) => {
    const u = req.url();
    const when = new Date().toISOString();
    if (isGA4(u)) ga4Hits.push({ when, url: u, ga4: parseGA4(u) });
    else if (isAdobe(u)) adobeHits.push({ when, url: u });
  });
  page.on('pageerror', (err) => consoleErrors.push({ ts: Date.now(), type: 'pageerror', text: String(err) }));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push({ ts: Date.now(), type: 'console.error', text: msg.text() }); });

  await page.goto('merchandise.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer && Array.isArray(window.gridboxLayer.event)), null, { timeout: 15000 });
  await page.evaluate(() => {
    try {
      const CS = window.gridbox.CONSENT_STATES;
      window.gridbox.setConsent(CS ? CS.GRANTED : 'granted', { analytics: true, marketing: true, personalization: true });
    } catch (e) {}
  });
  // clear the cart so we start clean
  await page.evaluate(() => window.gridbox.clearCart && window.gridbox.clearCart());

  /** @type {Array<any>} */
  const stepResults = [];

  for (const STEP of STEPS) {
    // snapshot indices before action
    const before = await page.evaluate(() => ({
      gb: window.gridboxLayer.event.length,
      ad: (window.adobeDataLayer && window.adobeDataLayer.length) || 0,
      gt: (window.dataLayer && window.dataLayer.length) || 0
    }));
    const ga4Before = ga4Hits.length;
    const adobeBefore = adobeHits.length;

    // drive the step
    await page.evaluate(({ p, action }) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function('p', 'return (' + action + ')(p);');
      try { fn(p); } catch (e) { /* surfaced via consoleErrors */ }
    }, { p: PRODUCT, action: STEP.action.toString() });

    await page.waitForTimeout(900); // let async pushes + network settle

    // slice the new entries from each stream
    const cap = await page.evaluate((b) => {
      const flat = (attrs) => {
        const o = {};
        if (Array.isArray(attrs)) attrs.forEach((a) => { if (a && a.key != null) o[a.key] = a.value; });
        else if (attrs && typeof attrs === 'object') Object.assign(o, attrs);
        return o;
      };
      const gridbox = window.gridboxLayer.event.slice(b.gb).filter((e) => e && e.eventInfo)
        .map((e) => ({ key: e.eventInfo.key, eventName: e.eventInfo.eventName, category: e.category && e.category.primaryCategory, attrs: flat(e.attributes) }));
      const adobe = (window.adobeDataLayer || []).slice(b.ad).filter((p) => p && p.eventInfo)
        .map((p) => ({ event: p.event, eventName: p.eventInfo.eventName, category: p.eventInfo.category, attrs: flat(p.attributes) }));
      const gtm = (window.dataLayer || []).slice(b.gt).filter((p) => p && typeof p === 'object' && !Array.isArray(p) && p.event)
        .map((p) => ({ event: p.event, eventCategory: p.eventCategory, eventAction: p.eventAction, eventLabel: p.eventLabel, obj: p }));
      return { gridbox, adobe, gtm };
    }, before);

    const newGA4 = ga4Hits.slice(ga4Before);
    const newAdobe = adobeHits.slice(adobeBefore);

    // identify the gridbox event we drove (source of truth)
    const gb = cap.gridbox.find((e) => e.key === STEP.gridboxKey)
      || cap.gridbox.find((e) => e.eventName === STEP.gridboxKey)
      || cap.gridbox.find((e) => /^Add to cart$|^Purchase|^BeginCheckout$|^Product/.test(e.eventName || ''));
    const ad = gb && cap.adobe.find((e) => e.eventName === gb.eventName || e.key === gb.key);
    const gt = gb && cap.gtm.find((e) => (e.event && (e.event === gb.key || e.event === gb.eventName)));

    // parameter-level cross-stream comparison
    const expected = gb ? gb.attrs : {};
    const paramRows = STEP.paramsToCheck.map((param) => ({
      step: STEP.step,
      param,
      expected: expected[param] != null ? String(expected[param]) : '',
      gridbox_actual: expected[param] != null ? String(expected[param]) : '',
      gridbox_pass: expected[param] != null,
      adobe_actual: ad && ad.attrs && ad.attrs[param] != null ? String(ad.attrs[param]) : '',
      adobe_pass: ad ? valuesEqual(expected[param], ad.attrs && ad.attrs[param]) : false,
      gtm_actual: gt && gt.obj && gt.obj[param] != null ? String(gt.obj[param]) : '',
      gtm_pass: gt ? valuesEqual(expected[param], gt.obj && gt.obj[param]) : false
    }));

    // GA4 name correctness
    const ga4NameExpected = STEP.ga4Expected;
    const ga4NameDerived = gb ? expectedGA4Name(gb.key, gb.attrs.eventCategory, gb.attrs.eventAction) : null;
    const ga4NameNet = newGA4.length ? newGA4[0].ga4 && newGA4[0].ga4.en : null;

    stepResults.push({
      step: STEP.step,
      gridboxKey: STEP.gridboxKey,
      streams: {
        gridbox: !!gb,
        adobe: !!ad,
        gtm: !!gt,
        ga4_network: newGA4.length,
        adobe_network: newAdobe.length
      },
      ga4: {
        expected: ga4NameExpected,
        derived: ga4NameDerived,
        derived_pass: ga4NameDerived === ga4NameExpected,
        network: ga4NameNet,
        network_pass: ga4NameNet ? ga4NameNet === ga4NameExpected : null
      },
      parameters: paramRows,
      raw: { gridbox: gb, adobe: ad, gtm: gt, ga4Network: newGA4, adobeNetwork: newAdobe }
    });
  }

  // ── aggregate pass/fail counts ─────────────────────────────────────────────────────────
  let totalChecks = 0; let passedChecks = 0;
  const tally = (cond) => { totalChecks++; if (cond) passedChecks++; };

  for (const r of stepResults) {
    tally(r.streams.gridbox);
    tally(r.streams.adobe);
    tally(r.ga4.derived_pass);
    for (const p of r.parameters) {
      tally(p.gridbox_pass);
      tally(p.adobe_pass);
      // GTM is opt-in (not every step reaches dataLayer) — count it but report separately
    }
  }

  // ── Excel report ──────────────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GridBox cross-stream validator';
  wb.created = new Date();

  // Summary
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Value', key: 'value', width: 60 }
  ];
  sum.getRow(1).font = { bold: true };
  sum.addRows([
    { metric: 'Run timestamp', value: STAMP },
    { metric: 'Base URL', value: page.url() },
    { metric: 'Product', value: `${PRODUCT.name} (${PRODUCT.id}) @ ${PRODUCT.currency} ${PRODUCT.price}` },
    { metric: 'Steps driven', value: STEPS.length },
    { metric: 'Total checks', value: totalChecks },
    { metric: 'Passed checks', value: passedChecks },
    { metric: 'Pass rate', value: totalChecks ? ((passedChecks / totalChecks) * 100).toFixed(1) + '%' : 'n/a' },
    { metric: 'Console errors', value: consoleErrors.length },
    { metric: 'GA4 network hits', value: ga4Hits.length },
    { metric: 'Adobe network hits', value: adobeHits.length }
  ]);

  // Events sheet (one row per step × stream)
  const ev = wb.addWorksheet('Events');
  ev.columns = [
    { header: 'Step', key: 'step', width: 16 },
    { header: 'GridBox key', key: 'key', width: 24 },
    { header: 'GridBox', key: 'g', width: 10 },
    { header: 'Adobe ACDL', key: 'a', width: 12 },
    { header: 'GTM dataLayer', key: 't', width: 14 },
    { header: 'GA4 net hits', key: 'gn', width: 12 },
    { header: 'Adobe net hits', key: 'an', width: 14 },
    { header: 'GA4 name expected', key: 'ge', width: 22 },
    { header: 'GA4 name derived', key: 'gd', width: 22 },
    { header: 'GA4 derive PASS', key: 'gp', width: 16 },
    { header: 'GA4 name in network', key: 'gnn', width: 22 }
  ];
  ev.getRow(1).font = { bold: true };
  for (const r of stepResults) {
    const row = ev.addRow({
      step: r.step, key: r.gridboxKey,
      g: r.streams.gridbox ? '✓' : '✗',
      a: r.streams.adobe ? '✓' : '✗',
      t: r.streams.gtm ? '✓' : '–',
      gn: r.streams.ga4_network,
      an: r.streams.adobe_network,
      ge: r.ga4.expected, gd: r.ga4.derived || '',
      gp: r.ga4.derived_pass ? 'PASS' : 'FAIL',
      gnn: r.ga4.network || ''
    });
    row.getCell('gp').font = { color: { argb: r.ga4.derived_pass ? 'FF006100' : 'FF9C0006' }, bold: true };
  }

  // Parameters sheet (one row per param × stream)
  const pa = wb.addWorksheet('Parameters');
  pa.columns = [
    { header: 'Step', key: 'step', width: 16 },
    { header: 'Parameter', key: 'param', width: 22 },
    { header: 'Expected (GridBox)', key: 'expected', width: 28 },
    { header: 'Adobe actual', key: 'aa', width: 22 },
    { header: 'Adobe PASS', key: 'ap', width: 12 },
    { header: 'GTM actual', key: 'ga', width: 22 },
    { header: 'GTM PASS', key: 'gp', width: 12 }
  ];
  pa.getRow(1).font = { bold: true };
  for (const r of stepResults) {
    for (const p of r.parameters) {
      const row = pa.addRow({
        step: p.step, param: p.param, expected: p.expected,
        aa: p.adobe_actual, ap: p.adobe_pass ? 'PASS' : 'FAIL',
        ga: p.gtm_actual, gp: p.gtm_pass ? 'PASS' : (p.gtm_actual ? 'FAIL' : '–')
      });
      row.getCell('ap').font = { color: { argb: p.adobe_pass ? 'FF006100' : 'FF9C0006' }, bold: true };
      if (p.gtm_actual) row.getCell('gp').font = { color: { argb: p.gtm_pass ? 'FF006100' : 'FF9C0006' }, bold: true };
    }
  }

  // GA4 network sheet (every /g/collect hit with all params)
  const gn = wb.addWorksheet('GA4 Network');
  gn.columns = [
    { header: 'Time', key: 'when', width: 28 },
    { header: 'en (event)', key: 'en', width: 22 },
    { header: 'cu (currency)', key: 'cu', width: 14 },
    { header: 'value', key: 'value', width: 14 },
    { header: 'tid (measurement)', key: 'tid', width: 22 },
    { header: 'URL', key: 'url', width: 80 }
  ];
  gn.getRow(1).font = { bold: true };
  for (const h of ga4Hits) {
    gn.addRow({ when: h.when, en: h.ga4 && h.ga4.en, cu: h.ga4 && h.ga4.cu, value: h.ga4 && h.ga4.value, tid: h.ga4 && h.ga4.tid, url: h.url });
  }

  // Adobe network sheet
  const an = wb.addWorksheet('Adobe Network');
  an.columns = [{ header: 'Time', key: 'when', width: 28 }, { header: 'URL', key: 'url', width: 100 }];
  an.getRow(1).font = { bold: true };
  for (const h of adobeHits) an.addRow(h);

  // Console errors sheet (debug aid)
  const ce = wb.addWorksheet('Console Errors');
  ce.columns = [{ header: 'Type', key: 'type', width: 18 }, { header: 'Text', key: 'text', width: 120 }];
  ce.getRow(1).font = { bold: true };
  for (const e of consoleErrors) ce.addRow(e);

  const xlsxPath = path.join(REPORT_DIR, 'cross-stream-report.xlsx');
  const jsonPath = path.join(REPORT_DIR, 'cross-stream-report.json');
  await wb.xlsx.writeFile(xlsxPath);
  fs.writeFileSync(jsonPath, JSON.stringify({
    timestamp: STAMP, product: PRODUCT,
    summary: { totalChecks, passedChecks, passRate: totalChecks ? passedChecks / totalChecks : 0,
               ga4Hits: ga4Hits.length, adobeHits: adobeHits.length, consoleErrors: consoleErrors.length },
    steps: stepResults, ga4Hits, adobeHits, consoleErrors
  }, null, 2));

  // attach to the Playwright HTML report so it's available from the run as well
  await test.info().attach('cross-stream-report.xlsx', { path: xlsxPath });
  await test.info().attach('cross-stream-report.json', { path: jsonPath });

  // print a clean console summary
  // eslint-disable-next-line no-console
  console.log('\n========= CROSS-STREAM VALIDATION SUMMARY =========');
  // eslint-disable-next-line no-console
  console.log(`Report folder : ${REPORT_DIR}`);
  // eslint-disable-next-line no-console
  console.log(`Steps         : ${stepResults.map((r) => r.step).join(' → ')}`);
  // eslint-disable-next-line no-console
  console.log(`Checks        : ${passedChecks}/${totalChecks} passed (${totalChecks ? ((passedChecks / totalChecks) * 100).toFixed(1) : 0}%)`);
  // eslint-disable-next-line no-console
  console.log(`GA4 net hits  : ${ga4Hits.length}    Adobe net hits: ${adobeHits.length}    Console errors: ${consoleErrors.length}`);
  for (const r of stepResults) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.step.padEnd(14)} gridbox=${r.streams.gridbox ? 'Y' : 'N'} adobe=${r.streams.adobe ? 'Y' : 'N'} gtm=${r.streams.gtm ? 'Y' : 'N'} ga4_net=${r.streams.ga4_network} adobe_net=${r.streams.adobe_network} ga4_name=${r.ga4.derived}/${r.ga4.expected}=${r.ga4.derived_pass ? 'PASS' : 'FAIL'}`);
  }
  // eslint-disable-next-line no-console
  console.log('====================================================\n');

  // hard assertion: the invariants must hold (GridBox source-of-truth + Adobe parity + GA4 name)
  expect(stepResults.every((r) => r.streams.gridbox), 'every step must record a GridBox event').toBe(true);
  expect(stepResults.every((r) => r.streams.adobe), 'every step must mirror to Adobe ACDL').toBe(true);
  expect(stepResults.every((r) => r.ga4.derived_pass), 'every step must derive the correct GA4 event name').toBe(true);
});
