// @ts-check
// Trace exactly where Web SDK page view calls come from
const { test } = require('@playwright/test');

test.setTimeout(60000);

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

test('Trace pageView triggers', async ({ page }) => {
  const events = [];
  const requests = [];

  // Enable Web SDK debug logs
  await page.addInitScript(() => {
    window.__pageViewSources = [];
  });

  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      requests.push({ ts: Date.now(), url, postData });
    }
  });

  page.on('console', (msg) => {
    if (msg.text().includes('alloy') || msg.text().includes('sendEvent')) {
      events.push({ ts: Date.now(), text: msg.text() });
    }
  });

  console.log('\n=== STEP 1: Load home page (initial) ===');
  const t1 = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const homeCalls = requests.filter(r =>
    (r.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
  );
  console.log(`  Page views fired: ${homeCalls.length}`);
  homeCalls.forEach((c, i) => {
    const ms = c.ts - t1;
    console.log(`    [${ms}ms] Call ${i+1}`);
  });

  // Get Launch rule info for what fires page views
  const ruleInfo = await page.evaluate(() => {
    const rules = window._satellite?._container?.rules || [];
    const pageViewRules = rules.filter(r => {
      // Find rules that fire web.webpagedetails.pageViews
      return (r.actions || []).some(a =>
        JSON.stringify(a.settings || {}).includes('webpagedetails.pageViews') ||
        JSON.stringify(a.settings || {}).includes('Web Web Page Views') ||
        a.modulePath?.includes('send-event')
      );
    });

    return pageViewRules.map(r => ({
      name: r.name,
      events: (r.events || []).map(e => ({
        path: e.modulePath,
        settings: JSON.stringify(e.settings || {}).substring(0, 200)
      })),
      actions: (r.actions || []).map(a => ({
        path: a.modulePath,
        type: JSON.stringify(a.settings || {}).match(/"type":"([^"]+)"/)?.[1] || 'unknown'
      }))
    }));
  });

  console.log(`\n=== STEP 2: Rules that fire Web SDK Send Event ===`);
  console.log(`  Total: ${ruleInfo.length}`);
  ruleInfo.forEach((r, i) => {
    console.log(`\n  Rule ${i + 1}: ${r.name}`);
    console.log(`    Events:`);
    r.events.forEach(e => {
      const specificEvent = e.settings.match(/"eventName":"([^"]+)"/)?.[1] || 'N/A';
      console.log(`      ${e.path} ${specificEvent !== 'N/A' ? `(event: ${specificEvent})` : ''}`);
    });
    console.log(`    Actions:`);
    r.actions.forEach(a => {
      console.log(`      ${a.path} → Type: ${a.type}`);
    });
  });

  // Find which specific rules fire pageView
  console.log(`\n=== STEP 3: Rules that produce web.webpagedetails.pageViews ===`);
  const pageViewSenders = ruleInfo.filter(r =>
    r.actions.some(a => a.type === 'web.webpagedetails.pageViews' ||
                       a.type === 'Web Webpagedetails Page Views' ||
                       a.type === 'webpagedetails.pageViews')
  );

  console.log(`  Rules: ${pageViewSenders.length}`);
  pageViewSenders.forEach(r => {
    console.log(`    ✓ "${r.name}"`);
  });

  // Check adobeDataLayer for events that match these rules
  const dlEvents = await page.evaluate(() => {
    return (window.adobeDataLayer || []).filter(e => e.event).map(e => e.event);
  });
  console.log(`\n=== STEP 4: adobeDataLayer event names ===`);
  console.log(`  Events pushed: ${JSON.stringify(dlEvents)}`);

  console.log(`\n=== STEP 5: Navigate to /merchandise ===`);
  const t2 = Date.now();
  requests.length = 0;
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const merchCalls = requests.filter(r =>
    (r.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
  );
  console.log(`  Page views fired on merchandise nav: ${merchCalls.length}`);
  merchCalls.forEach((c, i) => {
    const ms = c.ts - t2;
    console.log(`    [${ms}ms] Call ${i+1}`);
  });

  const merchDl = await page.evaluate(() => {
    return (window.adobeDataLayer || []).filter(e => e.event).map(e => e.event);
  });
  console.log(`  adobeDataLayer events after nav: ${JSON.stringify(merchDl)}`);
});
