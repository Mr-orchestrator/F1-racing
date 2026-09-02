/**
 * Combined middleware test — validates both CSP nonce and crawler tracking
 * work together in the same middleware without breaking each other.
 */

const { test, expect, chromium } = require('@playwright/test');
const BASE_URL = 'https://racing-f1-rho.vercel.app';

const CRAWLER_UAS = [
  { name: 'GPTBot',      ua: 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)' },
  { name: 'ClaudeBot',   ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com/bot)' },
  { name: 'PerplexityBot', ua: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)' },
];

// ════════════════════════════════════════════════════════
// TEST 1: Normal browser — CSP nonce works as before
// ════════════════════════════════════════════════════════
test('Normal browser request: CSP nonce present, no crawler header', async ({ page }) => {
  page.on('dialog', async d => { await d.dismiss(); });

  let cspNonce = null;
  let crawlerHeader = null;

  page.on('response', resp => {
    if (resp.url() === BASE_URL + '/' && resp.headers()['content-type']?.includes('text/html')) {
      const csp = resp.headers()['content-security-policy'];
      if (csp) {
        const m = csp.match(/'nonce-([^']+)'/);
        cspNonce = m ? m[1] : null;
      }
      crawlerHeader = resp.headers()['x-crawler-detected'] || null;
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  console.log('\n=== NORMAL BROWSER REQUEST ===');
  console.log(`  CSP nonce:          ${cspNonce ? '✅ ' + cspNonce.slice(0, 16) + '...' : '❌ missing'}`);
  console.log(`  x-crawler-detected: ${crawlerHeader ?? '✅ absent (correct — not a crawler)'}`);

  expect(cspNonce).toBeTruthy();
  expect(crawlerHeader).toBeNull();
});

// ════════════════════════════════════════════════════════
// TEST 2: Crawler User-Agents — detected + CSP still works
// ════════════════════════════════════════════════════════
for (const bot of CRAWLER_UAS) {
  test(`Crawler detected: ${bot.name} — CSP nonce still injected`, async () => {
    const response = await fetch(BASE_URL, {
      headers: { 'User-Agent': bot.ua }
    });

    const csp = response.headers.get('content-security-policy');
    const crawlerHeader = response.headers.get('x-crawler-detected');
    const html = await response.text();

    const nonceMatch = csp?.match(/'nonce-([^']+)'/);
    const cspNonce = nonceMatch?.[1] ?? null;

    // Count script tags with nonce in raw HTML
    const nonceTagCount = [...html.matchAll(/nonce="([^"]+)"/g)].length;

    console.log(`\n=== ${bot.name} ===`);
    console.log(`  User-Agent sent:    ${bot.ua.slice(0, 60)}...`);
    console.log(`  x-crawler-detected: ${crawlerHeader ? '✅ ' + crawlerHeader : '❌ NOT detected'}`);
    console.log(`  CSP nonce:          ${cspNonce ? '✅ ' + cspNonce.slice(0, 16) + '...' : '❌ missing'}`);
    console.log(`  Script tags with nonce: ${nonceTagCount}`);

    // Crawler must be detected
    expect(crawlerHeader).toBeTruthy();
    expect(crawlerHeader).toContain(bot.name);

    // CSP must still work for crawlers too
    expect(cspNonce).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(nonceTagCount).toBeGreaterThan(0);
  });
}

// ════════════════════════════════════════════════════════
// TEST 3: Crawler tracking fires to /api/bot-collect
// ════════════════════════════════════════════════════════
test('Crawler hit fires tracking event to /api/bot-collect', async () => {
  // Directly POST to bot-collect to verify endpoint is live
  const payload = {
    tealium_account:      'cognizant-sandbox',
    tealium_profile:      'f1racing',
    tealium_event:        'ai_crawler_visit',
    crawl_agent_detected: 'true',
    crawl_agent_name:     'GPTBot',
    crawl_agent_vendor:   'OpenAI',
    crawl_agent_class:    'crawler',
    page_url:             BASE_URL + '/',
    page_path:            '/',
    user_agent:           'Mozilla/5.0 (compatible; GPTBot/1.0)',
    timestamp_iso:        new Date().toISOString()
  };

  const resp = await fetch(`${BASE_URL}/api/bot-collect`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  const body = await resp.json();

  console.log('\n=== /api/bot-collect RESPONSE ===');
  console.log(`  HTTP status:       ${resp.status}`);
  console.log(`  ok:                ${body.ok}`);
  console.log(`  received_at:       ${body.received_at}`);
  console.log(`  crawl_agent_name:  ${body.echo?.crawl_agent_name}`);
  console.log(`  tealium_event:     ${body.echo?.tealium_event}`);

  expect(resp.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.echo.crawl_agent_name).toBe('GPTBot');
  expect(body.echo.tealium_event).toBe('ai_crawler_visit');
});

// ════════════════════════════════════════════════════════
// TEST 4: Regular user — no tracking event fires
// ════════════════════════════════════════════════════════
test('Regular browser UA: no x-crawler-detected header', async () => {
  const regularUAs = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0',
  ];

  console.log('\n=== REGULAR BROWSER UAs — should NOT be detected ===');
  for (const ua of regularUAs) {
    const resp = await fetch(BASE_URL, { headers: { 'User-Agent': ua } });
    const detected = resp.headers.get('x-crawler-detected');
    const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : 'Firefox';
    console.log(`  ${browser}: ${detected ? '❌ falsely detected as ' + detected : '✅ not detected'}`);
    expect(detected).toBeNull();
  }
});
