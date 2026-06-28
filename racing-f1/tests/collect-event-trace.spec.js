// @ts-check
// Trace EVERY Web SDK call from initial page load to understand "collect event"
const { test } = require('@playwright/test');

test.setTimeout(60000);

test('What is the "collect event"?', async ({ page }) => {
  const calls = [];

  page.on('request', (req) => {
    const url = req.url();
    // Capture ALL adobedc.net / demdex.net calls
    if (url.includes('adobedc.net') || url.includes('demdex.net') || url.includes('adobedtm.com')) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      calls.push({
        ts: Date.now(),
        url: url,
        method: req.method(),
        postData
      });
    }
  });

  console.log('\n=== Loading home page — capturing ALL Adobe calls ===\n');
  const t0 = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Categorize each call
  console.log(`\nTotal Adobe-related requests: ${calls.length}\n`);

  calls.forEach((c, i) => {
    const ms = c.ts - t0;
    const u = new URL(c.url);
    const path = u.pathname;
    const host = u.hostname;

    let category = '';
    if (path.includes('/launch-')) category = '🔧 Launch library load (JS file)';
    else if (path.includes('/AppMeasurement')) category = '🔧 AppMeasurement library load';
    else if (path.includes('/ee/v1/interact') || path.includes('/ee/v2/interact')) category = '📨 Web SDK INTERACT call (XDM event)';
    else if (path.includes('/ee/v1/collect') || path.includes('/ee/v2/collect')) category = '📤 Web SDK COLLECT call (fire-and-forget)';
    else if (path.includes('/id') || path.includes('demdex.net')) category = '🆔 Identity sync (ECID)';
    else if (path.includes('/idsync')) category = '🆔 Adobe Audience Manager ID sync';
    else if (path.includes('/extensions/')) category = '🔧 Launch extension JS file';
    else category = `❓ Unknown - ${path}`;

    console.log(`\n  Request ${i + 1} (at +${ms}ms):`);
    console.log(`    Category: ${category}`);
    console.log(`    Method:   ${c.method}`);
    console.log(`    Host:     ${host}`);
    console.log(`    Path:     ${path}`);

    // Show event info if it's an interact/collect call
    if (c.postData?.events) {
      c.postData.events.forEach((e, ei) => {
        console.log(`    Event ${ei + 1}: ${e.xdm?.eventType || 'unknown'}`);
        if (e.xdm?.commerce) console.log(`      commerce keys: ${Object.keys(e.xdm.commerce).join(', ')}`);
      });
    }

    // Show query params
    if (path.includes('/ee/')) {
      const cfg = u.searchParams.get('configId');
      const reqId = u.searchParams.get('requestId');
      if (cfg) console.log(`    configId: ${cfg.substring(0, 20)}...`);
      if (reqId) console.log(`    requestId: ${reqId}`);
    }
  });

  // Group by category for summary
  console.log(`\n\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   SUMMARY                                                    ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);

  const grouped = {};
  calls.forEach(c => {
    const u = new URL(c.url);
    let cat = 'Other';
    if (u.pathname.includes('/launch-')) cat = 'Launch library';
    else if (u.pathname.includes('/AppMeasurement')) cat = 'AppMeasurement library';
    else if (u.pathname.includes('/ee/v1/interact') || u.pathname.includes('/ee/v2/interact')) cat = 'Web SDK Interact';
    else if (u.pathname.includes('/ee/v1/collect') || u.pathname.includes('/ee/v2/collect')) cat = 'Web SDK Collect';
    else if (u.hostname.includes('demdex.net')) cat = 'Demdex Identity';
    else if (u.pathname.includes('/extensions/')) cat = 'Launch extension files';
    grouped[cat] = (grouped[cat] || 0) + 1;
  });

  Object.entries(grouped).forEach(([cat, count]) => {
    console.log(`║   ${cat.padEnd(40)} ${String(count).padStart(3)}        ║`);
  });
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
});
