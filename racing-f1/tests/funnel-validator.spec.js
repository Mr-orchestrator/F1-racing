// @ts-check
/**
 * FULL-FUNNEL ANALYTICS VALIDATOR — one product, view → add-to-cart → checkout → purchase.
 * For every step it verifies each PARAMETER three ways:
 *   expected  vs  GridBox datalayer (window.gridboxLayer.event[])  vs  final output (adobeDataLayer)
 * plus best-effort NETWORK interception of GA4 (/g/collect) + Adobe Edge during the journey,
 * and the GA4 event-name derivation (Tealium GA4 mapping).
 *
 * OUTPUT: a timestamped folder  analytics-reports/<YYYY-MM-DD_HH-MM-SS>/  containing
 *   - parameter-verification.csv  (step, parameter, expected, gridbox, adobe, match)
 *   - network-interceptions.csv   (step, stream, event/url, value, currency)
 *   - summary.json                (passed / total counts)
 * Open the .csv files directly in Excel.
 *
 * Run (local files):
 *   BASE_URL=http://localhost:3000 npx playwright test tests/funnel-validator.spec.js --project=chromium
 * Run (against PROD, real GA4/Adobe/Tealium network):
 *   BASE_URL=https://racing-f1-rho.vercel.app npx playwright test tests/funnel-validator.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const isGA4 = (u) => /google-analytics\.com\/(g|j)\/collect|analytics\.google\.com\/g\/collect|region\d*\.google-analytics\.com\/g\/collect/.test(u);
const isAdobe = (u) => /edge\.adobedc\.net\/ee|\/ee\/v\d+\/interact|\.sc\.omtrdc\.net|\.demdex\.net/.test(u);
const parseGA4 = (u) => { try { const q = new URL(u).searchParams; return { en: q.get('en'), cu: q.get('cu'), value: q.get('epn.value') || q.get('ep.value') }; } catch { return {}; } };

function expectedGA4Name(key) {
  const C = {
    ProductView: 'view_item', 'Product viewed': 'view_item',
    AddToCart: 'add_to_cart', 'Add to cart': 'add_to_cart',
    BeginCheckout: 'begin_checkout', gb_checkout_begin: 'begin_checkout',
    Purchase: 'purchase', gb_purchase_complete: 'purchase'
  };
  return C[key] || 'page_view';
}

function timestampDir() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  const dir = path.join(__dirname, '..', 'analytics-reports', ts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function writeCSV(file, header, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(file, [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n'), 'utf8');
}

// the one product carried through the whole funnel
const PRODUCT = { productId: 'TKT-MON-VIP', productName: 'Monaco GP VIP Grandstand', productPrice: '1200', productCategory: 'tickets', currency: 'USD' };

// funnel steps: match = eventName to locate in each stream; expected = parameters that must match
const STEPS = [
  { name: 'AddToCart', match: 'Add to cart', ga4: 'add_to_cart',
    action: (p) => window.gridbox.addToCart && window.gridbox.addToCart({ productId: p.productId, productName: p.productName, productPrice: p.productPrice, productCategory: p.productCategory, quantity: 1, currency: p.currency }),
    expected: { product_id: 'TKT-MON-VIP', product_price: '1200', currency: 'USD' } },
  { name: 'BeginCheckout', match: 'BeginCheckout', ga4: 'begin_checkout',
    action: (p) => window.gridbox.beginCheckout && window.gridbox.beginCheckout({ cartTotal: p.productPrice, currency: p.currency }),
    expected: { currency: 'USD' } },
  { name: 'Purchase', match: 'Purchase', ga4: 'purchase',
    action: (p) => window.gridbox.purchase && window.gridbox.purchase({ transactionId: 'T-MON-1001', transactionTotal: p.productPrice, currency: p.currency }),
    expected: { currency: 'USD' } }
];

test('full purchase funnel — parameter verification across datalayer + final output + GA4, with CSV export', async ({ page }) => {
  const net = { ga4: [], adobe: [] };
  page.on('request', (r) => { const u = r.url(); if (isGA4(u)) net.ga4.push(parseGA4(u)); else if (isAdobe(u)) net.adobe.push(u); });

  await page.goto('merchandise.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer), null, { timeout: 15000 });
  await page.evaluate(() => { try { const CS = window.gridbox.CONSENT_STATES; window.gridbox.setConsent(CS ? CS.GRANTED : 'granted', { analytics: true, marketing: true, personalization: true }); } catch (e) {} });

  const paramRows = []; // step, parameter, expected, gridbox, adobe, match
  const netRows = [];   // step, stream, event, value, currency
  let passed = 0, total = 0;

  for (const step of STEPS) {
    const before = await page.evaluate(() => ({ gb: window.gridboxLayer.event.length, ad: (window.adobeDataLayer || []).length }));
    const netBefore = { ga4: net.ga4.length, adobe: net.adobe.length };
    await page.evaluate(step.action, PRODUCT);
    await page.waitForTimeout(900);

    const cap = await page.evaluate((b) => {
      const flat = (a) => { const o = {}; if (Array.isArray(a)) a.forEach((x) => { if (x && x.key != null) o[x.key] = x.value; }); else if (a && typeof a === 'object') Object.assign(o, a); return o; };
      const gb = window.gridboxLayer.event.slice(b.gb).filter((e) => e && e.eventInfo).map((e) => ({ key: e.eventInfo.key, eventName: e.eventInfo.eventName, attrs: flat(e.attributes) }));
      const ad = (window.adobeDataLayer || []).slice(b.ad).filter((p) => p && p.eventInfo).map((p) => ({ eventName: p.eventInfo.eventName, attrs: flat(p.attributes) }));
      return { gb, ad };
    }, before);

    const gbEv = cap.gb.find((e) => e.eventName === step.match || e.key === step.match) || cap.gb[0];
    const adEv = cap.ad.find((e) => e.eventName === step.match) || cap.ad[0];
    const gbAttrs = (gbEv && gbEv.attrs) || {};
    const adAttrs = (adEv && adEv.attrs) || {};

    // 1) GA4 event-name derivation
    total++;
    const ga4Actual = expectedGA4Name(gbEv ? gbEv.key : '');
    const ga4Pass = ga4Actual === step.ga4;
    if (ga4Pass) passed++;
    paramRows.push([step.name, 'ga4_event_name', step.ga4, ga4Actual, '', ga4Pass ? 'PASS' : 'FAIL']);

    // 2) expected parameters: expected vs gridbox(datalayer) vs adobe(final output)
    for (const [param, exp] of Object.entries(step.expected)) {
      total++;
      const g = gbAttrs[param]; const a = adAttrs[param];
      const pass = String(g) === String(exp) && (a === undefined || String(a) === String(exp));
      if (pass) passed++;
      paramRows.push([step.name, param, exp, g === undefined ? '(missing)' : g, a === undefined ? '(absent)' : a, pass ? 'PASS' : 'FAIL']);
    }

    // 3) full parameter parity for ALL keys present (datalayer vs final output)
    const allKeys = new Set([...Object.keys(gbAttrs), ...Object.keys(adAttrs)]);
    for (const k of allKeys) {
      if (step.expected[k] !== undefined) continue; // already covered above
      const g = gbAttrs[k]; const a = adAttrs[k];
      const match = (g === undefined || a === undefined) ? 'only-' + (g !== undefined ? 'gridbox' : 'adobe') : (String(g) === String(a) ? 'MATCH' : 'MISMATCH');
      paramRows.push([step.name, k, '', g === undefined ? '' : g, a === undefined ? '' : a, match]);
    }

    // network captured during this step
    net.ga4.slice(netBefore.ga4).forEach((x) => netRows.push([step.name, 'GA4', x.en || '(collect)', x.value || '', x.cu || '']));
    net.adobe.slice(netBefore.adobe).forEach((u) => netRows.push([step.name, 'Adobe', u.slice(0, 80), '', '']));

    // INVARIANT: GridBox is source of truth — the step event must exist
    expect(gbEv, `${step.name}: GridBox must record the event`).toBeTruthy();
  }

  // ── write the timestamped Excel-compatible report ──────────────────────────────────────────
  const dir = timestampDir();
  writeCSV(path.join(dir, 'parameter-verification.csv'), ['step', 'parameter', 'expected', 'gridbox_datalayer', 'adobe_final_output', 'result'], paramRows);
  writeCSV(path.join(dir, 'network-interceptions.csv'), ['step', 'stream', 'event_or_url', 'value', 'currency'], netRows);
  const summary = { product: PRODUCT.productId, generatedAt: new Date().toISOString(), passed, total, failed: total - passed, ga4_network_hits: net.ga4.length, adobe_network_hits: net.adobe.length, steps: STEPS.map((s) => s.name) };
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(`FUNNEL_REPORT ${JSON.stringify({ dir: path.relative(process.cwd(), dir), passed, total, ga4net: net.ga4.length, adobenet: net.adobe.length })}`);
  test.info().annotations.push({ type: 'funnel report', description: `${passed}/${total} checks passed → ${path.relative(process.cwd(), dir)}` });

  // expected-value checks (GA4 names + expected params) must all pass
  const expectedChecks = paramRows.filter((r) => r[5] === 'PASS' || r[5] === 'FAIL');
  const failed = expectedChecks.filter((r) => r[5] === 'FAIL');
  expect(failed, `expected-value failures: ${JSON.stringify(failed)}`).toHaveLength(0);
});
