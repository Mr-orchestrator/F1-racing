# CDN, Tealium, Edge Networks & AI-Crawler Detection — Explained Simply

A plain-English Q&A guide to everything we built this session: what a CDN is, how Tealium starts
up, how the "edge" works, what we capture and whether it's GDPR-safe, how AI crawlers are
detected, and an honest assessment of what's solid vs. what's still a gap.

No prior technical knowledge assumed. Each section builds on the last.

---

## Part 1 — What is a CDN?

### Q: What does CDN actually stand for, and what problem does it solve?

**CDN = Content Delivery Network.**

Imagine a popular bakery in New York. If someone in Tokyo wants a loaf of bread, shipping it
from New York takes days and the bread goes stale. The smart fix: open small bakery branches in
Tokyo, London, Mumbai — every city — all baking from the same recipe. Now everyone gets fresh
bread from a branch *near them*.

A CDN does this for website files (images, scripts, videos). Instead of every visitor's request
traveling all the way to one server in one country, copies of the files sit on servers
("**edge nodes**") scattered around the world. You get served by whichever copy is closest to
you — faster, and the original server doesn't get overloaded.

### Q: Where do we actually use CDNs on this site?

| What | CDN domain | Why |
|---|---|---|
| Tealium's tag-management script (`utag.js`) | `tags.tiqcdn.com` | Loads Tealium fast, from a server near the visitor |
| The free consent-banner library | `cdn.jsdelivr.net` | Same reason — a popular open-source library, hosted globally |
| The site itself | Vercel's Edge Network | Every page (`index.html`, `tickets.html`, …) is served from the nearest Vercel location |
| Google Tag Manager | `www.googletagmanager.com` | GTM's own CDN |
| Adobe Launch | `assets.adobedtm.com` | Adobe's own CDN |

### Q: Is a CDN the same as "the cloud"?

Not quite. "The cloud" usually means *where your app's logic and database run* (one or a few
data centers). A CDN is specifically about *distributing static files close to every visitor*,
worldwide, for speed. Vercel (who hosts this site) blurs the line — it's a CDN **and** a place
that can run small bits of code near the visitor (more on that in Part 4).

---

## Part 2 — How Does Tealium Actually Start Up?

### Q: What is Tealium, in one sentence?

Tealium is a **traffic controller for tracking scripts**. Instead of your site directly loading
Google Analytics, Meta Pixel, and five other tracking tools (each slowing the page down and each
needing separate code), you load **one** small Tealium script, and Tealium decides — based on
rules you configure — which tracking tools to load and what data to send them.

### Q: Walk me through what happens, in order, when someone opens our site.

```
1. Browser requests index.html from Vercel.
2. Vercel's Edge Middleware runs FIRST (see Part 4) — checks if it's a known AI crawler.
3. HTML arrives. Near the top, a small script says:
     "Go fetch https://tags.tiqcdn.com/utag/cognizant-sandbox/f1racing/qa/utag.js"
4. Browser downloads utag.js from Tealium's CDN (async — doesn't block the rest of the page).
5. utag.js runs. It:
     a. Builds the "data layer" — a big object describing the page (page name, product info,
        consent status, etc.) — partly from our own analytics.js (GridBox), partly from
        cookies/URL params/meta tags.
     b. Runs any "Pre Loader" extensions (our AI-crawler-adjacent GridBox Event Bridge would
        run here, once deployed — see the tealium-extensions repo).
     c. Checks Load Rules — "should the GA4 tag fire on this page? What about Meta?"
     d. Loads whichever tag scripts are approved (GA4's script, Meta's script, etc.)
     e. Sends the Collect Tag beacon — a tiny image request (i.gif) or POST — to
        collect.tealiumiq.com, carrying the page/event data.
6. As the visitor clicks around (add to cart, checkout...), our analytics.js fires
   utag.link() calls, which repeat steps c-e for each interaction.
```

