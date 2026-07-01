// @ts-check
/**
 * GOOGLE → GEMINI → CRAWL-OUR-URL scenario (parallel to google-chatgpt-crawl-scenario.spec.js)
 * ==============================================================================================
 * Same idea as the ChatGPT scenario, but for Google's Gemini. Two honest caveats baked in:
 *
 *   1. Google's own developer docs (developers.google.com/crawling) state that Gemini's crawler
 *      self-identifies as "Gemini-Deep-Research" ONLY for the Deep Research feature. Ordinary
 *      Gemini chat "read this URL" traffic often arrives with a generic "Google" User-Agent —
 *      Google's docs explicitly say this traffic is "indistinguishable from other Google
 *      services." So a clean miss here does not necessarily mean our detection pipe is broken;
 *      it may mean Gemini didn't self-identify on this particular request. We report this
 *      distinction explicitly rather than hiding it.
 *   2. Gemini "first attempts retrieval from Google's web index" and only does a live fetch if
 *      the content isn't already indexed. We use a unique, never-before-seen query string on the
 *      target URL specifically to force a live fetch instead of an indexed-cache answer.
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/google-gemini-crawl-scenario.spec.js --project=chromium --headed --workers=1
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_PATH = '/tickets';
const TARGET_URL = MW_URL + TARGET_PATH + '?src=gemini-verify-' + Date.now();

// Separate persistent auth dir from the ChatGPT one — different Google account session state.
const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth', 'gemini');
fs.mkdirSync(AUTH_DIR, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('drive Google → Gemini → ask to fetch our URL, then verify', async () => {
  test.setTimeout(360000);

  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false,
    viewport: { width: 1280, height: 820 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] || (await context.newPage());

  // Precheck: does our registry even know about Gemini-Deep-Research?
  console.log('\n[precheck] Confirming our middleware detects Gemini-Deep-Research…');
  const precheck = await context.request.get(MW_URL + '/', {
    headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Gemini-Deep-Research; +https://gemini.google/overview/deep-research/) Chrome/135.0.0.0 Safari/537.36' }
  });
  const h = precheck.headers();
  expect(h['x-bot-detected'], 'middleware is not detecting Gemini-Deep-Research — check lib/bot-detection.js').toBe('true');
  expect(h['x-bot-name']).toBe('Gemini-Deep-Research');
  expect(h['x-bot-track-sent'], 'server-side track not initiated — TEALIUM_COLLECT_URL not set?').toBe('true');
  console.log(`  ✓ middleware detects Gemini-Deep-Research and initiated POST to ${h['x-bot-track-url']}`);

  // Step 1 — Google search
  console.log('\n[step 1] Navigating to google.com and searching "gemini"…');
  await page.goto('https://www.google.com/search?q=gemini&hl=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const consentBtn = await page.$('button:has-text("Accept all"), button:has-text("Reject all"), button[aria-label*="Accept"]');
  if (consentBtn) await consentBtn.click().catch(() => {});
  await page.waitForTimeout(800);

  console.log('[step 2] Opening the first Gemini link from results…');
  const linkCandidates = ['a[href*="gemini.google.com"]', 'a:has-text("Gemini")'];
  let opened = false;
  for (const sel of linkCandidates) {
    const link = await page.$(sel);
    if (link) { await link.click(); opened = true; break; }
  }
  if (!opened) {
    console.log('  ⚠ could not find a Gemini link on the Google results page. Falling back to direct navigation.');
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await page.waitForLoadState('domcontentloaded');

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' MANUAL STEP: log into your Google account if prompted.');
  console.log(' You have up to 3 minutes. Once you see the Gemini chat composer, do NOTHING —');
  console.log(' the test will type the prompt itself.');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Gemini's web app uses a rich-text editor (historically a Quill-based contenteditable div).
  // Try several selectors, broadest first.
  const composerSel = 'div.ql-editor, [contenteditable="true"], div[role="textbox"], textarea';
  await page.waitForSelector(composerSel, { timeout: 180000 });
  console.log('[step 3] Composer detected. Typing the prompt…');

  const prompt =
    `Please read the URL ${TARGET_URL} and tell me the page title plus the first three ticket ` +
    `categories listed on that page. Fetch it live — do not answer from cached knowledge.`;

  const composer = await page.$(composerSel);
  await composer.click();
  await composer.type(prompt, { delay: 20 });
  await page.waitForTimeout(500);
  await composer.press('Enter');

  console.log('\n[step 4] Prompt sent. Waiting up to 90s for Gemini to fetch our URL…');
  await page.waitForTimeout(90000);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' VERIFICATION — check ONE of these to confirm the crawl was detected:');
  console.log('');
  console.log(' 1. Tealium Live Events (if TEALIUM_COLLECT_URL points at collect.tealiumiq.com):');
  console.log('       my.tealiumiq.com → EventStream → Live Events → filter tealium_event=ai_crawler_visit');
  console.log(`       Look for page_url containing ${TARGET_URL}`);
  console.log('');
  console.log(' 2. Vercel logs:');
  console.log(`       vercel logs ${MW_URL} | grep bot-track | tail -5`);
  console.log('       Expected (if Gemini self-identified): bot=Gemini-Deep-Research or bot=Google-Extended');
  console.log('');
  console.log(' 3. IMPORTANT CAVEAT: Google\'s own docs state ordinary Gemini "read this URL" traffic');
  console.log('    often arrives with a GENERIC "Google" User-Agent — indistinguishable from other');
  console.log('    Google services. If nothing shows up in Vercel logs, this is the most likely reason,');
  console.log('    NOT a broken detection pipe. Check your own server access logs / Vercel request logs');
  console.log('    for ANY hit on the target URL around this timestamp, regardless of bot tagging, to');
  console.log('    distinguish "Gemini didn\'t fetch it" from "Gemini fetched it but wasn\'t tagged."');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  await context.close();
});
