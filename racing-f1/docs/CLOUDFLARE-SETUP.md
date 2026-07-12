# Cloudflare Setup Guide — Racing F1

> **Strategy: Cloudflare Proxy in front of Vercel (Option A)**  
> Cloudflare handles DNS, CDN, WAF, bot rules, and AI policies.  
> Vercel continues to run all serverless functions (`/api/mcp`, middleware, etc.).  
> Zero code changes required.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Step 1 — Add Site to Cloudflare](#2-step-1--add-site-to-cloudflare)
3. [Step 2 — Import DNS Records](#3-step-2--import-dns-records)
4. [Step 3 — Configure Vercel Custom Domain](#4-step-3--configure-vercel-custom-domain)
5. [Step 4 — SSL / TLS Settings](#5-step-4--ssl--tls-settings)
6. [Step 5 — Performance Settings](#6-step-5--performance-settings)
7. [Step 6 — Security & WAF Rules](#7-step-6--security--waf-rules)
8. [Step 7 — AI Bot Policy (robots.txt)](#8-step-7--ai-bot-policy-robotstxt)
9. [Step 8 — Cache Rules](#9-step-8--cache-rules)
10. [Step 9 — Update Project Files](#10-step-9--update-project-files)
11. [Step 10 — Verify Everything Works](#11-step-10--verify-everything-works)
12. [Troubleshooting](#12-troubleshooting)
13. [What Cloudflare Adds vs Vercel Alone](#13-what-cloudflare-adds-vs-vercel-alone)

---

## 1. Architecture Overview

```
User Browser
    │
    ▼
Cloudflare Edge (150+ PoPs globally)
    ├─ DNS resolution
    ├─ DDoS protection
    ├─ WAF (Web Application Firewall)
    ├─ CDN cache (HTML, CSS, JS, images)
    ├─ Bot management (AI crawler rules)
    ├─ SSL termination
    │
    ▼  (proxied, origin IP hidden)
Vercel Edge Network
    ├─ Next.js / static HTML serving
    ├─ /api/mcp.js  (MCP server → Tealium)
    ├─ middleware.js (bot detection → Tealium)
    └─ All serverless functions unchanged
```

**Key point:** Vercel keeps doing everything it does now. Cloudflare sits in front and adds speed + security.

---

## 2. Step 1 — Add Site to Cloudflare

### 2.1 Create a Cloudflare account

Go to https://dash.cloudflare.com/sign-up if you don't have one.

### 2.2 Add your domain

1. Click **Add a Site** in the Cloudflare dashboard
2. Enter your domain name (e.g. `racing-f1.com`)
3. Click **Continue**
4. Select the **Free** plan (sufficient for this project) → **Continue**

### 2.3 Nameserver change

Cloudflare will show you **two nameservers**, e.g.:
```
ada.ns.cloudflare.com
bob.ns.cloudflare.com
```

Go to your domain registrar (GoDaddy / Namecheap / Google Domains etc.) and replace the existing nameservers with these two Cloudflare nameservers.

> **Propagation time:** 5 minutes to 48 hours. Usually done within 30 minutes.

You will receive an email from Cloudflare when the nameservers are verified.

---

## 3. Step 2 — Import DNS Records

Cloudflare will automatically scan and import DNS records from your current registrar.

### 3.1 What you need

You need one DNS record pointing your domain to Vercel:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| `CNAME` | `@` (root) | `cname.vercel-dns.com` | ✅ Proxied (orange cloud) |
| `CNAME` | `www` | `cname.vercel-dns.com` | ✅ Proxied (orange cloud) |

> **Important:** Make sure the cloud icon is **orange (proxied)**, not grey (DNS only).  
> Orange = traffic goes through Cloudflare.  
> Grey = Cloudflare just resolves DNS, no protection/CDN.

### 3.2 Add records manually if not auto-imported

In Cloudflare → **DNS** → **Records** → **Add record**:

```
Type:    CNAME
Name:    @
Target:  cname.vercel-dns.com
Proxy:   Proxied ✅
TTL:     Auto
```

```
Type:    CNAME
Name:    www
Target:  cname.vercel-dns.com
Proxy:   Proxied ✅
TTL:     Auto
```

---

## 4. Step 3 — Configure Vercel Custom Domain

Vercel needs to know about your custom domain so it serves your site for requests coming from it.

### 4.1 Add domain in Vercel

1. Go to https://vercel.com/dashboard
2. Open your **racing-f1** project
3. Go to **Settings** → **Domains**
4. Click **Add** → enter your domain (e.g. `racing-f1.com`)
5. Also add `www.racing-f1.com`
6. Vercel will show a verification status — once Cloudflare DNS is live, it will turn green

### 4.2 What Vercel shows after setup

```
racing-f1.com          ✅ Valid Configuration
www.racing-f1.com      ✅ Valid Configuration
racing-f1-rho.vercel.app  ✅ (original URL still works)
```

> The original `racing-f1-rho.vercel.app` URL continues to work even after adding a custom domain.

---

## 5. Step 4 — SSL / TLS Settings

### 5.1 Set encryption mode

In Cloudflare → **SSL/TLS** → **Overview**:

Select: **Full (strict)**

```
Browser → Cloudflare:  HTTPS ✅
Cloudflare → Vercel:   HTTPS ✅  (Vercel has a valid cert)
```

> Do NOT use "Flexible" — it sends traffic to Vercel over HTTP which breaks things.

### 5.2 Enable HSTS (already in your vercel.json headers)

In Cloudflare → **SSL/TLS** → **Edge Certificates**:

- **Always Use HTTPS** → ON
- **HTTP Strict Transport Security (HSTS)** → Enable
  - Max Age: 12 months
  - Include subdomains: ON
  - Preload: ON

### 5.3 Minimum TLS version

In Cloudflare → **SSL/TLS** → **Edge Certificates**:
- **Minimum TLS Version** → TLS 1.2

---

## 6. Step 5 — Performance Settings

### 6.1 Speed → Optimization

In Cloudflare → **Speed** → **Optimization**:

| Setting | Value | Reason |
|---------|-------|--------|
| Auto Minify — JavaScript | ✅ ON | Smaller JS files |
| Auto Minify — CSS | ✅ ON | Smaller CSS |
| Auto Minify — HTML | ✅ ON | Smaller HTML |
| Brotli compression | ✅ ON | Better than gzip |
| HTTP/2 | ✅ ON (default) | Faster multiplexing |
| HTTP/3 (QUIC) | ✅ ON | Even faster |
| 0-RTT Connection Resumption | ✅ ON | Faster reconnects |

### 6.2 Rocket Loader

**Rocket Loader** → **OFF**

> Rocket Loader defers JavaScript loading. It can interfere with Adobe Launch and the ACDL — leave it off.

### 6.3 Polish (image optimization)

In Cloudflare → **Speed** → **Optimization** → **Polish**:
- Polish → **Lossless** (compresses images without quality loss)
- WebP → **ON** (converts images to WebP for supported browsers)

---

## 7. Step 6 — Security & WAF Rules

### 7.1 Security level

In Cloudflare → **Security** → **Settings**:
- **Security Level** → **Medium**
- **Browser Integrity Check** → **ON**
- **Privacy Pass Support** → **ON**

### 7.2 WAF — Managed Rules

In Cloudflare → **Security** → **WAF** → **Managed rules**:

Enable:
- **Cloudflare Managed Ruleset** ✅
- **Cloudflare OWASP Core Ruleset** ✅

These block SQL injection, XSS, and other OWASP Top 10 attacks at the Cloudflare edge before they reach Vercel.

### 7.3 Custom WAF Rule — Protect /api/mcp

In Cloudflare → **Security** → **WAF** → **Custom rules** → **Create rule**:

**Rule: Rate limit MCP endpoint**
```
Rule name:    Rate limit /api/mcp
Expression:   (http.request.uri.path eq "/api/mcp")
Action:       Rate limit
Rate:         100 requests per minute per IP
Action when limit reached: Block (429)
```

This prevents abuse of your MCP server endpoint.

### 7.4 DDoS Protection

Cloudflare's DDoS protection is automatic and always on. No configuration needed.

---

## 8. Step 7 — AI Bot Policy (robots.txt)

This is what you saw on the Cloudflare setup screen. Here's what each setting means and what to choose for this project.

### 8.1 Cloudflare AI Settings

In Cloudflare → **Security** → **Bots** (or during initial setup):

| Policy | Setting | Reason |
|--------|---------|--------|
| **Search** | `enabled` | Allow Google/Bing to index your site |
| **Agent** | `disabled` | Block AI agents from scraping (your Tealium tracking detects them anyway) |
| **Training** | `disabled` | Block AI training crawlers |
| Block in robots.txt | `enabled` | Add Cloudflare-managed robots.txt rules |

### 8.2 What Cloudflare generates in robots.txt

With the above settings, Cloudflare adds to your `robots.txt`:

```
User-agent: GPTBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Omgilibot
Disallow: /
```

### 8.3 How this works WITH your existing Tealium bot tracking

Both systems work together:

```
AI Bot Request
    │
    ▼
Cloudflare checks robots.txt policy
    ├─ Compliant bots (respect robots.txt) → BLOCKED at edge (never reaches Vercel)
    └─ Non-compliant bots → pass through
           │
           ▼
        Vercel middleware.js
           └─ bot-detection.js detects User-Agent
                  └─ Fires Tealium ai_crawler_visit event ✅
```

Compliant bots are blocked at Cloudflare (saves Vercel bandwidth).  
Non-compliant bots still hit Vercel and get tracked in Tealium EventStream.

---

## 9. Step 8 — Cache Rules

By default Cloudflare caches static assets. You need to make sure API routes and dynamic pages are NOT cached.

### 9.1 Create cache rule — bypass for /api/*

In Cloudflare → **Caching** → **Cache Rules** → **Create rule**:

**Rule 1: Bypass cache for API**
```
Rule name:    No cache for /api/*
Expression:   (starts_with(http.request.uri.path, "/api/"))
Cache status: Bypass
```

This ensures `/api/mcp` responses are never cached — every MCP call hits Vercel fresh.

**Rule 2: Bypass cache for .well-known**
```
Rule name:    No cache for .well-known
Expression:   (starts_with(http.request.uri.path, "/.well-known/"))
Cache status: Bypass
```

**Rule 3: Cache static assets aggressively**
```
Rule name:    Cache static assets
Expression:   (http.request.uri.path.extension in {"js" "css" "png" "jpg" "webp" "woff2" "ico"})
Cache status: Cache
Edge TTL:     1 month
Browser TTL:  1 day
```

### 9.2 Purge cache after deployment

After every Vercel deployment, purge Cloudflare cache:

In Cloudflare → **Caching** → **Configuration** → **Purge Cache** → **Purge Everything**

Or via Cloudflare API (automate this):
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## 10. Step 9 — Update Project Files

After your custom domain is live, update these files:

### 10.1 `.well-known/mcp.json`

```json
{
  "schema_version": "v1",
  "name": "F1 Racing Store MCP",
  "description": "Query F1 race tickets, merchandise, race calendar, and VIP experiences.",
  "server_url": "https://YOUR-DOMAIN.com/api/mcp",
  "protocol": "MCP/1.0",
  "transport": "http",
  "auth": { "type": "none" },
  "tools": [
    { "name": "get_tickets",     "description": "Get available F1 race tickets with pricing, categories, and availability" },
    { "name": "get_merchandise", "description": "Browse F1 official merchandise — apparel, accessories, collectibles by team" },
    { "name": "get_calendar",    "description": "Get the 2026 F1 World Championship race calendar with circuit details" },
    { "name": "get_experiences", "description": "Get VIP F1 experiences — hospitality suites, pit lane walks, driver meet & greets" }
  ]
}
```

### 10.2 `.well-known/ai-plugin.json`

Update the `api.url` field:
```json
{
  "api": {
    "type": "openapi",
    "url": "https://YOUR-DOMAIN.com/api/mcp-openapi.json"
  }
}
```

### 10.3 `playwright.config.js`

```js
use: {
  baseURL: process.env.BASE_URL || 'https://YOUR-DOMAIN.com',
  // ... rest unchanged
}
```

### 10.4 Vercel environment variables

In Vercel → **Settings** → **Environment Variables**, add:

```
SITE_URL = https://YOUR-DOMAIN.com
```

The `TEALIUM_COLLECT_URL` stays unchanged — it still points to Tealium directly.

### 10.5 CORS in `api/mcp.js`

Add your new domain to CORS allowed origins. Find the CORS header line and add your domain:

```js
res.setHeader('Access-Control-Allow-Origin', '*');
// OR if you want to restrict:
const allowed = ['https://YOUR-DOMAIN.com', 'https://racing-f1-rho.vercel.app'];
const origin = req.headers.origin;
if (allowed.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

---

## 11. Step 10 — Verify Everything Works

Run this checklist after setup:

### 11.1 DNS propagation check

```bash
# Check if your domain resolves through Cloudflare
nslookup YOUR-DOMAIN.com
# Should return Cloudflare IPs (104.x.x.x or 172.x.x.x)

# Or use online tool:
# https://www.whatsmydns.net/
```

### 11.2 SSL certificate check

```bash
curl -I https://YOUR-DOMAIN.com
# Look for:
# HTTP/2 200
# cf-ray: ... (proves traffic went through Cloudflare)
# strict-transport-security: max-age=...
```

### 11.3 MCP server check

```bash
curl -X POST https://YOUR-DOMAIN.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Should return the 4 tool definitions
```

### 11.4 Run Playwright tests against new domain

```powershell
$env:BASE_URL="https://YOUR-DOMAIN.com"
npx playwright test tests/datalayer-diff-validator.spec.js tests/single-product-purchase-validation.spec.js --project=chromium
```

### 11.5 Check Cloudflare is proxying (not DNS-only)

```bash
curl -I https://YOUR-DOMAIN.com
# Must see this header:
# cf-ray: 8a1b2c3d4e5f6789-LHR
```

If `cf-ray` header is present → Cloudflare is active. ✅

### 11.6 Verify Tealium still receives events

1. Login to Tealium iQ → **cookieless-demo** → **EventStream** → **Live Events**
2. Visit your new domain in a browser
3. Events should appear within 3 seconds with `page_url` showing your new domain

### 11.7 Verify Adobe Analytics still fires

```powershell
npx playwright test tests/acdl-event-validator.spec.js --project=chromium
# All 39 checks should pass against new domain
```

---

## 12. Troubleshooting

### Domain shows "Vercel 404" after Cloudflare setup

**Cause:** Vercel doesn't know about your domain yet.  
**Fix:** Add the domain in Vercel → Settings → Domains.

---

### SSL error: `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`

**Cause:** SSL mode set to "Flexible" in Cloudflare.  
**Fix:** Change to **Full (strict)** in Cloudflare → SSL/TLS → Overview.

---

### `/api/mcp` returns cached stale response

**Cause:** Cloudflare is caching the API response.  
**Fix:** Create a cache bypass rule for `/api/*` (Step 8 above).

---

### Adobe Launch / ACDL events not firing

**Cause:** Rocket Loader is deferring scripts and breaking Adobe Launch load order.  
**Fix:** In Cloudflare → Speed → Optimization → turn **Rocket Loader OFF**.

---

### MCP server works on Vercel URL but not on custom domain

**Cause:** CORS not allowing the new origin.  
**Fix:** Update `Access-Control-Allow-Origin` in `api/mcp.js` to include your new domain.

---

### Cloudflare blocking legitimate users

**Cause:** WAF security level too high.  
**Fix:** In Security → Settings, reduce Security Level from "High" to "Medium".

---

### Playwright tests fail on new domain

**Cause:** `baseURL` still pointing to `racing-f1-rho.vercel.app`.  
**Fix:**
```powershell
$env:BASE_URL="https://YOUR-DOMAIN.com"
npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium
```

---

## 13. What Cloudflare Adds vs Vercel Alone

| Feature | Vercel alone | With Cloudflare |
|---------|-------------|-----------------|
| CDN nodes | ~30 regions | 310+ PoPs globally |
| DDoS protection | Basic | Enterprise-grade (unlimited) |
| WAF | None | OWASP managed rules + custom |
| Bot management | None (you built custom) | Cloudflare Bot Fight Mode + your custom |
| AI crawler blocking | Your middleware.js | Cloudflare edge + middleware.js |
| Cache control | Vercel edge cache | Cloudflare CDN + Vercel (two layers) |
| SSL | Vercel cert | Cloudflare cert (Vercel cert for origin) |
| Analytics | Vercel analytics | Cloudflare Web Analytics (free, no JS) |
| Load time | Good | Faster (Brotli + HTTP/3 + edge cache) |
| Origin IP hidden | No | Yes (Vercel IP never exposed) |
| Rate limiting | None | Custom rules per endpoint |
| Cost | Free tier | Free tier (sufficient for this project) |

---

## Quick Setup Checklist

```
□ 1. Add site to Cloudflare dashboard
□ 2. Change nameservers at domain registrar
□ 3. Wait for nameserver verification email
□ 4. Verify DNS records are imported (CNAME → cname.vercel-dns.com, proxied)
□ 5. Add custom domain in Vercel → Settings → Domains
□ 6. Set SSL mode to Full (strict)
□ 7. Turn ON: Always Use HTTPS, HSTS, Brotli, HTTP/3
□ 8. Turn OFF: Rocket Loader
□ 9. Enable WAF managed rules (Cloudflare + OWASP)
□ 10. Add cache bypass rule for /api/* and /.well-known/*
□ 11. Set AI bot policy (Agent: disabled, Training: disabled)
□ 12. Add rate limit rule for /api/mcp (100 req/min)
□ 13. Update .well-known/mcp.json server_url to new domain
□ 14. Update .well-known/ai-plugin.json api.url to new domain
□ 15. Update playwright.config.js baseURL to new domain
□ 16. Run: curl -I https://YOUR-DOMAIN.com → verify cf-ray header
□ 17. Run: Playwright full suite against new domain → all pass
□ 18. Verify Tealium EventStream shows events from new domain
```

---

*Once Cloudflare is live, the original `racing-f1-rho.vercel.app` URL still works — you can keep it as a fallback or for internal testing.*
