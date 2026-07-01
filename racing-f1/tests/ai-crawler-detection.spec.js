// @ts-check
/**
 * AI-crawler detection tests
 * ===========================
 * LAYER 1 (unit) — pure detection function. Runs offline, always. 15+ UAs incl. negatives.
 * LAYER 2 (event shape) — the Tealium Collect payload builder produces the expected JSON.
 * LAYER 3 (HTTP integration, opt-in) — hit the DEPLOYED URL with each spoofed UA and verify
 *   the response carries x-bot-detected / x-bot-name / x-bot-vendor / x-bot-class headers.
 *   Runs only when BASE_URL_MW points to a Vercel deployment where the middleware is live.
 *
 * Run
 *   npx playwright test tests/ai-crawler-detection.spec.js --project=chromium         # unit only
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app npx playwright test tests/ai-crawler-detection.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');
const { detectAICrawler, buildCollectEvent, AI_CRAWLERS } = require('../lib/bot-detection');

// Realistic UAs (as they appear in real crawler traffic) — plus negatives that must NOT match.
const CRAWLER_UAS = [
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', expect: 'GPTBot', vendor: 'OpenAI', klass: 'crawler' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)', expect: 'OAI-SearchBot', vendor: 'OpenAI', klass: 'crawler' },
  { ua: 'Mozilla/5.0 (Linux; Android 6.0.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36; ChatGPT-User/1.0; +https://openai.com/bot', expect: 'ChatGPT-User', vendor: 'OpenAI', klass: 'agent' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', expect: 'ClaudeBot', vendor: 'Anthropic', klass: 'crawler' },
  { ua: 'Claude-Web/1.0 (+http://www.anthropic.com/claude-web)', expect: 'Claude-Web', vendor: 'Anthropic', klass: 'crawler' },
  { ua: 'anthropic-ai', expect: 'anthropic-ai', vendor: 'Anthropic', klass: 'crawler' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', expect: 'PerplexityBot', vendor: 'Perplexity', klass: 'crawler' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Perplexity-User/1.0', expect: 'Perplexity-User', vendor: 'Perplexity', klass: 'agent' },
  { ua: 'cohere-ai', expect: 'cohere-ai', vendor: 'Cohere', klass: 'crawler' },
  { ua: 'Mozilla/5.0 (compatible; Google-Extended/1.0; +https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)', expect: 'Google-Extended', vendor: 'Google', klass: 'crawler' },
  { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Gemini-Deep-Research; +https://gemini.google/overview/deep-research/) Chrome/135.0.0.0 Safari/537.36', expect: 'Gemini-Deep-Research', vendor: 'Google', klass: 'agent' },
  { ua: 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', expect: 'Bytespider', vendor: 'ByteDance', klass: 'crawler' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15 Applebot-Extended/1.0', expect: 'Applebot-Extended', vendor: 'Apple', klass: 'crawler' },
  { ua: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', expect: 'Meta-ExternalAgent', vendor: 'Meta', klass: 'crawler' },
  { ua: 'Mozilla/5.0 (compatible; Diffbot/0.1; +http://www.diffbot.com)', expect: 'Diffbot', vendor: 'Diffbot', klass: 'crawler' },
  { ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)', expect: 'CCBot', vendor: 'CommonCrawl', klass: 'crawler' }
];

const NEGATIVE_UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'curl/8.7.1',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',            // NOT AI — regular search crawler
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', // NOT AI
  '',
  null,
  undefined
];

// ── LAYER 1 — unit: detection function ─────────────────────────────────────────────────────
test.describe('detectAICrawler — positive matches', () => {
  for (const c of CRAWLER_UAS) {
    test(`matches ${c.expect}`, () => {
      const hit = detectAICrawler(c.ua);
      expect(hit, `UA "${c.ua.slice(0, 60)}..." must match a crawler`).not.toBeNull();
      expect(hit.name).toBe(c.expect);
      expect(hit.vendor).toBe(c.vendor);
      expect(hit.class).toBe(c.klass);
    });
  }
});

test.describe('detectAICrawler — must NOT match', () => {
  for (const ua of NEGATIVE_UAS) {
    test(`ignores: ${String(ua).slice(0, 40) || '(empty)'}`, () => {
      expect(detectAICrawler(ua)).toBeNull();
    });
  }
});

test('AI_CRAWLERS registry is well-formed', () => {
  expect(AI_CRAWLERS.length).toBeGreaterThanOrEqual(15);
  for (const b of AI_CRAWLERS) {
    expect(b.name).toBeTruthy();
    expect(b.vendor).toBeTruthy();
    expect(['crawler', 'agent']).toContain(b.class);
    expect(b.re).toBeInstanceOf(RegExp);
  }
});

// ── LAYER 2 — event shape: Tealium Collect payload ────────────────────────────────────────
test('buildCollectEvent produces the expected Tealium Collect shape', () => {
  const hit = detectAICrawler('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)');
  const evt = buildCollectEvent({
    hit, url: 'https://racing-f1-rho.vercel.app/merchandise.html',
    referer: 'https://example.com/', ip: '1.2.3.4'
  });
  expect(evt.tealium_event).toBe('ai_crawler_visit');
  expect(evt.bot_detected).toBe('true');
  expect(evt.bot_name).toBe('GPTBot');
  expect(evt.bot_vendor).toBe('OpenAI');
  expect(evt.bot_class).toBe('crawler');
  expect(evt.page_url).toBe('https://racing-f1-rho.vercel.app/merchandise.html');
  expect(evt.page_path).toBe('/merchandise.html');
  expect(evt.referrer).toBe('https://example.com/');
  expect(evt.ip).toBe('1.2.3.4');
  expect(evt.tealium_account).toBe('cognizant-sandbox');
  expect(evt.tealium_profile).toBe('f1racing');
  expect(evt.timestamp_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

// ── LAYER 3 — HTTP integration against DEPLOYED middleware (opt-in via BASE_URL_MW) ────────
const MW_URL = process.env.BASE_URL_MW;
test.describe('HTTP integration — deployed middleware', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW=https://<vercel-deployment> to run HTTP integration');

  for (const c of CRAWLER_UAS) {
    test(`${c.expect} — deployed URL returns x-bot-* headers`, async ({ playwright }) => {
      const ctx = await playwright.request.newContext({ extraHTTPHeaders: { 'user-agent': c.ua } });
      const res = await ctx.get(MW_URL + '/');
      const h = res.headers();
      expect(h['x-bot-detected'], `${c.expect}: x-bot-detected missing (status ${res.status()})`).toBe('true');
      expect(h['x-bot-name']).toBe(c.expect);
      expect(h['x-bot-vendor']).toBe(c.vendor);
      expect(h['x-bot-class']).toBe(c.klass);
      // x-bot-track-sent proves the middleware actually fired the POST to the server-side receiver
      // (Tealium Collect or our self-hosted /api/bot-collect). 'true' = POST initiated;
      // 'false' = TEALIUM_COLLECT_URL env var unset. Non-strict here so the suite passes either way.
      expect(['true', 'false']).toContain(h['x-bot-track-sent']);
      await ctx.dispose();
    });
  }

  // Additional test: when server-side tracking is enabled, EVERY crawler hit must fire the POST.
  test('server-side tracking is enabled AND fires (x-bot-track-sent === "true")', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2)' }
    });
    const res = await ctx.get(MW_URL + '/');
    expect(res.headers()['x-bot-track-sent'], 'set TEALIUM_COLLECT_URL env var to enable server-side tracking').toBe('true');
    expect(res.headers()['x-bot-track-url'], 'x-bot-track-url must be populated when tracking is on').toBeTruthy();
    await ctx.dispose();
  });

  // /api/bot-collect endpoint must accept POST directly (proves the receiver is up)
  test('/api/bot-collect accepts POST and echoes the event', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.post(MW_URL + '/api/bot-collect', {
      data: {
        tealium_account: 'cognizant-sandbox', tealium_profile: 'f1racing',
        tealium_event: 'ai_crawler_visit', bot_name: 'GPTBot', bot_vendor: 'OpenAI', bot_class: 'crawler',
        page_url: MW_URL + '/', user_agent: 'test'
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.echo.bot_name).toBe('GPTBot');
    expect(body.echo.bot_vendor).toBe('OpenAI');
    expect(body.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await ctx.dispose();
  });

  test('human UA — no x-bot-* headers', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15' }
    });
    const res = await ctx.get(MW_URL + '/');
    expect(res.headers()['x-bot-detected']).toBeUndefined();
    await ctx.dispose();
  });
});
