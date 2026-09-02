# CSP Nonce Architecture — F1 Racing Site

> **Site**: racing-f1-rho.vercel.app  
> **Implemented via**: Vercel Edge Middleware  
> **Date**: September 2026

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solutions Overview](#solutions-overview)
3. [Solution 1 — Nonce-Based CSP](#solution-1--nonce-based-csp)
   - [Architecture Flow](#architecture-flow)
   - [Edge Middleware](#edge-middleware)
   - [Nonce Generation](#nonce-generation)
   - [Script Tag Injection](#script-tag-injection)
   - [CSP Header Construction](#csp-header-construction)
   - [Cache Control — Critical Detail](#cache-control--critical-detail)
4. [Tealium Loader Upgrade](#tealium-loader-upgrade)
5. [GA4 Regional Domains](#ga4-regional-domains)
6. [Playwright Test Suite](#playwright-test-suite)
   - [Manual Verification Commands](#manual-verification-commands)
7. [Key Security Properties](#key-security-properties)
   - [strict-dynamic and Host Allowlists](#strict-dynamic-and-host-allowlists)
   - [unsafe-inline Interaction with Nonce](#unsafe-inline-interaction-with-nonce)
   - [Nonce Hiding — Browser Security Feature](#nonce-hiding--browser-security-feature)
8. [Known Issues (Not CSP-Related)](#known-issues-not-csp-related)
9. [Pending: Solution 2B — Tealium First-Party CNAME](#pending-solution-2b--tealium-first-party-cname)

---

## Problem Statement

The F1 Racing site loaded several third-party scripts (Adobe Launch, Tealium, GTM, Google Analytics) with no Content Security Policy in place. Without a CSP, a single XSS injection anywhere on the page could execute arbitrary JavaScript — stealing sessions, exfiltrating data, or hijacking analytics.

A static `unsafe-inline` allowance in `vercel.json` headers provides no real protection: it permits every inline script regardless of origin. The goal was a cryptographically enforced policy where only scripts explicitly trusted **per-request** are permitted to run.

---

## Solutions Overview

| Solution | Mechanism | Status |
|---|---|---|
| **1 — Nonce CSP** | Vercel Edge Middleware generates a random nonce per request, injects it into every `<script>` tag, and sets it in the CSP header | ✅ Implemented |
| **2B — Tealium CNAME** | First-party subdomain CNAME alias pointing to Tealium's CloudFront — removes `tiqcdn.com` from CSP allowlist | ⏳ Pending |

---

## Solution 1 — Nonce-Based CSP

### Architecture Flow

Every HTML page request passes through Vercel Edge Middleware before any static asset is served. The middleware intercepts the request, generates a cryptographic nonce, fetches the static HTML from Vercel's origin (adding a guard header to prevent infinite loops), rewrites every `<script>` tag to include the nonce, sets the CSP header, and disables CDN caching.

```
Browser                    Vercel Edge                     Origin (Static HTML)
   │                              │                                    │
   │  GET /  (HTML request)       │                                    │
   │ ─────────────────────────►  │                                    │
   │                              │  crypto.getRandomValues(16 bytes)  │
   │                              │  nonce = btoa(randomBytes)         │
   │                              │                                    │
   │                              │  fetch(url, {                      │
   │                              │    'x-nonce-middleware': '1'       │
   │                              │  })  ──────────────────────────►  │
   │                              │                                    │
   │                              │  ◄──────────── raw HTML ──────────│
   │                              │                                    │
   │                              │  inject nonce into ALL <script>    │
   │                              │  set CSP header with nonce         │
   │                              │  set Cache-Control: no-store       │
   │                              │                                    │
   │  ◄──────── modified HTML ───  │                                    │
   │  CSP: script-src 'nonce-X'   │                                    │
   │                              │                                    │
   │  Browser executes only       │                                    │
   │  scripts with nonce="X"  ✅  │                                    │
```

> **Key property**: The nonce is generated inside the middleware process — never in the static HTML, never from a CDN cache. This guarantees every visitor sees a different nonce, including two users whose requests arrive simultaneously.

---

### Edge Middleware

**File**: `middleware.js` (project root)

Vercel automatically runs this at the edge before serving any matched route. The `matcher` config excludes API routes, static assets (`.js`, `.css`, images, fonts), and Vercel internal paths.

```js
// middleware.js — route matcher
export const config = {
  matcher: [
    '/((?!api/|_vercel/|.*\\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?|ttf|gif|webp|json|txt|xml)).*)'
  ]
};
```

The guard header `x-nonce-middleware: 1` is added to the internal re-fetch to prevent an infinite loop. When the middleware's own fetch triggers itself again, the guard makes it return a 404 immediately instead of recursing.

```js
// middleware.js — infinite-loop guard
if (request.headers.get('x-nonce-middleware') === '1') {
  return new Response(null, { status: 404 });
}

// Fetch static HTML from origin with guard header
originalResponse = await fetch(request.url, {
  headers: {
    ...Object.fromEntries(request.headers.entries()),
    'x-nonce-middleware': '1'
  },
  redirect: 'follow'
});
```

---

### Nonce Generation

16 random bytes from the Web Crypto API (`crypto.getRandomValues`) encoded as base64. This gives 128 bits of entropy — statistically impossible to guess or brute-force.

```js
// middleware.js — nonce generation
const randomBytes = new Uint8Array(16);
crypto.getRandomValues(randomBytes);
const nonce = btoa(String.fromCharCode(...randomBytes));
// Example output: "GcQcoE1zjPsrJ3pViMaTaQ=="
```

**Simultaneous uniqueness verified**: Two browser contexts firing `Promise.all([page1.goto(), page2.goto()])` at the exact same instant received different nonces:

```
Request 1: XbQ5l3nVowuuj5ZN6THblA==
Request 2: 9xMQVht4KoE7Ta1yaxDbbQ==
```

---

### Script Tag Injection

A single regex replaces **all** `<script>` tags — both inline scripts and external `src=` scripts. External scripts must also carry the nonce because `strict-dynamic` disables host-based allowlists; without the nonce attribute on a `<script src="…">` tag, it is blocked even if its host appears in the allowlist.

```js
// middleware.js — nonce injection regex
html = html.replace(
  /<script([^>]*)>/gi,
  (match, attrs) => {
    // Skip if nonce already present (avoid double-injection)
    if (/\bnonce\s*=/i.test(attrs)) return match;
    return `<script${attrs} nonce="${nonce}">`;
  }
);
```

All 11 script tags in the homepage receive the same per-request nonce:

| # | Script | Type | Nonce |
|---|---|---|---|
| 1 | GTM inline snippet | Inline | ✅ injected |
| 2 | Adobe Target prehiding | Inline | ✅ injected |
| 3 | adobeDataLayer init | Inline | ✅ injected |
| 4 | `assets.adobedtm.com/launch-…min.js` | External src | ✅ injected |
| 5 | `cdn.jsdelivr.net/cookieconsent.umd.js` | External src | ✅ injected |
| 6 | `cookieconsent-init.js` | External src | ✅ injected |
| 7 | Tealium loader IIFE | Inline | ✅ injected |
| 8 | gridboxLayer / datalayer init | Inline | ✅ injected |
| 9 | `/privacy-detect.js` | External src | ✅ injected |
| 10 | `analytics.js` | External src | ✅ injected |
| 11 | `app.js` | External src | ✅ injected |

---

### CSP Header Construction

The `Content-Security-Policy` header is assembled per-request with the nonce embedded in `script-src`.

```js
// middleware.js — full CSP header
const csp = [
  "default-src 'self'",

  // Nonce + strict-dynamic: the core. 'unsafe-inline' is ignored
  // by modern browsers when a nonce is present (CSP Level 2+).
  // Host allowlist is kept as legacy fallback for IE11 only.
  `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`
    + " https://www.googletagmanager.com"
    + " https://www.google-analytics.com"
    + " https://assets.adobedtm.com"
    + " https://tags.tiqcdn.com https://*.tiqcdn.com"
    + " https://cdn.jsdelivr.net",

  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",

  "connect-src 'self'"
    + " https://www.google-analytics.com"
    + " https://region1.google-analytics.com"      // GA4 regional
    + " https://region1.analytics.google.com"      // GA4 regional
    + " https://www.googletagmanager.com"
    + " https://assets.adobedtm.com"
    + " https://*.adobedc.net https://*.demdex.net https://*.omtrdc.net"
    + " https://tags.tiqcdn.com https://*.tiqcdn.com"
    + " https://collect.tealiumiq.com https://*.tealiumiq.com"
    + " https://cdn.jsdelivr.net",

  "object-src 'none'",      // blocks Flash and plugins entirely
  "base-uri 'none'",        // prevents <base> tag injection attacks
  "frame-src https://www.googletagmanager.com https://*.demdex.net",
  "report-uri /api/csp-report"
].join('; ');
```

| Directive | Purpose |
|---|---|
| `nonce-{value}` | Only scripts with this exact nonce attribute may execute |
| `strict-dynamic` | Scripts loaded dynamically by a nonce-bearing script are also trusted (covers Tealium sub-tags, GTM-injected scripts). Disables host allowlists for modern browsers |
| `unsafe-inline` | Ignored by modern browsers when nonce is present — kept as fallback for IE11 only |
| `object-src 'none'` | Blocks all plugin content (Flash, Silverlight, etc.) |
| `base-uri 'none'` | Prevents attackers from injecting a `<base>` tag to redirect relative URL resolution |
| `report-uri /api/csp-report` | Browsers POST violation reports to Vercel Edge Function — visible in Vercel dashboard → Functions tab |

---

### Cache Control — Critical Detail

Without an explicit cache directive, Vercel's edge CDN caches the first nonce-injected HTML response and serves the same bytes to every subsequent visitor. This means all visitors share one nonce — completely defeating per-request uniqueness.

```js
// middleware.js — cache busting headers
responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
responseHeaders.set('Surrogate-Control', 'no-store'); // Vercel/Fastly CDN layer
```

- `no-store` tells every cache layer (browser, CDN, proxy) not to retain the response at all.
- `Surrogate-Control: no-store` is the Vercel/Fastly-specific signal that overrides CDN behaviour regardless of the downstream `Cache-Control`.

---

## Tealium Loader Upgrade

All 14 HTML files were updated from the original 4-parameter Tealium snippet to the guarded 5-parameter version.

**Before — no guard (4 params):**

```js
(function(a,b,c,d){
  a='https://tags.tiqcdn.com/utag/cognizant-sandbox/f1racing/qa/utag.js';
  b=document; c='script'; d=b.createElement(c);
  d.src=a; d.type='text/java'+c; d.async=true;
  a=b.getElementsByTagName(c)[0]; a.parentNode.insertBefore(d,a);
})();
```

**After — guarded (5 params):**

```js
(function(a,b,c,d,e){
  a='https://tags.tiqcdn.com/utag/cognizant-sandbox/f1racing/qa/utag.js';
  b=document; c='script'; e='utag-unique';
  if(b.visibilityState!=='prerender' && b.getElementById(e)===null){
    d=b.createElement(c); d.src=a; d.id=e;
    d.type='text/java'+c; d.async=!0;
    a=b.getElementsByTagName(c)[0]; a.parentNode.insertBefore(d,a);
  }
})();
```

| Guard | What it prevents |
|---|---|
| `getElementById('utag-unique') === null` | Prevents `utag.js` loading twice if the snippet runs more than once (e.g. from both page HTML and a GTM Custom HTML tag). The injected script gets `id="utag-unique"`, so the second execution finds the element and skips |
| `visibilityState !== 'prerender'` | Skips loading Tealium on pre-rendered / invisible tabs (Chrome speculative prefetch). Prevents ghost analytics events firing for pages the user never actually sees |

### Why multiple Tealium scripts appear in DevTools

The loader snippet injects one `<script src="utag.js">`. `utag.js` then reads the Tealium profile and dynamically injects one script per enabled tag. This is Tealium's normal architecture — not a duplicate load.

```
Tealium script chain (expected)

inline IIFE  →  injects  →  utag.js  (the "brain")
                                 │
                    ├─ injects ─►  utag.12.js   Tag #12 — Adobe Analytics
                    ├─ injects ─►  utag.13.js   Tag #13 — Adobe Target
                    └─ injects ─►  utag.v.js    Tealium vendor library
```

`utag.12.js` and `utag.13.js` are not duplicates — they **are** your tags. To remove them, disable the tag in Tealium iQ → Publish.

---

## GA4 Regional Domains

GA4 routes beacon requests through regional subdomains. Without them in `connect-src`, `navigator.sendBeacon()` calls to regional endpoints are blocked. Two domains were added:

```js
// middleware.js
"connect-src 'self'"
  + " https://www.google-analytics.com"
  + " https://region1.google-analytics.com"   // ← added
  + " https://region1.analytics.google.com"   // ← added
  + ...
```

---

## Playwright Test Suite

All tests run against the live production URL (`racing-f1-rho.vercel.app`). Nonces are read from raw HTTP response bodies — not the DOM, where browsers strip nonce values after script execution.

**Test files:**
- `tests/verify-nonce-csp.spec.js` — main suite (6 tests)
- `tests/simultaneous-nonce.spec.js` — concurrent uniqueness test
- `tests/investigate-dollar-error.spec.js` — root cause investigation
- `tests/inspect-utag-scripts.spec.js` — Tealium script audit
- `tests/verify-utag-nonce.spec.js` — Tealium-specific nonce check

| # | Test | What it verifies | Result |
|---|---|---|---|
| 1 | CSP header contains nonce and strict-dynamic | Nonce format (≥20-char base64), `strict-dynamic` present, `unsafe-eval` absent, `object-src 'none'`, `base-uri 'none'`, `report-uri` | ✅ PASS |
| 2 | Nonce in CSP header matches inline script nonce attributes | Reads raw HTTP body. Extracts all `nonce="…"` attributes. Every script tag's nonce must equal the CSP header's nonce | ✅ PASS |
| 3 | Nonce is unique per page request (sequential) | Navigates 3 times sequentially. All 3 nonces must differ — proves CDN caching is disabled | ✅ PASS |
| 4 | No CSP violations on page load | Listens to browser console for CSP-related messages. Waits 4s after `domcontentloaded` for async scripts | ✅ PASS |
| 5 | CSP with nonce present on all site pages | Iterates all 10 pages (`/`, `/tickets`, `/merchandise`, `/cart`, `/checkout`, `/experiences`, `/calendar`, `/login`, `/register`, `/teams`) | ✅ PASS |
| 6 | GTM, Tealium and Adobe Launch still load after CSP | Checks `gtm.js`, `utag.js`, `launch-…min.js` network responses. Verifies globals: `dataLayer` ✅ `utag` ✅ `_satellite` ✅ `adobeDataLayer` ✅ | ✅ PASS |
| 7 | Two simultaneous requests get different nonces | `Promise.all([page1.goto(), page2.goto()])` — both start at the exact same instant. Both nonces must differ | ✅ PASS |

**Run the suite:**

```bash
npx playwright test tests/verify-nonce-csp.spec.js --reporter=list --project=chromium
npx playwright test tests/simultaneous-nonce.spec.js --reporter=list --project=chromium
```

---

### Manual Verification Commands

**Important**: Always use `view-source:` or curl — not DevTools Elements panel, which strips nonces from the DOM after execution.

```
view-source:https://racing-f1-rho.vercel.app
```
Press `Ctrl+F` → search `utag-unique` → nonce is visible on the `<script>` tag.

**PowerShell — verify nonces in raw HTTP response:**

```powershell
(Invoke-WebRequest -Uri "https://racing-f1-rho.vercel.app" `
  -UseBasicParsing).Content `
  | Select-String -Pattern 'nonce="[^"]*"' -AllMatches `
  | ForEach-Object { $_.Matches.Value } `
  | Select-Object -First 5
```

**PowerShell — check guarded Tealium snippet is live:**

```powershell
(Invoke-WebRequest -Uri "https://racing-f1-rho.vercel.app" `
  -UseBasicParsing).Content `
  | Select-String -Pattern 'utag-unique|function\(a,b,c,d,e\)'
```

**bash / macOS / Linux:**

```bash
curl -si https://racing-f1-rho.vercel.app | grep -o 'nonce="[^"]*"' | head -5
```

---

## Key Security Properties

### strict-dynamic and Host Allowlists

When `strict-dynamic` is present, browsers **ignore host-based allowlists** in `script-src` for modern contexts. A `<script src="https://assets.adobedtm.com/…">` tag is NOT trusted just because `assets.adobedtm.com` is in the allowlist — it must also carry the nonce attribute. The middleware handles this by applying the nonce regex to **all** script tags, not just inline ones.

Scripts dynamically created by a nonce-bearing parent script (e.g. `utag.js` injecting `utag.12.js`, GTM injecting its own scripts) are trusted by `strict-dynamic` without needing their own nonces. This is what makes Tealium tag injection and GTM container scripts work correctly.

### unsafe-inline Interaction with Nonce

`unsafe-inline` is present in the policy for legacy browser fallback (IE11, very old Safari). Modern browsers (Chrome, Firefox, Edge, Safari 12+) implementing CSP Level 2 or 3 **ignore** `unsafe-inline` entirely when a nonce is present. The nonce is the effective enforcement mechanism.

### Nonce Hiding — Browser Security Feature

After a script executes, browsers clear the `nonce` property on the DOM element. DevTools Elements panel, `element.nonce`, and `element.getAttribute('nonce')` all return an empty string. This is intentional: it prevents other JavaScript from reading the nonce and constructing a rogue `<script>` tag that the browser would then trust.

```
DevTools Elements panel (nonce hidden):
  <script type="text/javascript" nonce="">   ← browser strips value

view-source / curl (real nonce):
  <script type="text/javascript" nonce="u3/nmuWsXr3nnXHXje6uIw==">
```

Always verify nonces from raw HTTP response bodies. Playwright tests read nonces via the `response` event listener which captures raw bytes before the browser processes them.

---

## Known Issues (Not CSP-Related)

### `$ is not defined` — 3 occurrences

Source traced via Playwright stack inspection (`tests/investigate-dollar-error.spec.js`):

**Errors 1 & 2** — Adobe Launch custom code:
```
ReferenceError: $ is not defined
    at <anonymous>:2:1
    at launch-53116e4becf9.min.js:6:27974   ← Launch runtime eval
```
Adobe Tags has custom code Rule actions calling `$(...)`. Launch's runtime evals these at rule execution time but jQuery is not globally loaded.

**Error 3** — Target activity code:
```
ReferenceError: $ is not defined
    at window.onload (<anonymous>:4:1)
```
An Adobe Target A/B activity is injecting a `window.onload` function that calls `$()`.

**Fix (Adobe Tags UI):**
- Open Tags → Properties → F1 Racing → Rules → each Custom Code action
- Replace `$('selector')` → `document.querySelector('selector')`
- Replace `$('.class')` → `document.querySelectorAll('.class')`
- Replace `$(document).ready(fn)` → `document.addEventListener('DOMContentLoaded', fn)`
- Save → Build → Publish

**Fix (Adobe Target):**
- Open Target → Activities → A/B Test → Edit
- Remove `$` references from VEC custom code modifications

---

## Pending: Solution 2B — Tealium First-Party CNAME

Removes `tags.tiqcdn.com` from the CSP allowlist entirely by routing Tealium through your own subdomain.

```
Current
Browser  ──►  tags.tiqcdn.com  (third-party origin in script-src)

After Solution 2B
Browser  ──►  tealium.racing-f1.com  (CNAME → Tealium CloudFront)
              First-party origin — removable from allowlist
```

| Step | Where | Action |
|---|---|---|
| 1 | Tealium iQ console | Enable First-Party Domain feature → enter subdomain (e.g. `tealium.racing-f1.com`) |
| 2 | DNS provider | Add CNAME: `tealium.racing-f1.com` → Tealium's CloudFront hostname (shown in Tealium console) |
| 3 | `middleware.js` | Replace `tags.tiqcdn.com https://*.tiqcdn.com` with `https://tealium.racing-f1.com` in both `script-src` and `connect-src` |
| 4 | All HTML files | Update Tealium loader IIFE URL from `tags.tiqcdn.com/utag/…` to `tealium.racing-f1.com/utag/…` |
