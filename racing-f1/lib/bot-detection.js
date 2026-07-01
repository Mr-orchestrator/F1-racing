/**
 * AI-crawler detection — pure, dependency-free, runs in Node + Edge + browser.
 * Exported as both CommonJS (for tests) and as an ES module-friendly default.
 */
'use strict';

const AI_CRAWLERS = [
  { name: 'GPTBot',            re: /\bGPTBot\b/i,            vendor: 'OpenAI',     class: 'crawler' },
  { name: 'OAI-SearchBot',     re: /\bOAI-SearchBot\b/i,     vendor: 'OpenAI',     class: 'crawler' },
  { name: 'ChatGPT-User',      re: /\bChatGPT-User\b/i,      vendor: 'OpenAI',     class: 'agent'   },
  { name: 'ClaudeBot',         re: /\bClaudeBot\b/i,         vendor: 'Anthropic',  class: 'crawler' },
  { name: 'Claude-Web',        re: /\bClaude-Web\b/i,        vendor: 'Anthropic',  class: 'crawler' },
  { name: 'anthropic-ai',      re: /\banthropic-ai\b/i,      vendor: 'Anthropic',  class: 'crawler' },
  { name: 'PerplexityBot',     re: /\bPerplexityBot\b/i,     vendor: 'Perplexity', class: 'crawler' },
  { name: 'Perplexity-User',   re: /\bPerplexity-User\b/i,   vendor: 'Perplexity', class: 'agent'   },
  { name: 'cohere-ai',         re: /\bcohere-ai\b/i,         vendor: 'Cohere',     class: 'crawler' },
  { name: 'Google-Extended',   re: /\bGoogle-Extended\b/i,   vendor: 'Google',     class: 'crawler' },
  { name: 'Bytespider',        re: /\bBytespider\b/i,        vendor: 'ByteDance',  class: 'crawler' },
  { name: 'Applebot-Extended', re: /\bApplebot-Extended\b/i, vendor: 'Apple',      class: 'crawler' },
  { name: 'Meta-ExternalAgent', re: /\bMeta-ExternalAgent\b/i, vendor: 'Meta',     class: 'crawler' },
  { name: 'Diffbot',           re: /\bDiffbot\b/i,           vendor: 'Diffbot',    class: 'crawler' },
  { name: 'CCBot',             re: /\bCCBot\b/i,             vendor: 'CommonCrawl', class: 'crawler' }
];

/**
 * Detect AI crawlers from a User-Agent string.
 * @param {string} ua
 * @returns {null | { name: string, vendor: string, class: string, ua: string }}
 */
function detectAICrawler(ua) {
  if (!ua || typeof ua !== 'string') return null;
  for (const b of AI_CRAWLERS) {
    if (b.re.test(ua)) return { name: b.name, vendor: b.vendor, class: b.class, ua };
  }
  return null;
}

/**
 * Build the Tealium Collect HTTP API event payload for a detected crawler hit.
 * Matches Tealium Collect's expected JSON shape; the profile decides routing via Load Rules.
 */
function buildCollectEvent({ hit, url, referer, ip, account, profile }) {
  return {
    tealium_account: account || 'cognizant-sandbox',
    tealium_profile: profile || 'f1racing',
    tealium_event:   'ai_crawler_visit',
    bot_detected:    'true',
    bot_name:        hit.name,
    bot_vendor:      hit.vendor,
    bot_class:       hit.class,
    page_url:        url || '',
    page_path:       (() => { try { return new URL(url).pathname; } catch { return ''; } })(),
    referrer:        referer || '',
    user_agent:      hit.ua,
    ip:              ip || '',
    timestamp_iso:   new Date().toISOString()
  };
}

module.exports = { AI_CRAWLERS, detectAICrawler, buildCollectEvent };