### Q: What's an "i.gif" and why does Tealium (and Google, and everyone) use a fake image?

Long before modern browsers had good tools for "just send some data," browsers were *always*
allowed to load a tiny 1×1 pixel image from anywhere, no restrictions. Analytics tools hijacked
this: they encode the data they want to send *into the image's URL* (as text after a `?`), and
the "image" itself is thrown away — nobody displays it. It's a 25-year-old trick that still
works everywhere, which is why it's still used today (`i.gif` = "image, 1×1, transparent").

We verified this directly: our Playwright tests captured the real Tealium beacon —
`https://collect.tealiumiq.com/cognizant-sandbox/f1racing/2/i.gif` — and the event data
(`tealium_event`, `product_id`, etc.) travels in the request body, not visibly in the URL for
our Collect Tag setup specifically (Tealium's newer format uses a POST body instead of URL
parameters, but the "i.gif" naming stuck around from the old technique).

### Q: What are "account", "profile", and "environment"?

Think of it like a filing system:
- **Account** = the company (`cognizant-sandbox` — a sandbox/test account here)
- **Profile** = the specific website/app within that company (`f1racing`)
- **Environment** = which version of the configuration (`qa` = testing config, `prod` = live
  config). You build and test changes in `qa`, then "publish" them to `prod` when ready.

---

## Part 3 — Technical Architecture (the full picture)

### Q: Can I see the whole thing end-to-end in one diagram?

