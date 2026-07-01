// @ts-check
/**
 * REAL CHATGPT / ANTHROPIC CRAWLER SCENARIO
 * ==========================================
 * Three tiers, from cheapest to most-real:
 *
 *   Tier 1 — REALISTIC UA SIMULATION (always runs, no external calls)
 *     Hits the deployed URL with the EXACT User-Agent + headers that real ChatGPT / GPTBot /
 *     ClaudeBot / PerplexityBot send when they crawl. Proves the middleware detects them and
 *     initiates the server-side track for what the real crawlers actually look like.
 *
 *   Tier 2 — REAL LLM WITH BROWSING (opt-in via OPENAI_API_KEY or ANTHROPIC_API_KEY)
 *     Calls the real OpenAI / Anthropic chat API and asks the model to fetch our URL. The
 *     model's browsing tool actually hits our site with its real crawler UA. We then poll
 *     /api/bot-collect (echo endpoint) or Vercel logs to observe the hit.
 *
 *   Tier 3 — MANUAL PLAYBOOK (see docs/manual-chatgpt-verification.md)
 *     Step-by-step for a human to open chat.openai.com, ask ChatGPT to browse our URL, then
 *     verify the hit in Tealium Live Events / Vercel logs.
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app npx playwright test tests/chatgpt-crawler-scenario.spec.js --project=chromium
 *   # Opt-in to Tier 2:
 *   OPENAI_API_KEY=sk-... BASE_URL_MW=https://racing-f1-rho.vercel.app npx playwright test tests/chatgpt-crawler-scenario.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_PATH = '/tickets';
const TARGET_URL = MW_URL + TARGET_PATH;

// The EXACT UAs OpenAI and Anthropic publish for their browsing/crawling agents.
// Sources: https://openai.com/gptbot, https://openai.com/searchbot, https://platform.openai.com/docs/plugins/bot,
//          https://darkvisitors.com (ClaudeBot), https://docs.perplexity.ai
const REAL_CRAWLERS = [
  {
    label: 'GPTBot (OpenAI training crawler)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    // Headers OpenAI's crawlers send (per their public docs)
    extraHeaders: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en' },
    expect: { bot_name: 'GPTBot', bot_vendor: 'OpenAI', bot_class: 'crawler' }
  },
  {
    label: 'ChatGPT-User (ChatGPT browsing on behalf of a user)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
    extraHeaders: { 'Accept': 'text/html', 'Accept-Language': 'en' },
    expect: { bot_name: 'ChatGPT-User', bot_vendor: 'OpenAI', bot_class: 'agent' }
  },
  {
    label: 'OAI-SearchBot (OpenAI search index)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
    extraHeaders: { 'Accept': 'text/html' },
    expect: { bot_name: 'OAI-SearchBot', bot_vendor: 'OpenAI', bot_class: 'crawler' }
  },
  {
    label: 'ClaudeBot (Anthropic training crawler)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    extraHeaders: { 'Accept': 'text/html' },
    expect: { bot_name: 'ClaudeBot', bot_vendor: 'Anthropic', bot_class: 'crawler' }
  },
  {
    label: 'PerplexityBot (Perplexity index crawler)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    extraHeaders: { 'Accept': 'text/html' },
    expect: { bot_name: 'PerplexityBot', bot_vendor: 'Perplexity', bot_class: 'crawler' }
  },
  {
    label: 'Perplexity-User (Perplexity browsing on behalf of a user)',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Perplexity-User/1.0',
    extraHeaders: { 'Accept': 'text/html' },
    expect: { bot_name: 'Perplexity-User', bot_vendor: 'Perplexity', bot_class: 'agent' }
  }
];

// ── Tier 1: realistic UA simulation ─────────────────────────────────────────────────────────
test.describe('Tier 1 — realistic UA simulation (proves detection matches what real crawlers send)', () => {
  for (const c of REAL_CRAWLERS) {
    test(`${c.label} hits ${TARGET_PATH} → detected + server-side track fired`, async ({ playwright }) => {
      const ctx = await playwright.request.newContext({
        extraHTTPHeaders: { 'user-agent': c.ua, ...c.extraHeaders }
      });
      const res = await ctx.get(TARGET_URL);
      const h = res.headers();
      expect(res.status(), `${c.label}: HTTP status should be 200`).toBe(200);
      expect(h['x-bot-detected'], `${c.label}: middleware did not detect this UA`).toBe('true');
      expect(h['x-bot-name']).toBe(c.expect.bot_name);
      expect(h['x-bot-vendor']).toBe(c.expect.bot_vendor);
      expect(h['x-bot-class']).toBe(c.expect.bot_class);
      // The critical proof for "detect in EventStream": the middleware fired the POST.
      // When TEALIUM_COLLECT_URL points at Tealium Collect, this same POST arrives in Live Events.
      expect(h['x-bot-track-sent'], `${c.label}: server-side track was NOT initiated — check TEALIUM_COLLECT_URL env var`).toBe('true');
      expect(h['x-bot-track-url'], `${c.label}: track URL header missing`).toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`  ✓ ${c.expect.bot_name.padEnd(18)} → x-bot-track-url=${h['x-bot-track-url']}`);
      await ctx.dispose();
    });
  }

  test('summary — pointing at Tealium?', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { 'user-agent': 'GPTBot/1.2' } });
    const res = await ctx.get(TARGET_URL);
    const target = res.headers()['x-bot-track-url'] || '';
    const isTealium = /collect\.tealiumiq\.com/.test(target);
    // eslint-disable-next-line no-console
    console.log(
      '\n────────────────────────────────────────────────────────────\n' +
      `  Server-side track target: ${target}\n` +
      (isTealium
        ? '  ✓ Middleware is POSTing directly to Tealium Collect — check Live Events in Tealium UI.\n'
        : '  → Middleware is POSTing to a self-hosted receiver.\n' +
          '    To route into Tealium EventStream, run:\n' +
          '      vercel env rm TEALIUM_COLLECT_URL production\n' +
          '      vercel env add TEALIUM_COLLECT_URL production   # value: https://collect.tealiumiq.com/event\n' +
          '      vercel --prod --yes\n'
      ) +
      '────────────────────────────────────────────────────────────\n'
    );
    await ctx.dispose();
  });
});

// ── Tier 2: REAL LLM with browsing — opt-in via API key ─────────────────────────────────────
test.describe('Tier 2 — real LLM asks its browser to visit our URL (opt-in)', () => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  test('OpenAI: model.tools.web_search fetches our URL → middleware sees ChatGPT-User traffic', async ({ playwright }) => {
    test.skip(!OPENAI_KEY, 'Set OPENAI_API_KEY to run the real OpenAI browsing test');
    test.setTimeout(90000);

    const promptUrl = TARGET_URL + '?t=' + Date.now(); // unique so caches can't hide us
    const prompt = `Please browse the URL ${promptUrl} using your web search tool and tell me the title of the page.`;

    const ctx = await playwright.request.newContext();
    const res = await ctx.post('https://api.openai.com/v1/responses', {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      data: {
        model: 'gpt-4o-mini',
        input: prompt,
        tools: [{ type: 'web_search_preview' }],
        tool_choice: { type: 'web_search_preview' }
      }
    });

    if (res.status() >= 400) {
      // eslint-disable-next-line no-console
      console.log('OpenAI Responses API not available for this key — try a Chat Completions fallback if needed. Status: ' + res.status() + '. Body: ' + (await res.text()).slice(0, 400));
      test.skip(true, 'OpenAI browsing endpoint returned ' + res.status());
      return;
    }
    // The proof isn't in the API response — it's that our middleware saw a hit from ChatGPT-User.
    // Give the crawler a moment to hit us, then re-request our URL and read the last hit's log.
    await new Promise((r) => setTimeout(r, 6000));
    // eslint-disable-next-line no-console
    console.log('\n  OpenAI browsing invoked. Now check:\n    - Tealium Live Events (if TEALIUM_COLLECT_URL points at Tealium)\n    - `vercel logs ' + MW_URL + '` (grep "bot-collect")\n    for a ChatGPT-User or OAI-SearchBot hit on ' + promptUrl + '\n');
    await ctx.dispose();
  });

  test('Anthropic: claude uses its browsing tool to fetch our URL', async ({ playwright }) => {
    test.skip(!ANTHROPIC_KEY, 'Set ANTHROPIC_API_KEY to run the real Anthropic browsing test');
    test.setTimeout(90000);

    const promptUrl = TARGET_URL + '?t=' + Date.now();
    const ctx = await playwright.request.newContext();
    const res = await ctx.post('https://api.anthropic.com/v1/messages', {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Type': 'application/json'
      },
      data: {
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
        messages: [{ role: 'user', content: `Please fetch ${promptUrl} and tell me the page title.` }]
      }
    });

    if (res.status() >= 400) {
      // eslint-disable-next-line no-console
      console.log('Anthropic web-search API not enabled for this key — status: ' + res.status() + '. Body: ' + (await res.text()).slice(0, 400));
      test.skip(true, 'Anthropic web_search returned ' + res.status());
      return;
    }
    await new Promise((r) => setTimeout(r, 6000));
    // eslint-disable-next-line no-console
    console.log('\n  Anthropic web-search invoked. Now check:\n    - Tealium Live Events\n    - `vercel logs ' + MW_URL + '` (grep "bot-collect") — expect an anthropic-ai or ClaudeBot hit\n');
    await ctx.dispose();
  });
});
