// @ts-check
/**
 * GOOGLE → PERPLEXITY → CRAWL-OUR-URL scenario (parallel to the ChatGPT / Gemini scenarios)
 * =============================================================================================
 * Perplexity's core product IS live web search + answer synthesis — browsing isn't an optional
 * tool bolted onto a chatbot (as it can be for Gemini's consumer app), it's the default behavior
 * for nearly every query. This makes it the strongest candidate for a clean, unambiguous
 * live-crawl proof, similar in strength to the ChatGPT result.
 *
 * Registry already has PerplexityBot (crawler) and Perplexity-User (agent) — no detection fix
 * needed before this test; both were verified in the original 44-test suite.
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/google-perplexity-crawl-scenario.spec.js --project=chromium --headed --workers=1
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_PATH = '/tickets';
const TARGET_URL = MW_URL + TARGET_PATH + '?src=perplexity-verify-' + Date.now();

const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth', 'perplexity');
fs.mkdirSync(AUTH_DIR, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('drive Google → Perplexity → ask to fetch our URL, then verify', async () => {
  test.setTimeout(300000);

  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false,
    viewport: { width: 1280, height: 820 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] || (await context.newPage());

  console.log('\n[precheck] Confirming our middleware detects PerplexityBot / Perplexity-User…');
  const precheck = await context.request.get(MW_URL + '/', {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Perplexity-User/1.0' }
  });
  const h = precheck.headers();
  expect(h['x-crawl-agent-detected'], 'middleware is not detecting Perplexity-User').toBe('true');
  expect(h['x-crawl-agent-name']).toBe('Perplexity-User');
  expect(h['x-crawl-agent-track-sent'], 'server-side track not initiated — TEALIUM_COLLECT_URL not set?').toBe('true');
  console.log(`  ✓ middleware detects Perplexity-User and initiated POST to ${h['x-crawl-agent-track-url']}`);
  console.log('  NOTE: the log line this precheck produces will appear at test-start time — do not');
  console.log('  mistake it for the real Perplexity crawl further down in the log tail.');

  // Step 1 — Google search
  console.log('\n[step 1] Navigating to google.com and searching "perplexity ai"…');
  await page.goto('https://www.google.com/search?q=perplexity+ai&hl=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const consentBtn = await page.$('button:has-text("Accept all"), button:has-text("Reject all"), button[aria-label*="Accept"]');
  if (consentBtn) await consentBtn.click().catch(() => {});
  await page.waitForTimeout(800);

  console.log('[step 2] Opening the first Perplexity link from results…');
  const linkCandidates = ['a[href*="perplexity.ai"]', 'a:has-text("Perplexity")'];
  let opened = false;
  for (const sel of linkCandidates) {
    const link = await page.$(sel);
    if (link) { await link.click(); opened = true; break; }
  }
  if (!opened) {
    console.log('  ⚠ could not find a Perplexity link on the Google results page. Falling back to direct navigation.');
    await page.goto('https://www.perplexity.ai', { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await page.waitForLoadState('domcontentloaded');

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' MANUAL STEP: log into Perplexity if prompted (often optional for a single query).');
  console.log(' You have up to 2 minutes. Once you see the search/ask composer, do NOTHING —');
  console.log(' the test will type the prompt itself.');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Perplexity's homepage search box is typically a textarea with placeholder "Ask anything…"
  const composerSel = 'textarea, [contenteditable="true"], div[role="textbox"]';
  await page.waitForSelector(composerSel, { timeout: 120000 });
  console.log('[step 3] Composer detected. Typing the prompt…');

  const prompt =
    `Please fetch and read ${TARGET_URL} live, then tell me the page title and the first three ` +
    `ticket categories listed on that page.`;

  const composer = await page.$(composerSel);
  await composer.click();
  await composer.type(prompt, { delay: 20 });
  await page.waitForTimeout(500);
  await composer.press('Enter');

  console.log('\n[step 4] Prompt sent. Waiting up to 60s for Perplexity to fetch our URL (it usually browses fast)…');
  await page.waitForTimeout(60000);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' VERIFICATION — check ONE of these to confirm the crawl was detected:');
  console.log('');
  console.log(' 1. Tealium Live Events (if TEALIUM_COLLECT_URL points at collect.tealiumiq.com):');
  console.log('       my.tealiumiq.com → EventStream → Live Events → filter tealium_event=ai_crawler_visit');
  console.log(`       Look for page_url containing ${TARGET_URL}`);
  console.log('');
  console.log(' 2. Vercel logs:');
  console.log(`       vercel logs ${MW_URL} | grep bot-track | tail -5`);
  console.log('       Expected: bot=PerplexityBot or bot=Perplexity-User, on page=/tickets, AFTER the');
  console.log('       precheck line (which fires at test start, tagged page=/)');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  await context.close();
});