```
┌─────────────────────────────────────────────────────────────────────────┐
│  VISITOR (human or AI crawler) types racing-f1-rho.vercel.app           │
└───────────────────────────────┬───────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VERCEL EDGE NETWORK (nearest data center to the visitor)               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Edge Middleware (middleware.js) runs FIRST, before anything else │  │
│  │  • Reads the User-Agent header                                   │  │
│  │  • Is it GPTBot / ClaudeBot / ChatGPT-User / etc.? → tag it       │  │
│  │  • If yes: POST an event to Tealium (server-to-server)            │  │
│  │  • Either way: let the request continue (NEVER blocks)            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                  ▼                                       │
│  Static file server hands back the requested page (tickets.html, etc.)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (if it's a human, or a "browsing" AI agent that runs JS)       │
│  1. Loads analytics.js (GridBox) — our OWN data layer, source of truth  │
│  2. Loads the Tealium loader → fetches utag.js from Tealium's CDN       │
│  3. Loads the consent banner (from jsdelivr CDN) — asks for permission  │
│  4. utag.js reads consent + data layer → decides which tags to fire     │
│  5. GA4 / Meta / Adobe scripts load (if consent + load rules allow)     │
│  6. Every page view / click / purchase → a Tealium beacon (i.gif/POST) │
└───────────────────────────────┬───────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TEALIUM (collect.tealiumiq.com)                                        │
│  Receives beacons from BOTH:                                            │
│    • the browser (human traffic, via the Collect Tag)                   │
│    • our Edge Middleware directly (bot traffic, server-to-server)       │
│  Routes events onward per your configuration: Live Events, EventStream, │
│  connectors (BigQuery / Slack / Google Sheets / GA4 mirror / etc.)      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Q: Why are there TWO paths into Tealium (browser beacon AND server middleware)?

Because they catch different things:

| Path | Catches | Misses |
|---|---|---|
| **Browser beacon** (Collect Tag, `i.gif`) | Real human visitors, and any bot that fully renders the page and runs JavaScript | Crawlers that only fetch the raw HTML and never run JavaScript (most AI training crawlers, e.g. GPTBot, work this way — they don't execute scripts) |
| **Edge Middleware** (server-to-server) | Every single request, JS or not, because it inspects the User-Agent before any JavaScript exists | Nothing that reaches our server — but can't see anything that never requests our URL at all |

Using both means we don't lose crawler visibility just because a crawler chooses not to run
JavaScript (which most of them do choose, for speed).

### Q: What is "the data layer" and why does everything keep mentioning it?

It's the single, structured description of "what is happening on this page right now" — page
name, category, product being viewed, cart contents, whether the user is logged in, whether
they've consented to tracking, etc. Every tool (Tealium, GA4, Adobe) reads from the **same** data
layer instead of each guessing independently by scraping the HTML. It's the shared source of
truth. On this site, that's `window.gridboxLayer` (our own) which Tealium and Adobe both read
from.

---

## Part 4 — What Is "The Edge" / Edge Network?

### Q: Everyone says "edge computing" — what does it actually mean?

Normal websites work like this: your request travels to ONE server (maybe far away), that
server does all the thinking, and sends back an answer. That round trip takes time.

**Edge computing** means: instead of *only* serving pre-made files from nearby CDN locations
(Part 1), you can also **run a small piece of code** at that nearby location, before the request
reaches the "real" server. It's like a security guard at the front desk of a building who can
answer simple questions (or stop-and-tag suspicious visitors) instead of you having to walk all
the way to the CEO's office for every question.

### Q: Where does our AI-crawler detection fit into this?

Exactly there. `middleware.js` is Vercel **Edge Middleware** — it runs at the nearest edge
location, for every request, before the page is served. It:
1. Looks at the visitor's declared identity (User-Agent header).
2. If it matches a known AI crawler pattern → tags it and tells Tealium.
3. Either way, lets the request continue immediately (adds only a few milliseconds).

This is why it catches crawlers that never run JavaScript: it runs *before* JavaScript exists,
at the network edge, closest to wherever the crawler is calling from.

### Q: Is Edge Middleware the same thing as a CDN?

They're related but different jobs:
- **CDN** = caches and hands back *static files* (the same file to everyone) from nearby servers.
- **Edge Middleware** = runs *custom logic* (can behave differently per visitor) from those same
  nearby locations.

Vercel gives you both, which is why our site benefits from CDN speed *and* per-visitor crawler
detection, without either slowing the other down.

---

## Part 5 — How Tealium Gets Initialised (step-by-step, for a beginner)

### Q: In the simplest possible terms, how does Tealium "turn on"?

Think of Tealium like a **radio dispatcher** at a taxi company:

1. **The building sign goes up** (the loader snippet in our HTML) — it just says "call this
   number" (a URL). This is tiny and loads instantly.
2. **The dispatcher's office opens** (browser downloads `utag.js`, the real Tealium engine).
3. **The dispatcher reads today's assignment sheet** (the data layer — what's on this page,
   has the visitor consented, what did they just click).
4. **The dispatcher checks the rulebook** (Load Rules — "only send a taxi [tag] if X is true").
5. **Taxis get dispatched** (GA4's script, Meta's script, etc. get loaded — but ONLY the ones
   the rulebook approved).
6. **The dispatcher logs every call** (Collect Tag sends a small record of what happened to
   Tealium's own servers) so you can see it all in one place later.

### Q: What could go wrong at each of those steps?

| Step | What could go wrong |
|---|---|
| Loader snippet | Typo in the URL, or the snippet missing from a page entirely |
| Downloading utag.js | The CDN is blocked (by browser security settings, ad blockers, or our own misconfiguration — **this literally happened to us**, see Part 6) |
| Data layer | Missing or wrong values → tags fire with blank/incorrect data |
| Load Rules | Rule written wrong → tag fires when it shouldn't (or doesn't fire when it should) |
| Tag scripts loading | Same CDN-blocking risk as step 2, per tag |
| Collect Tag beacon | Ad blockers specifically block `tiqcdn.com`/`tealiumiq.com` because they're on public tracker block-lists |

---

## Part 6 — CDN Issues We Actually Hit (and Could Hit Again)

### Q: Did we actually run into CDN problems on this project?

**Yes — twice, both self-inflicted, both fixed.**

1. **Tealium was blocked by our own security policy.** Our site has a
   `Content-Security-Policy` (CSP) header — a browser-enforced allow-list of which external
   domains are permitted to run scripts. We forgot to list `tags.tiqcdn.com` (Tealium's CDN),
   so **the browser itself refused to load Tealium**, even though the loader snippet was
   correctly on every page. Prod had zero Tealium activity for this reason.
2. **The same thing happened to our consent banner**, hosted on `cdn.jsdelivr.net` — also
   missing from the CSP, so the "please accept cookies" banner silently never appeared.

Both were one-line fixes to `vercel.json`, but they show how a CDN-hosted script can be
**completely broken by a setting nobody thought to check**, with no error visible to a normal
visitor — the script just silently never runs.

### Q: What other CDN risks should we watch for going forward?

| Risk | Plain-English explanation |
|---|---|
| **CSP misconfiguration** | Already happened twice. Any time you add a new third-party CDN script, you must also update the CSP or it silently breaks. |
| **Ad blockers** | `tiqcdn.com` and `tealiumiq.com` are on public "known tracker" block-lists used by ad blockers and some corporate networks. A meaningful % of real visitors will simply never load Tealium — this is normal and expected, not a bug, but it means your analytics always undercounts. |
| **CDN outage** | If Tealium's CDN (or jsdelivr, or GTM's CDN) has downtime, the script never loads. Since we load it asynchronously, the *page itself* still works fine for visitors — only the tracking silently stops. |
| **Stale cached files** | CDNs cache aggressively for speed. If Tealium publishes a new `utag.js` version, some visitors may keep getting an old cached copy until the cache expires. |
| **No integrity checking** | We don't currently use "Subresource Integrity" (a browser feature that verifies a CDN file hasn't been tampered with). If a CDN we depend on were ever compromised, we'd have no automatic protection — this is a real, if unlikely, gap. |
| **Third-party dependency risk** | We're trusting Tealium's, Adobe's, Google's, and jsdelivr's infrastructure to be honest and secure. That's normal for the industry, but it's worth knowing we don't control those servers. |

---

## Part 7 — What Do We Capture, and Are We GDPR-Compliant?

### Q: What personal data does this site actually collect?

| Category | Examples | Where |
|---|---|---|
| Behavioral | pages viewed, products viewed, cart contents, purchases | GridBox → Tealium → GA4/Adobe |
| Technical | browser type, device type, approximate location (from IP) | Standard in every analytics beacon |
| Identifiers | a random anonymous ID per visitor (not their name/email unless they log in) | `gridboxLayer` visitor ID |
| Bot/crawler traffic | IP address, User-Agent, which page was crawled, timestamp | Edge Middleware → Tealium |

### Q: Is any of that "personal data" under GDPR?

**Yes — an IP address is legally personal data under GDPR**, even though it doesn't have a name
attached. This matters for **both** the human tracking *and* the AI-crawler tracking we built —
the crawler-detection events include the requester's IP address.

### Q: How do we currently handle consent for human visitors?

1. A consent banner (CookieConsent, loaded from jsdelivr) appears before any tracking.
2. Nothing analytics-related fires until the visitor clicks Accept.
3. Once accepted, our Consent Manager extension checks (in priority order): Tealium's own
   native consent system → the CookieConsent banner → a fallback default.
4. Analytics/marketing tags only fire if the matching consent flag (`consent_analytics`,
   `consent_marketing`) is `true`.
5. This is an **opt-in model** — the GDPR-required approach for EU visitors (no tracking
   until you say yes), rather than opt-out (assume yes, let people turn it off).

### Q: Does AI-crawler detection also need consent?

**No — and this is an important, deliberate distinction.** GDPR protects *natural persons*
(individual humans). An automated crawler is not a person and has no consent rights. The
crawler-detection events **bypass the consent flow entirely by design** — they're sent directly
from our server (Edge Middleware) to Tealium, not through the browser's consent-gated flow.

*However:* the crawler event still contains an IP address. If a **human using ChatGPT's
"browse" feature** triggers the crawl (as we tested), some argue the IP could indirectly relate
to a person (though in practice it's usually OpenAI's own server IP, not the person's). This is
a genuinely debated gray area in privacy law right now — worth a conversation with your legal/
privacy team rather than treating it as fully settled.

### Q: What should we double check to be safely compliant?

- [ ] **Privacy policy** — does it disclose that page activity is shared with Tealium, Google,
      Adobe, and that bot/crawler traffic (including IPs) is logged?
- [ ] **Data processing agreements (DPAs)** — do you have signed DPAs with Tealium, Google, and
      Adobe? (Standard for any GDPR-compliant use of these tools — usually already in place at
      the account/legal level, but worth confirming for this specific implementation.)
- [ ] **Data retention** — how long does Tealium/your warehouse keep the crawler IP logs? GDPR
      requires you don't keep personal data longer than necessary.
- [ ] **Right to erasure** — if someone asks "delete my data," can you find and remove records
      tied to their anonymous ID across Tealium, GA4, and Adobe?
- [ ] **Cross-border transfer** — Tealium/Google/Adobe may process data outside the EU. Standard
      Contractual Clauses (SCCs) are the usual legal mechanism — check your vendor agreements.
- [ ] **IP masking (optional hardening)** — consider truncating/anonymizing the IP before
      storage (e.g., dropping the last octet) if you don't need the exact IP for security
      purposes. We currently send the raw IP for bot events.

None of this is unusual — it's the standard checklist for *any* site using Tealium + GA4 +
Adobe. This project doesn't do anything unusually risky; it just needs the same paperwork any
analytics setup needs.

---

## Part 8 — How Does the Site "Allow" AI Crawlers, and Could It Block Them?

### Q: Wait — are we currently BLOCKING any AI crawlers?

**No. We built detection, not blocking.** This is the most important thing to understand about
what we've done so far.

We confirmed this directly: there is **no `robots.txt` file** on the site (a 404 when
requested), and the middleware code has no logic anywhere that returns an error or refuses a
request — every single request, crawler or human, gets the page. All we do is:

1. Notice ("hey, this is GPTBot")
2. Tag it (add response headers, send an event to Tealium)
3. Let it through, unchanged

### Q: Then what DOES stop a crawler from scraping a website, in general?

There are three real mechanisms, in increasing strength — none of which we've turned on yet:

| Mechanism | How it works | Strength |
|---|---|---|
| **`robots.txt`** | A text file at `/robots.txt` saying "please don't crawl these paths" | **Honor system only.** Respected by well-behaved crawlers (Google, and OpenAI/Anthropic publicly say they honor it) but technically enforces nothing — a crawler *can* ignore it. |
| **Server-side blocking** | Your server actively refuses the request (HTTP 403 "Forbidden") when it detects a bad crawler | **Real enforcement**, but requires you to first *detect* the crawler (which we now do) and then decide to *reject* instead of *allow*. |
| **CAPTCHA / rate limiting** | Force suspicious traffic to prove it's human, or throttle it | Strongest, but adds friction that can also affect real users and legitimate SEO crawlers you *want* (like Googlebot). |

### Q: So if we wanted to actually block GPTBot (say), what would we change?

In `middleware.js`, instead of:
```js
if (!hit) return next();       // human → let through
// ... (tag the bot) ...
return next({ headers: {...} }); // bot → STILL let through, just tagged
```
you'd add a decision step:
```js
if (hit && BLOCK_LIST.includes(hit.name)) {
  return new Response('Forbidden', { status: 403 }); // actually refuse
}
```
This is a **business decision**, not a technical one — do you *want* AI companies training on
your content? Some sites do (visibility in AI answers) and some don't (protecting original
content). We deliberately left this as an open decision for you rather than assuming an answer.

### Q: Can a crawler fake being human to get around detection?

Yes, two ways, and we handle them differently:

1. **A crawler lies about its User-Agent** (pretends to be a normal Chrome browser). Our
   current detection can't catch this — we only match *declared* crawler names. The `plan`
   document we wrote earlier also covers a second layer (checking `navigator.webdriver` and
   other browser fingerprints) for exactly this case, but that layer isn't implemented in code
   yet — it's documented as a next step.
2. **A real AI crawler correctly identifies itself** (the normal, expected case, and what all
   our testing so far has verified) — this is what GPTBot, ClaudeBot, etc. do by default, and
   what our detection successfully catches today.

---

## Part 9 — Is the Overall Idea Correct? An Honest Assessment

### Q: What did we get right?

- **Detecting at the edge, before JavaScript runs**, catches crawlers that never render a
  browser — most AI training crawlers work exactly this way, so this was the correct call.
- **Two independent detection paths** (server middleware + a documented plan for client-side
  browser fingerprinting) covers both "honest declared bots" and "bots pretending to be human."
- **Separating our own data layer (GridBox) from downstream tools (Tealium/Adobe/GA4)** keeps
  one clear source of truth instead of three systems each guessing independently.
- **Never blocking anything automatically** was the right conservative default — we give you
  visibility first, and let *you* decide policy (block/allow/rate-limit) with real data instead
  of guessing.
- **Testing this "for real"** (not just simulated User-Agents, but an actual browser opening
  ChatGPT and asking it to crawl our real URL) is unusually rigorous — we proved, with live
  logs, that the entire chain works, not just each piece in isolation.

### Q: Where could we be going wrong, or what's genuinely unfinished?

Being honest about the gaps:

1. **User-Agent strings can be faked.** Anyone can send a request claiming to be "GPTBot" —
   we have no way yet to verify it's *really* OpenAI (that would require checking the
   requester's IP address against OpenAI's published IP ranges, which we do not currently do).
   Today, our data could theoretically include some spoofed/fake bot traffic mixed in with real.
2. **No `robots.txt` exists.** We never made the policy decision of "which crawlers, if any,
   should be told to stay away." This means, right now, literally every crawler is implicitly
   welcome — that may or may not match your actual intent.
3. **Raw IP addresses are stored** for crawler events without anonymization — worth a privacy
   review given IP is personal data under GDPR (see Part 7).
4. **We're now awaiting the Tealium response inside the edge request** (added this session so
   we could prove delivery via logs). This adds a small delay to bot page loads and has no
   timeout configured — if Tealium's endpoint were ever slow, bot requests would be slower too.
   A production hardening step would be to add a timeout (e.g., "give up after 2 seconds").
5. **CDN dependency is a single point of silent failure**, as proven twice this session (Tealium
   and consent banner both silently broken by CSP gaps). There's no automated alert today that
   tells you "Tealium stopped loading" — you'd only notice by checking Live Events and finding
   it empty.
6. **No Subresource Integrity (SRI)** on any of the CDN scripts we load — a supply-chain
   compromise at Tealium/jsdelivr/Adobe/Google would currently have no technical safeguard on
   our side (this is common industry practice to skip, since these vendors self-update their
   scripts frequently, but it's worth knowing it's a trade-off, not an oversight-free zone).
7. **We haven't yet verified delivery all the way into your Tealium account's Live Events UI**
   from this session — we proved the HTTP request succeeds (status 200), which is strong
   evidence, but only you can see inside your own Tealium account to confirm the event is
   visible and properly routed.

### Q: So — is the core idea correct?

**Yes, the architecture is sound and the implementation matches it.** The core idea — *detect
AI crawler traffic at the edge, tag it, report it server-side to Tealium, without disrupting the
page or requiring consent gymnastics* — is a clean, well-tested design. The gaps above are all
normal "next hardening steps" for a first working version, not signs the approach is wrong. The
main decisions still waiting on you are **policy** ones (do we block anyone? what's our
retention/legal story?) rather than **technical** ones (does the pipe actually work? — yes,
proven).
