/**
 * Vercel Edge Middleware — AI-crawler detection at the request edge.
 *
 * Two things happen for every request whose User-Agent matches a known AI crawler:
 *   1. Response gets x-bot-detected / x-bot-name / x-bot-vendor / x-bot-class headers.
 *      (visible via `curl -I`; consumed by tests and downstream tooling.)
 *   2. A server-side `ai_crawler_visit` event is POSTed to the Tealium Collect HTTP API
 *      — fire-and-forget, never blocks the request. Configured via TEALIUM_COLLECT_URL env
 *      var (unset = detection headers only; the POST is skipped).
 *
 * For non-crawler requests: pass through unmodified (zero overhead).
 */
import { next } from '@vercel/edge';
import { detectAICrawler, buildCollectEvent } from './lib/bot-detection.js';

// Match everything except _next, api, and files with an extension (static assets).
export const config = { matcher: '/((?!_next|api|.*\\..*).*)' };

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const hit = detectAICrawler(ua);
  if (!hit) return next(); // fast-path: humans go straight through

  const collectUrl = process.env.TEALIUM_COLLECT_URL || '';
  if (collectUrl) {
    const event = buildCollectEvent({
      hit,
      url: request.url,
      referer: request.headers.get('referer') || '',
      ip: request.headers.get('x-forwarded-for') || '',
      account: process.env.TEALIUM_ACCOUNT,
      profile: process.env.TEALIUM_PROFILE
    });
    // fire-and-forget; never awaited
    fetch(collectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => {});
  }

  return next({
    headers: {
      'x-bot-detected': 'true',
      'x-bot-name':     hit.name,
      'x-bot-vendor':   hit.vendor,
      'x-bot-class':    hit.class
    }
  });
}
