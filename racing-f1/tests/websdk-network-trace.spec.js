// @ts-check
// Capture ALL network requests to find where Web SDK is actually trying to go
const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

test('Capture ALL network requests during alloy call', async ({ page }) => {
  const allRequests = [];
  const allResponses = [];
  const consoleMessages = [];

  page.on('request', (req) => {
    allRequests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
    });
  });

  page.on('response', (res) => {
    allResponses.push({
      url: res.url(),
      status: res.status(),
    });
  });

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  page.on('pageerror', (err) => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Enable Web SDK debug + fire alloy directly
  await page.evaluate(() => {
    if (window._satellite) window._satellite.setDebug(true);
  });

  await page.waitForTimeout(1000);

  const alloyResult = await page.evaluate(() => {
    if (typeof window.alloy !== 'function') return { error: 'alloy not defined' };
    return window.alloy('sendEvent', {
      xdm: {
        eventType: 'web.webpagedetails.pageViews',
        web: { webPageDetails: { name: 'Trace test', pageViews: { value: 1 } } }
      }
    }).then(r => ({ ok: true, result: JSON.stringify(r).substring(0, 300) }))
      .catch(e => ({ ok: false, error: e.message || String(e) }));
  });

  console.log('\n=== ALLOY RESULT ===');
  console.log(JSON.stringify(alloyResult, null, 2));

  await page.waitForTimeout(5000);

  // ============================
  // ALL ADOBE-RELATED REQUESTS
  // ============================
  console.log('\n=== ALL ADOBE-RELATED REQUESTS ===');
  const adobeRequests = allRequests.filter(r =>
    r.url.includes('adobe') ||
    r.url.includes('demdex') ||
    r.url.includes('omtrdc') ||
    r.url.includes('2o7.net') ||
    r.url.includes('edge.') ||
    r.url.includes('alloy') ||
    r.url.includes('satellite')
  );
  console.log(`Total: ${adobeRequests.length}`);
  adobeRequests.forEach((r, i) => {
    const resp = allResponses.find(rsp => rsp.url === r.url);
    console.log(`  ${i + 1}. [${r.method}] ${r.resourceType.padEnd(10)} ${resp?.status || '?'} ${r.url.substring(0, 200)}`);
  });

  // ============================
  // CONSOLE MESSAGES (filter Adobe-related)
  // ============================
  console.log('\n=== CONSOLE MESSAGES (Adobe/Web SDK related) ===');
  const adobeConsole = consoleMessages.filter(c =>
    c.text.toLowerCase().includes('adobe') ||
    c.text.toLowerCase().includes('alloy') ||
    c.text.toLowerCase().includes('web sdk') ||
    c.text.toLowerCase().includes('satellite') ||
    c.text.toLowerCase().includes('analytics') ||
    c.text.toLowerCase().includes('consent') ||
    c.text.toLowerCase().includes('refused') ||
    c.text.toLowerCase().includes('cors') ||
    c.text.toLowerCase().includes('blocked') ||
    c.text.toLowerCase().includes('error') ||
    c.type === 'pageerror' ||
    c.type === 'error'
  );
  console.log(`Total: ${adobeConsole.length}`);
  adobeConsole.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.type}] ${c.text.substring(0, 300)}`);
  });

  // ============================
  // CHECK SPECIFIC ADOBE DOMAINS
  // ============================
  console.log('\n=== DOMAIN BREAKDOWN ===');
  const domains = {
    'edge.adobedc.net': allRequests.filter(r => r.url.includes('edge.adobedc.net')).length,
    'assets.adobedtm.com': allRequests.filter(r => r.url.includes('assets.adobedtm.com')).length,
    'adobedc.net (any)': allRequests.filter(r => r.url.includes('adobedc.net')).length,
    'adobe.io': allRequests.filter(r => r.url.includes('adobe.io')).length,
    'demdex.net': allRequests.filter(r => r.url.includes('demdex.net')).length,
    '2o7.net': allRequests.filter(r => r.url.includes('2o7.net')).length,
    'omtrdc.net': allRequests.filter(r => r.url.includes('omtrdc.net')).length,
  };
  Object.entries(domains).forEach(([d, c]) => console.log(`  ${d.padEnd(30)} ${c}`));

  // ============================
  // CHECK CSP HEADER
  // ============================
  const cspHeader = await page.evaluate(async () => {
    const resp = await fetch(window.location.href);
    return resp.headers.get('content-security-policy') || 'NOT SET';
  });
  console.log('\n=== CSP HEADER ===');
  console.log(cspHeader.substring(0, 500));

  // ============================
  // CHECK alloy CONFIG
  // ============================
  const alloyConfig = await page.evaluate(() => {
    try {
      const sat = window._satellite || {};
      const container = sat._container || {};
      const ext = container.extensions || {};
      const webSdkExt = ext['adobe-alloy'] || ext['web-sdk'] || Object.entries(ext).find(([k]) => k.toLowerCase().includes('alloy') || k.toLowerCase().includes('web'))?.[1];
      return {
        extensions: Object.keys(ext),
        webSdkConfig: webSdkExt ? JSON.stringify(webSdkExt).substring(0, 500) : 'not found',
      };
    } catch(e) { return { error: e.message }; }
  });
  console.log('\n=== WEB SDK EXTENSION CONFIG ===');
  console.log(JSON.stringify(alloyConfig, null, 2));
});
