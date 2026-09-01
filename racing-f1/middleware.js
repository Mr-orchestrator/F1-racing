/**
 * Vercel Edge Middleware — Nonce-based CSP
 *
 * Equivalent to the Cloudflare Worker approach in Solution 1.
 * Runs at the edge on EVERY request before Vercel serves the static file.
 *
 * Per request:
 *  1. Generate a cryptographically random nonce (16 bytes, base64)
 *  2. Fetch the original static HTML from this deployment's origin
 *  3. Inject nonce="" into every inline <script> tag
 *  4. Return the modified HTML with a Content-Security-Policy header
 *     containing 'nonce-{value}' + 'strict-dynamic'
 *
 * 'unsafe-inline' is kept ONLY as a fallback for browsers that don't
 * support nonces (IE11, very old Safari). Modern browsers ignore it
 * entirely when a nonce is present in the policy (CSP Level 2+).
 */

export const config = {
  // Match all HTML pages; skip API routes, static assets, and internal fetches
  matcher: [
    '/((?!api/|_vercel/|.*\\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?|ttf|gif|webp|json|txt|xml)).*)'
  ]
};

export default async function middleware(request) {
  const url = new URL(request.url);

  // ── Guard: skip internal re-fetches to avoid infinite loops ──────────────
  if (request.headers.get('x-nonce-middleware') === '1') {
    return new Response(null, { status: 404 });
  }

  // ── Generate nonce: 16 random bytes → base64 ─────────────────────────────
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const nonce = btoa(String.fromCharCode(...randomBytes));

  // ── Fetch the original static HTML from Vercel's origin ──────────────────
  // We add x-nonce-middleware:1 so the guard above prevents recursion.
  let originalResponse;
  try {
    originalResponse = await fetch(request.url, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-nonce-middleware': '1'
      },
      redirect: 'follow'
    });
  } catch {
    // If fetch fails, fall through to Vercel default handling
    return;
  }

  // ── For non-HTML responses (CSS, JS, images etc.), just pass through ──────
  const contentType = originalResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return originalResponse;
  }

  // ── Read and transform the HTML ───────────────────────────────────────────
  let html = await originalResponse.text();

  // Inject nonce into every inline <script> (tags WITHOUT a src= attribute).
  // Regex: matches <script ...> where the tag does NOT already contain src=
  html = html.replace(
    /<script((?![^>]*\bsrc\s*=)[^>]*)>/gi,
    (match, attrs) => `<script${attrs} nonce="${nonce}">`
  );

  // ── Build the CSP header ──────────────────────────────────────────────────
  const csp = [
    "default-src 'self'",

    // script-src: nonce + strict-dynamic is the core of Solution 1.
    // 'strict-dynamic' lets trusted scripts (those with the nonce) load
    // additional scripts dynamically — covers GTM, Tealium, Launch loaders.
    // 'unsafe-inline' ignored by modern browsers when nonce present (fallback only).
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'` +
      " https://www.googletagmanager.com" +
      " https://www.google-analytics.com" +
      " https://assets.adobedtm.com" +
      " https://tags.tiqcdn.com" +
      " https://*.tiqcdn.com" +
      " https://cdn.jsdelivr.net",

    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'" +
      " https://www.google-analytics.com" +
      " https://www.googletagmanager.com" +
      " https://assets.adobedtm.com" +
      " https://*.adobedc.net" +
      " https://*.demdex.net" +
      " https://*.omtrdc.net" +
      " https://tags.tiqcdn.com" +
      " https://*.tiqcdn.com" +
      " https://collect.tealiumiq.com" +
      " https://*.tealiumiq.com" +
      " https://cdn.jsdelivr.net",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src https://www.googletagmanager.com https://*.demdex.net",
    "report-uri /api/csp-report"
  ].join('; ');

  // ── Build response headers ────────────────────────────────────────────────
  const responseHeaders = new Headers(originalResponse.headers);
  responseHeaders.set('Content-Security-Policy', csp);
  // Remove any static CSP set by vercel.json (middleware CSP takes precedence,
  // but explicitly deleting avoids duplicate header confusion)
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  // Pass nonce in a header so Adobe Launch / Tag Manager extensions can read it
  responseHeaders.set('x-csp-nonce', nonce);

  return new Response(html, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: responseHeaders
  });
}
