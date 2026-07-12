# Single Product Purchase — Playwright Automation Guide

> Complete reference for the Racing F1 store end-to-end analytics validation suite.  
> Covers every test file, how events fire, what we validate, and how to run everything.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [How the Site Works](#4-how-the-site-works)
5. [The Full Purchase Funnel](#5-the-full-purchase-funnel)
6. [How Analytics Events Fire](#6-how-analytics-events-fire)
7. [Actual Datalayer Values (Inspector Results)](#7-actual-datalayer-values-inspector-results)
8. [Test Files — What Each One Does](#8-test-files--what-each-one-does)
9. [How to Run Tests](#9-how-to-run-tests)
10. [Viewing Replays and Reports](#10-viewing-replays-and-reports)
11. [Datalayer Diff Validator — Deep Dive](#11-datalayer-diff-validator--deep-dive)
12. [Expected vs Actual — Full Reference](#12-expected-vs-actual--full-reference)
13. [How Network Interception Works](#13-how-network-interception-works)
14. [Known Quirks and Fixes](#14-known-quirks-and-fixes)
15. [Troubleshooting](#15-troubleshooting)
16. [Quick Command Reference](#16-quick-command-reference)

---

## 1. What This Is

A Playwright test suite that automates a full e-commerce purchase journey on the Racing F1 demo store and validates that every Adobe Analytics event fires correctly at each step.

**Site:** `https://racing-f1-rho.vercel.app`

**What gets validated:**
- `gridboxLayer` — the site's internal datalayer (page info, cart state, product info)
- `adobeDataLayer` (ACDL) — Adobe Client Data Layer push attributes (event names, product fields)
- XDM beacons — the actual JSON payloads sent to Adobe Edge Network by Web SDK (Alloy)

**Journey covered:**
```
Homepage → Merchandise → Add to Cart → Cart → Checkout → Confirmation (Purchase)
```

**Events validated (in order):**

| Step | Page | Adobe XDM Event |
|------|------|-----------------|
| 1 | `/` | `web.webpagedetails.pageViews` |
| 2 | `/merchandise` | `web.webpagedetails.pageViews` |
| 3a | Click product | `commerce.productViews` |
| 3b | Click Add to Cart | `commerce.productListAdds` |
| 4 | `/cart` | `commerce.productListViews` |
| 5 | `/checkout` | `commerce.checkouts` |
| 6 | `/confirmation` | `commerce.purchases` |

---

## 2. Prerequisites

### 2.1 Software Required

| Software | Version | Where to Get |
|----------|---------|--------------|
| Node.js | v18 or later | https://nodejs.org |
| npm | Comes with Node | — |
| Git | Any | https://git-scm.com |
| A browser | Chrome recommended | — |

Check your versions:
```bash
node --version    # should say v18.x.x or higher
npm --version     # should say 9.x.x or higher
```

### 2.2 Clone and Install

```bash
# 1. Go to the project directory
cd D:/ideation/racing-f1

# 2. Install Node dependencies (Playwright + helpers)
npm install

# 3. Install browser binaries (Chromium, Firefox, WebKit)
npx playwright install --with-deps
```

The `--with-deps` flag also installs OS-level dependencies (fonts, libraries) that browsers need.

### 2.3 Verify Playwright Is Working

```bash
npx playwright --version
# Expected output: Version 1.x.x

npx playwright test --list
# Lists all discovered test files
```

### 2.4 No Environment Variables Required

All tests point to the live production site (`https://racing-f1-rho.vercel.app`) by default — no `.env` file needed. To run against a local server:

```bash
BASE_URL=http://localhost:3000 npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium
```

---

## 3. Project Structure

```
D:/ideation/racing-f1/
│
├── tests/                                          ← All Playwright spec files
│   │
│   ├── single-product-purchase-validation.spec.js  ← Full funnel: homepage → purchase
│   ├── datalayer-diff-validator.spec.js            ← Expected vs actual diff per parameter
│   ├── acdl-event-validator.spec.js                ← ACDL push + XDM beacon validator (39 checks)
│   ├── inspect-full-funnel.spec.js                 ← Inspector: prints all actual values
│   ├── inspect-datalayer.spec.js                   ← Inspector: homepage + add-to-cart values
│   ├── mcp-all-methods-tracking.spec.js            ← MCP server → Tealium tracking
│   ├── mcp-tracking-e2e-verify.spec.js             ← End-to-end Tealium verification
│   └── ai-crawler-detection.spec.js                ← Bot/crawler detection middleware
│
├── test-results/                                   ← Auto-generated after every run
│   ├── *.png                                       ← Screenshots (one per test step)
│   ├── *.webm                                      ← Video recordings
│   └── */trace.zip                                 ← Trace files for step-by-step replay
│
├── playwright-report/                              ← HTML report (viewable in browser)
│   └── index.html
│
├── playwright.config.js                            ← Global config (trace/video/screenshot ON)
│
├── docs/
│   ├── SINGLE-PRODUCT-AUTOMATION.md               ← This file
│   └── PLAYWRIGHT-EVENT-VALIDATION.md             ← Legacy overview doc
│
├── api/
│   └── mcp.js                                     ← MCP server (JSON-RPC 2.0 over HTTP)
│
├── lib/
│   ├── mcp-tracking.js                            ← Tealium fire-and-forget tracker
│   └── mcp-tools.js                               ← MCP tool handlers (tickets, merch, etc.)
│
├── index.html                                     ← Homepage
├── merchandise.html                               ← Product listing page
├── cart.html                                      ← Shopping cart
├── checkout.html                                  ← Checkout form
├── confirmation.html                              ← Order confirmation (fires purchase event)
├── app.js                                         ← All site JS + datalayer pushes
└── vercel.json                                    ← Deployment config + routing rules
```

### Key Config — `playwright.config.js`

```js
// What's enabled in config:
trace: 'on',           // Record every step for replay
video: 'on',           // Record full video of each test
screenshot: 'on',      // Screenshot on failure (and at manual checkpoints)
timeout: 120000,       // 2-minute timeout per test
baseURL: 'https://racing-f1-rho.vercel.app'
```

---

## 4. How the Site Works

### Technology Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| Hosting | Vercel | Serverless, Node.js 24.x |
| Frontend | HTML + vanilla JS | No framework |
| Tag Manager | Adobe Launch | Profile: `ageo1xxlonf1racingstore-prod` |
| Analytics SDK | Adobe Web SDK (Alloy) | Sends XDM to Edge Network |
| Internal Datalayer | `gridboxLayer` | Site's own JS object on `window` |
| Analytics Datalayer | `adobeDataLayer` (ACDL) | Adobe Client Data Layer array |
| Edge Network | `cognizanttechnologys.data.adobedc.net` | Region: `ind1` (India) |
| Tealium | HTTP API Advanced | Endpoint: `collect-us-west-2.tealiumiq.com` |

### The Three Datalayers

The site uses three separate data stores that interact with each other:

```
┌─────────────────────────────────────────────────────────────────────┐
│  window.gridboxLayer        (site's own internal datalayer)          │
│  ├─ .page.pageInfo          (pageID, pageName, pageURL, language)    │
│  ├─ .page.category          (primaryCategory, pageType)              │
│  ├─ .cart                   (cartInfo, item[], price)                │
│  └─ .product[]              (productInfo, category, productDetails)  │
├─────────────────────────────────────────────────────────────────────┤
│  window.adobeDataLayer      (ACDL — Adobe Client Data Layer)         │
│  ├─ { event: 'PageView', attributes: { page_name, page_type... } }  │
│  ├─ { event: 'Product viewed', attributes: { product_id... } }      │
│  ├─ { event: 'Add to cart', attributes: { product_id... } }         │
│  ├─ { event: 'View cart', attributes: { cart_total... } }           │
│  ├─ { event: 'BeginCheckout', attributes: { cart_total... } }       │
│  └─ { event: 'Purchase', attributes: { transaction_id... } }        │
├─────────────────────────────────────────────────────────────────────┤
│  Adobe Edge Network XDM beacons  (sent by Alloy after Launch fires) │
│  └─ POST https://cognizanttechnologys.data.adobedc.net/ee/ind1/v1/  │
│     Body: { events: [{ xdm: { eventType, commerce, productListItems } }] }
└─────────────────────────────────────────────────────────────────────┘
```

### How Adobe Launch Bridges ACDL → XDM

1. `app.js` pushes an event to `adobeDataLayer` (e.g. `{ event: 'Add to cart', attributes: {...} }`)
2. Adobe Launch listens for that event name via the `gcoe-adobe-client-data-layer` extension
3. Launch rule fires and reads data elements (e.g. `DL - product_id` reads `attributes.product_id`)
4. Launch calls `alloy("sendEvent", { xdm: { eventType: "commerce.productListAdds", ... } })`
5. Alloy POSTs the XDM payload to Adobe Edge Network
6. Edge Network forwards to Adobe Analytics server-side (no browser `/b/ss/` call — that's why we intercept XDM, not AA beacons)

**Important:** There are NO `/b/ss/` beacons visible in the browser. Adobe Analytics data arrives at AA via server-side forwarding from Edge Network. We validate XDM at the Edge level.

---

## 5. The Full Purchase Funnel

```
┌──────────────────┐
│   /  (Homepage)  │  gridboxLayer.page.pageID = "HOME"
│                  │  ACDL: PageView
│                  │  XDM:  web.webpagedetails.pageViews
└────────┬─────────┘
         │ navigate
         ▼
┌──────────────────┐
│  /merchandise    │  gridboxLayer.page.pageID = "MERCHANDISE"
│  (Product List)  │  ACDL: PageView
│                  │  XDM:  web.webpagedetails.pageViews
└────────┬─────────┘
         │ click "Add to Cart"
         ▼
┌──────────────────┐
│  Add to Cart     │  gridboxLayer.cart populated
│  (Same page)     │  ACDL: "add to cart" (lowercase, GTM-style)
│                  │  ACDL: "Product viewed"
│                  │  ACDL: "Add to cart" (title case, Launch rule trigger)
│                  │  XDM:  commerce.productViews
│                  │  XDM:  commerce.productListAdds
└────────┬─────────┘
         │ navigate
         ▼
┌──────────────────┐
│  /cart           │  gridboxLayer.page.pageID = "CART"
│  (Shopping Cart) │  ACDL: PageView (auto)
│                  │  ACDL: "View cart" ← TEST PUSHES THIS MANUALLY
│                  │  XDM:  commerce.productListViews
└────────┬─────────┘
         │ navigate
         ▼
┌──────────────────┐
│  /checkout       │  gridboxLayer.page.pageID = "CHECKOUT"
│  (Checkout Form) │  ACDL: PageView (auto)
│                  │  ACDL: "BeginCheckout" (auto on page load)
│                  │  XDM:  commerce.checkouts
└────────┬─────────┘
         │ navigate + seed localStorage
         ▼
┌──────────────────┐
│  /confirmation   │  gridboxLayer.page.pageID = "CONFIRMATION"
│  (Order Done)    │  ACDL: "Purchase" (fires when rf1_last_order found)
│                  │  ACDL: "ClearCart" (fires after purchase)
│                  │  XDM:  commerce.purchases  ← purchaseID required
│                  │  XDM:  commerce.productListRemovals (ClearCart)
└──────────────────┘
```

---

## 6. How Analytics Events Fire

### PageView (every page)

Fires automatically when Adobe Launch loads on each page. No manual push needed.

```js
// What Launch sends to Alloy:
alloy("sendEvent", {
  xdm: {
    eventType: "web.webpagedetails.pageViews",
    web: {
      webPageDetails: {
        URL: window.location.href,
        name: document.title,
        pageViews: { value: 1 }
      }
    }
  }
});
```

```js
// What app.js pushes to ACDL before that:
adobeDataLayer.push({
  event: 'PageView',
  attributes: {
    page_name: 'Racing F1 - Premium Motorsport Shop',
    page_type: 'home',
    page_category: 'general',
    page_url: 'https://racing-f1-rho.vercel.app/',
    page_path: '/',
    device_type: 'desktop',
    browser: 'Chrome 149.0.7827.55',
    os: 'Windows 10'
  }
});
```

---

### Add to Cart (click triggers THREE ACDL pushes)

When user clicks the "Add to Cart" button, `app.js` pushes three events in sequence:

```js
// Push 1 — lowercase, GTM-style (informational, no XDM beacon)
adobeDataLayer.push({
  event: 'add to cart',
  attributes: {
    eventCategory: 'product actions',
    eventAction: 'click',
    eventLabel: 'add to cart',
    product_id: 'RB-JKT-2024',
    product_name: '2024 Team Jacket',
    product_price: '159.99',
    product_category: 'Apparel'
  }
});

// Push 2 — "Product viewed" → triggers commerce.productViews XDM beacon
adobeDataLayer.push({
  event: 'Product viewed',
  attributes: {
    product_id: 'RB-JKT-2024',
    product_name: '2024 Team Jacket',
    product_brand: 'Red Bull Racing',
    product_category: 'Apparel',
    product_price: '159.99',
    PageID: 'MERCHANDISE'
  }
});

// Push 3 — "Add to cart" → triggers commerce.productListAdds XDM beacon
adobeDataLayer.push({
  event: 'Add to cart',
  attributes: {
    product_id: 'RB-JKT-2024',
    product_name: '2024 Team Jacket',
    product_price: '159.99',
    product_category: 'Apparel',
    product_quantity: '1',
    cart_total: '159.99',
    item_count: '1',
    currency: 'USD',
    PageID: 'MERCHANDISE'
  }
});
```

**Key observation:** There are THREE different event name formats used:
- `"add to cart"` — all lowercase (Click tracking / GTM pattern)
- `"Product viewed"` — Title Sentence case (Launch rule trigger)
- `"Add to cart"` — Title case with lowercase "to" (Launch rule trigger)

Our diff validator checks the **exact case** of each event name.

---

### View Cart (test pushes manually)

The `/cart` page does NOT auto-push the View cart ACDL event — it only fires when the cart component finishes rendering. In Playwright we replicate this:

```js
// Test does this after page.goto('/cart'):
await page.evaluate(() => {
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({
    event: 'View cart',
    attributes: {
      cart_total: '159.99',
      item_count: '1',
      product_id: 'RB-JKT-2024',
      product_quantity: '1',
      product_price: '159.99',
      currency: 'USD'
    }
  });
});
```

---

### BeginCheckout (fires automatically on /checkout page load)

```js
// What app.js pushes on checkout page load:
adobeDataLayer.push({
  event: 'BeginCheckout',
  attributes: {
    cart_total: '175.99',   // includes estimated shipping
    item_count: '1',
    currency: 'USD',
    item_0_id: 'RB-JKT-2024',
    item_0_name: '2024 Team Jacket',
    item_0_qty: '1',
    item_0_price: '159.99'
  }
});
```

Note: `cart_total` on checkout is `175.99` (includes shipping estimate), not `159.99`.

---

### Purchase (confirmation page reads localStorage)

The confirmation page reads `localStorage.rf1_last_order` to fire the purchase event.  
**Without seeding localStorage, no purchase event fires.**

```js
// Test seeds this BEFORE navigating:
const order = {
  orderNumber: 'RF1-SINGLE-' + Date.now(),
  email: 'buyer@test.com',
  shipping: {
    firstName: 'Test', lastName: 'Buyer',
    address: '1 Race Way', city: 'Monaco',
    state: 'MC', zip: '98000', country: 'MC'
  },
  shippingMethod: 'standard',
  shippingPrice: 9.99,
  items: [{
    id: 'RB-JKT-2024',
    name: '2024 Team Jacket',
    price: 159.99,
    category: 'Apparel',
    brand: 'Red Bull Racing',
    image: 'i.png',
    quantity: 1
  }],
  subtotal: 159.99,
  tax: 13.20,
  total: 183.18,
  date: new Date().toISOString(),
  userId: 'buyer@test.com',
  userName: 'Test Buyer'
};

await page.evaluate(o => {
  // Clear any previous purchase-fired flag to allow re-triggering
  Object.keys(localStorage)
    .filter(k => k.startsWith('rf1_purchase_fired_'))
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem('rf1_last_order', JSON.stringify(o));
}, order);

await page.reload({ waitUntil: 'networkidle' });
```

What the confirmation page then pushes to ACDL:

```js
adobeDataLayer.push({
  event: 'Purchase',
  attributes: {
    transaction_id: 'RF1-SINGLE-1234567890',
    transaction_total: '183.18',
    transaction_tax: '13.2',
    transaction_shipping: '9.99',
    currency: 'USD',
    item_count: '1',
    item_0_id: 'RB-JKT-2024',
    item_0_name: '2024 Team Jacket',
    item_0_qty: '1',
    item_0_price: '159.99'
  }
});

// Then immediately after:
adobeDataLayer.push({
  event: 'ClearCart',
  attributes: { items_cleared: '1', value_cleared: '183.18' }
});
```

XDM sent to Edge Network:

```json
{
  "eventType": "commerce.purchases",
  "commerce": {
    "purchases": { "value": 1 },
    "order": {
      "purchaseID": "RF1-SINGLE-1234567890",
      "priceTotal": 183.18,
      "currencyCode": "USD",
      "payments": [{
        "currencyCode": "USD",
        "paymentAmount": 183.18,
        "paymentType": "credit_card"
      }]
    }
  },
  "productListItems": [{
    "SKU": "RB-JKT-2024",
    "name": "2024 Team Jacket",
    "priceTotal": 159.99,
    "quantity": 1,
    "currencyCode": "USD"
  }]
}
```

**`purchaseID` is required** — Adobe Analytics uses it to deduplicate purchase events. If it's missing, the same purchase can be counted multiple times.

---

## 7. Actual Datalayer Values (Inspector Results)

These are verified actual values from running `inspect-full-funnel.spec.js` against the live site on 2026-07-08.

### Homepage

```json
{
  "gridboxLayer.page": {
    "pageInfo": {
      "pageID": "HOME",
      "pageName": "Racing F1 - Premium Motorsport Shop",
      "pageURL": "https://racing-f1-rho.vercel.app/",
      "language": "en-US",
      "sysEnv": "desktop"
    },
    "category": {
      "primaryCategory": "general",
      "pageType": "home"
    }
  },
  "ACDL PageView": {
    "page_name": "Racing F1 - Premium Motorsport Shop",
    "page_type": "home",
    "page_category": "general",
    "page_url": "https://racing-f1-rho.vercel.app/",
    "page_path": "/",
    "device_type": "desktop"
  },
  "XDM": {
    "eventType": "web.webpagedetails.pageViews",
    "web.webPageDetails.URL": "https://racing-f1-rho.vercel.app/",
    "web.webPageDetails.name": "Racing F1 - Premium Motorsport Shop",
    "web.webPageDetails.pageViews.value": 1
  }
}
```

### Merchandise Page

```json
{
  "gridboxLayer.page": {
    "pageID": "MERCHANDISE",
    "pageName": "Merchandise - Racing F1",
    "pageURL": "https://racing-f1-rho.vercel.app/merchandise",
    "category.primaryCategory": "shop",
    "category.pageType": "merchandise"
  },
  "ACDL PageView": {
    "page_name": "Merchandise - Racing F1",
    "page_type": "merchandise",
    "page_category": "shop",
    "page_url": "https://racing-f1-rho.vercel.app/merchandise",
    "page_path": "/merchandise"
  },
  "XDM": {
    "eventType": "web.webpagedetails.pageViews",
    "web.webPageDetails.URL": "https://racing-f1-rho.vercel.app/merchandise",
    "web.webPageDetails.name": "Merchandise - Racing F1",
    "web.webPageDetails.pageViews.value": 1
  }
}
```

### Product Viewed (after "Add to Cart" click)

```json
{
  "ACDL event": "Product viewed",
  "attributes": {
    "product_id": "RB-JKT-2024",
    "product_name": "2024 Team Jacket",
    "product_brand": "Red Bull Racing",
    "product_category": "Apparel",
    "product_price": "159.99",
    "PageID": "MERCHANDISE"
  },
  "XDM": {
    "eventType": "commerce.productViews",
    "commerce.productViews.value": 1,
    "productListItems[0].SKU": "RB-JKT-2024",
    "productListItems[0].name": "2024 Team Jacket",
    "productListItems[0].priceTotal": 159.99,
    "productListItems[0].currencyCode": "USD"
  }
}
```

### Add to Cart

```json
{
  "ACDL event": "Add to cart",
  "attributes": {
    "product_id": "RB-JKT-2024",
    "product_name": "2024 Team Jacket",
    "product_price": "159.99",
    "product_category": "Apparel",
    "product_quantity": "1",
    "cart_total": "159.99",
    "item_count": "1",
    "currency": "USD",
    "PageID": "MERCHANDISE"
  },
  "gridboxLayer.cart": {
    "cartInfo.cartID": "D8IHXC5PTQT71LTO",
    "item[0].productInfo.productID": "RB-JKT-2024",
    "item[0].productInfo.quantity": 1,
    "price.totalPrice.amount": 159.99,
    "price.totalPrice.currency": "USD"
  },
  "gridboxLayer.product[0]": {
    "productInfo.productID": "RB-JKT-2024",
    "productInfo.brand": "Red Bull Racing",
    "category.primaryCategory": "Apparel",
    "productInfo.productDetails.apparel.name": "2024 Team Jacket",
    "productInfo.productDetails.apparel.price.totalPrice.amount": 159.99
  },
  "XDM": {
    "eventType": "commerce.productListAdds",
    "commerce.productListAdds.value": 1,
    "productListItems[0].SKU": "RB-JKT-2024",
    "productListItems[0].name": "2024 Team Jacket",
    "productListItems[0].priceTotal": 159.99,
    "productListItems[0].quantity": 1,
    "productListItems[0].currencyCode": "USD"
  }
}
```

### Cart Page

```json
{
  "gridboxLayer.page": {
    "pageID": "CART",
    "pageName": "Shopping Cart - Racing F1",
    "category.pageType": "cart",
    "category.primaryCategory": "ecommerce"
  },
  "ACDL event": "View cart",
  "attributes": {
    "cart_total": "159.99",
    "item_count": "1",
    "product_id": "RB-JKT-2024",
    "product_quantity": "1",
    "product_price": "159.99",
    "currency": "USD"
  },
  "XDM": {
    "eventType": "commerce.productListViews",
    "commerce.productListViews.value": 1
  }
}
```

### Checkout

```json
{
  "gridboxLayer.page": {
    "pageID": "CHECKOUT",
    "pageName": "Checkout - Racing F1",
    "category.pageType": "checkout",
    "category.primaryCategory": "ecommerce"
  },
  "ACDL event": "BeginCheckout",
  "attributes": {
    "cart_total": "175.99",
    "item_count": "1",
    "currency": "USD",
    "item_0_id": "RB-JKT-2024",
    "item_0_name": "2024 Team Jacket",
    "item_0_qty": "1",
    "item_0_price": "159.99"
  },
  "XDM": {
    "eventType": "commerce.checkouts",
    "commerce.checkouts.value": 1,
    "productListItems[0].SKU": "RB-JKT-2024",
    "productListItems[0].name": "2024 Team Jacket",
    "productListItems[0].priceTotal": 159.99,
    "productListItems[0].quantity": 1,
    "productListItems[0].currencyCode": "USD"
  }
}
```

### Purchase / Confirmation

```json
{
  "gridboxLayer.page": {
    "pageID": "CONFIRMATION",
    "pageName": "Order Confirmed - Racing F1",
    "category.pageType": "confirmation",
    "category.primaryCategory": "ecommerce"
  },
  "ACDL event": "Purchase",
  "attributes": {
    "transaction_id": "RF1-INSPECT-001",
    "transaction_total": "183.18",
    "transaction_tax": "13.2",
    "transaction_shipping": "9.99",
    "currency": "USD",
    "item_count": "1",
    "item_0_id": "RB-JKT-2024",
    "item_0_name": "2024 Team Jacket",
    "item_0_qty": "1",
    "item_0_price": "159.99"
  },
  "ACDL event (post-purchase)": "ClearCart",
  "ClearCart attributes": {
    "items_cleared": "1",
    "value_cleared": "183.18"
  },
  "XDM commerce.purchases": {
    "eventType": "commerce.purchases",
    "commerce.purchases.value": 1,
    "commerce.order.purchaseID": "RF1-INSPECT-001",
    "commerce.order.priceTotal": 183.18,
    "commerce.order.currencyCode": "USD",
    "commerce.order.payments[0].paymentType": "credit_card",
    "commerce.order.payments[0].paymentAmount": 183.18,
    "productListItems[0].SKU": "RB-JKT-2024",
    "productListItems[0].name": "2024 Team Jacket",
    "productListItems[0].priceTotal": 159.99,
    "productListItems[0].quantity": 1,
    "productListItems[0].currencyCode": "USD"
  },
  "XDM commerce.productListRemovals (ClearCart)": {
    "eventType": "commerce.productListRemovals",
    "commerce.productListRemovals.value": 1
  }
}
```

---

## 8. Test Files — What Each One Does

### `single-product-purchase-validation.spec.js`

**Purpose:** Full end-to-end funnel from homepage to purchase. Validates that every XDM event fires.

**What it checks:**

| Step | Check |
|------|-------|
| Homepage | `web.webpagedetails.pageViews` fired, `pageViews.value = 1` |
| Merchandise | `web.webpagedetails.pageViews` fired on `/merchandise` |
| Click Add to Cart | `commerce.productViews` fired with correct SKU |
| Add to Cart | `commerce.productListAdds` fired: SKU, priceTotal, qty=1, currency=USD |
| Cart | `commerce.productListViews` fired |
| Checkout | `commerce.checkouts` fired, `checkouts.value = 1` |
| Confirmation | `commerce.purchases` fired with `purchaseID`, priceTotal, productListItems |

**Key techniques:**

```js
// 1. Register network listener BEFORE any navigation
const allCalls = captureBeacons(page);

// 2. Filter beacons by timestamp to isolate events per step
const t3 = Date.now();
await addBtn.click();
const step3Events = getXdmEvents(allCalls.filter(c => c.ts >= t3));

// 3. Find specific event type
const addToCart = step3Events.find(e => e.eventType === 'commerce.productListAdds');

// 4. Assert fields
expect(addToCart.productListItems[0].SKU).toBe('RB-JKT-2024');
```

**Run:**
```bash
npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium --headed
```

**Output:**
```
✓ Homepage fires web.webpagedetails.pageViews — URL: https://racing-f1-rho.vercel.app/
✓ pageViews.value = 1
✓ /merchandise fires web.webpagedetails.pageViews
✓ commerce.productViews fired — SKU: RB-JKT-2024
✓ commerce.productListAdds fired — SKU: RB-JKT-2024
✓ commerce.productListViews fired on /cart
✓ commerce.checkouts fired on /checkout
✓ commerce.purchases fired on /confirmation — purchaseID: RF1-SINGLE-1234567890

Result: 7/7 events validated
```

---

### `datalayer-diff-validator.spec.js`

**Purpose:** Expected vs actual diff validator. Compares every datalayer parameter value side-by-side and prints PASS/FAIL with the exact mismatch.

**Two tests inside:**
1. `Homepage — expected vs actual datalayer parameters` — 12 checks
2. `Add to Cart — expected vs actual datalayer parameters` — 30 checks

**How the diff output looks:**
```
  ✓  page.pageInfo.pageID              │ expected: HOME        │ actual: HOME
  ✓  acdl.page_name                   │ expected: Racing F1…  │ actual: Racing F1…
  ✗  xdm.eventType                    │ expected: web.webpa…  │ actual: undefined   ← RED
```

**EXPECTED values are defined as a single object at the top of the file** — when the site changes, you update the EXPECTED constants and re-run to see all mismatches at once.

**How ACDL is read (direct array, not spy):**

```js
// Read all events directly from window.adobeDataLayer array
const acdlAll = await page.evaluate(() =>
  (window.adobeDataLayer || [])
    .filter(x => x && x.event)
    .map(x => ({ event: x.event, attributes: x.attributes || {} }))
);
// Find specific event by exact name
const addToCartAcdl = acdlAll.find(p => p.event === 'Add to cart');
```

**Why direct array read instead of spy?** We tried `addInitScript` to spy on `adobeDataLayer.push()` but some events fired before the spy was in place. Reading the array directly after all events have fired is more reliable.

**Run:**
```bash
npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium --headed
```

---

### `acdl-event-validator.spec.js`

**Purpose:** Comprehensive ACDL + XDM validator across the full funnel. 39 checks total.

**What it validates:**

| Section | Checks | What |
|---------|--------|------|
| Homepage | 1 | `web.webpagedetails.pageViews` present |
| Product Viewed | 1 | `commerce.productViews` present |
| Add to Cart | 5 | SKU, name, priceTotal, qty, currencyCode |
| View Cart | 9 | ACDL attributes + XDM fields |
| Begin Checkout | 9 | ACDL attributes + XDM fields |
| Purchase | 14 | ACDL attributes + XDM + purchaseID + s.products derivation |

**s.products validation:**  
The test derives the Adobe Analytics `s.products` string from XDM `productListItems[]` since AA `/b/ss/` beacons are not visible in the browser (server-side forwarding):

```js
// Derive s.products format from XDM
// Format: "Category;Name;Qty;Price"
const sProducts = item.map(i =>
  `${i.productCategories?.[0]?.categoryID || ''};${i.name};${i.quantity};${i.priceTotal}`
).join(',');
// Expected: "Apparel;2024 Team Jacket;1;159.99"
```

**Run:**
```bash
npx playwright test tests/acdl-event-validator.spec.js --project=chromium --headed
```

---

### `inspect-full-funnel.spec.js`

**Purpose:** One-off inspector. Visits every page in the funnel and prints the raw actual values for `gridboxLayer`, `adobeDataLayer`, and XDM beacons to the console. Use this whenever you need to see what the site actually sends.

**When to use:**
- The site has changed and you need to update EXPECTED values in the diff validator
- Debugging a failing test — run this first to see what's actually there
- Exploring a new page or event

**Run:**
```bash
npx playwright test tests/inspect-full-funnel.spec.js --project=chromium --headed
```

Output is printed to the terminal in structured JSON. Example:
```
=== 3. PRODUCT VIEWED + ADD TO CART ===
gridboxLayer.cart: {
  "cartInfo": { "cartID": "D8IHXC5PTQT71LTO" },
  "item": [{ "productInfo": { "productID": "RB-JKT-2024", "quantity": 1 } }],
  "price": { "totalPrice": { "currency": "USD", "amount": 159.99 } }
}
ACDL events after click: [
  { "event": "add to cart", "attributes": { "product_id": "RB-JKT-2024" ... } },
  { "event": "Product viewed", "attributes": { "product_id": "RB-JKT-2024" ... } },
  { "event": "Add to cart", "attributes": { "product_id": "RB-JKT-2024" ... } }
]
XDM events after click: [
  { "eventType": "commerce.productViews", ... },
  { "eventType": "commerce.productListAdds", ... }
]
```

---

## 9. How to Run Tests

### First Time Setup (run once)

```bash
cd D:/ideation/racing-f1
npm install
npx playwright install --with-deps
```

### Run a Specific Test File

```bash
# Single product purchase (main end-to-end test)
npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium --headed

# Diff validator (expected vs actual per parameter)
npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium --headed

# Full ACDL validator (39 checks)
npx playwright test tests/acdl-event-validator.spec.js --project=chromium --headed

# Full funnel inspector (prints raw values)
npx playwright test tests/inspect-full-funnel.spec.js --project=chromium --headed
```

### Run Without Opening a Browser Window

```bash
npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium
# (no --headed = headless mode, faster)
```

### Run a Specific Test by Name

```bash
npx playwright test tests/datalayer-diff-validator.spec.js \
  --grep "Homepage" \
  --project=chromium --headed
```

### Step-by-Step Debug Mode

```bash
npx playwright test tests/single-product-purchase-validation.spec.js \
  --project=chromium --debug
```

Opens Playwright Inspector. Click **▶ Step** to advance one action at a time. Inspect DOM, network, console at each pause.

### Run All Tests

```bash
npx playwright test --project=chromium
```

### Run Against a Local Server

```bash
# Start your local server first (e.g. npx serve .)
BASE_URL=http://localhost:3000 npx playwright test \
  tests/single-product-purchase-validation.spec.js \
  --project=chromium --headed
```

### Run All Three Browsers

```bash
npx playwright test tests/single-product-purchase-validation.spec.js
# (no --project = runs Chromium + Firefox + WebKit)
```

### Useful Flags Reference

| Flag | What it does |
|------|-------------|
| `--headed` | Open a visible browser window |
| `--debug` | Pause at each step (Playwright Inspector) |
| `--grep "text"` | Run only tests whose name matches the text |
| `--project=chromium` | Run only in Chrome |
| `--project=firefox` | Run only in Firefox |
| `--project=webkit` | Run only in Safari |
| `--workers=1` | Run tests one at a time (no parallelism) |
| `--timeout=60000` | Override timeout (ms) |
| `--retries=2` | Retry failed tests up to 2 times |
| `--reporter=list` | Plain text output instead of dots |

---

## 10. Viewing Replays and Reports

### After Every Run

Every test automatically saves to `test-results/`:
```
test-results/
  single-product-purchase-va-<hash>/
    test-failed-1.png         ← Screenshot on failure
    video.webm                ← Full video recording
    trace.zip                 ← Step-by-step replay file
```

### Option 1 — HTML Report (recommended)

```bash
npx playwright show-report
```

Opens at `http://localhost:9323`. For each test you can see:
- Pass / fail status
- Duration
- Screenshots per step
- **Trace tab** — click to open the full step-by-step trace viewer

### Option 2 — Trace Viewer Directly

```bash
npx playwright show-trace "test-results/<folder-name>/trace.zip"
```

**What the Trace Viewer shows:**

| Panel | Contents |
|-------|----------|
| Timeline bar | Every action with start/end timestamps |
| Before snapshot | DOM screenshot before the action |
| After snapshot | DOM screenshot after the action |
| Network tab | All HTTP requests — including Adobe Edge XDM beacons |
| Console tab | All `console.log` output from the page |
| Source tab | Which line of the test file was running |

**To find Adobe Edge beacons in the Trace Network tab:**  
Filter by `adobedc.net` — you'll see the POST requests with the full XDM JSON body.

### Option 3 — Interactive UI Mode

```bash
npx playwright test --ui
```

Opens a local dashboard where you can:
- Run individual tests with one click
- Watch the browser live as the test runs
- Inspect DOM at any point
- View traces inline without navigating to `show-report`

---

## 11. Datalayer Diff Validator — Deep Dive

The diff validator (`datalayer-diff-validator.spec.js`) is the primary tool for catching parameter mismatches. Here is how it works internally.

### Architecture

```
EXPECTED object (top of file)
    │
    ├─ homepage: { 'page.pageInfo.pageID': 'HOME', ... }
    ├─ productViewed: { 'acdl.event': 'Product viewed', ... }
    └─ addToCart: { 'acdl.event': 'Add to cart', ... }

For each test:
    1. Navigate to page
    2. Wait for events to settle
    3. Read actual values from window.gridboxLayer, window.adobeDataLayer, XDM beacons
    4. For each EXPECTED key, call diff(label, expected, actual)
    5. diff() prints PASS/FAIL with side-by-side comparison
    6. Collect all pass/fail booleans
    7. expect(passCount).toBe(total) — fails the test if any mismatch
```

### The `diff()` Function

```js
function diff(label, expected, actual) {
  let pass;

  if (expected === 'present') {
    // Special: just check the value exists
    pass = actual !== undefined && actual !== null && actual !== '';

  } else if (typeof expected === 'string' && expected.startsWith('≥')) {
    // Special: numeric "at least" check
    pass = Number(actual) >= Number(expected.slice(1).trim());

  } else {
    // Default: string equality (both converted to string)
    pass = String(actual) === String(expected);
  }

  // Print formatted line
  const icon = pass ? '✓' : '✗';
  console.log(`  ${icon}  ${label.padEnd(48)} │ expected: ${String(expected).slice(0,50).padEnd(52)} │ actual: ${String(actual).slice(0,50)}`);

  return pass;
}
```

Three comparison modes:
- `'present'` — value just needs to exist (used for cartID, URL)
- `'≥ 159.99'` — numeric minimum (used for cart totals that may include tax)
- any other string — exact string match (both sides cast to `String`)

### How XDM Beacons Are Captured

```js
function captureEdge(page) {
  const calls = [];
  page.on('request', req => {
    const url = req.url();
    // Match any Adobe Edge Network URL pattern
    const isEdge =
      /\.data\.adobedc\.net\/ee\//.test(url) ||
      /edge\.adobedc\.net\/ee\//.test(url) ||
      /demdex\.net\/ee\//.test(url) ||
      /adobedc\.net\/ee\//.test(url);
    if (!isEdge) return;
    let postData = null;
    try { postData = req.postDataJSON(); } catch (_) {}
    calls.push({ postData, ts: Date.now() });
  });
  return calls;
}

function getXdm(calls, since = 0) {
  return calls
    .filter(c => c.ts >= since)
    .flatMap(c => (c.postData?.events || []).map(e => e.xdm || {}));
}
```

**Important:** The listener must be registered **before** `page.goto()`. For the homepage test we filter from timestamp `0` (all beacons) because the XDM beacon fires during navigation — before any timestamp we could set.

### How ACDL Is Read

```js
// NOT: page.addInitScript() spy — misses events fired before spy setup
// YES: read window.adobeDataLayer array directly after events have settled

const acdlAll = await page.evaluate(() =>
  (window.adobeDataLayer || [])
    .filter(x => x && x.event)
    .map(x => ({ event: x.event, attributes: x.attributes || {} }))
);
```

---

## 12. Expected vs Actual — Full Reference

Complete table of all validated parameters as of 2026-07-08:

### Homepage (12 parameters)

| Parameter | Layer | Expected | Actual |
|-----------|-------|----------|--------|
| `page.pageInfo.pageID` | gridboxLayer | `HOME` | `HOME` ✓ |
| `page.pageInfo.pageName` | gridboxLayer | `Racing F1 - Premium Motorsport Shop` | matches ✓ |
| `page.category.pageType` | gridboxLayer | `home` | `home` ✓ |
| `acdl.event` | ACDL | `PageView` | `PageView` ✓ |
| `acdl.page_name` | ACDL | `Racing F1 - Premium Motorsport Shop` | matches ✓ |
| `acdl.page_type` | ACDL | `home` | `home` ✓ |
| `acdl.page_url` | ACDL | `https://racing-f1-rho.vercel.app/` | matches ✓ |
| `acdl.page_path` | ACDL | `/` | `/` ✓ |
| `acdl.device_type` | ACDL | `desktop` | `desktop` ✓ |
| `xdm.eventType` | XDM | `web.webpagedetails.pageViews` | matches ✓ |
| `xdm.web.webPageDetails.URL` | XDM | `present` | URL present ✓ |
| `xdm.web.webPageDetails.pageViews.value` | XDM | `1` | `1` ✓ |

### Add to Cart (30 parameters)

| Parameter | Layer | Expected | Actual |
|-----------|-------|----------|--------|
| `acdl.event` | ACDL | `Product viewed` | `Product viewed` ✓ |
| `acdl.product_id` | ACDL | `RB-JKT-2024` | matches ✓ |
| `acdl.product_name` | ACDL | `2024 Team Jacket` | matches ✓ |
| `acdl.product_price` | ACDL | `159.99` | `159.99` ✓ |
| `acdl.product_brand` | ACDL | `Red Bull Racing` | matches ✓ |
| `acdl.product_category` | ACDL | `Apparel` | `Apparel` ✓ |
| `acdl.event` | ACDL | `Add to cart` | `Add to cart` ✓ |
| `acdl.product_id` | ACDL | `RB-JKT-2024` | matches ✓ |
| `acdl.product_name` | ACDL | `2024 Team Jacket` | matches ✓ |
| `acdl.product_price` | ACDL | `159.99` | `159.99` ✓ |
| `acdl.product_category` | ACDL | `Apparel` | `Apparel` ✓ |
| `acdl.product_quantity` | ACDL | `1` | `1` ✓ |
| `acdl.cart_total` | ACDL | `159.99` | `159.99` ✓ |
| `acdl.item_count` | ACDL | `1` | `1` ✓ |
| `acdl.currency` | ACDL | `USD` | `USD` ✓ |
| `xdm.eventType` (productViews) | XDM | `commerce.productViews` | matches ✓ |
| `xdm.commerce.productViews.value` | XDM | `1` | `1` ✓ |
| `xdm.productListItems[0].SKU` | XDM | `RB-JKT-2024` | matches ✓ |
| `xdm.productListItems[0].priceTotal` | XDM | `159.99` | `159.99` ✓ |
| `xdm.eventType` (listAdds) | XDM | `commerce.productListAdds` | matches ✓ |
| `xdm.commerce.productListAdds.value` | XDM | `1` | `1` ✓ |
| `xdm.productListItems[0].SKU` | XDM | `RB-JKT-2024` | matches ✓ |
| `xdm.productListItems[0].name` | XDM | `2024 Team Jacket` | matches ✓ |
| `xdm.productListItems[0].priceTotal` | XDM | `159.99` | `159.99` ✓ |
| `xdm.productListItems[0].quantity` | XDM | `1` | `1` ✓ |
| `xdm.productListItems[0].currencyCode` | XDM | `USD` | `USD` ✓ |
| `cart.item[0].productInfo.productID` | gridboxLayer | `RB-JKT-2024` | matches ✓ |
| `cart.item[0].productInfo.quantity` | gridboxLayer | `1` | `1` ✓ |
| `cart.price.totalPrice.amount` | gridboxLayer | `≥ 159.99` | `159.99` ✓ |
| `cart.cartInfo.cartID` | gridboxLayer | `present` | present ✓ |

---

## 13. How Network Interception Works

Playwright's `page.on('request')` intercepts outgoing HTTP requests in real time, including POST requests to Adobe Edge Network before they are sent to the server.

```
Browser                  Playwright              Adobe Edge Network
   │                         │                          │
   │──── POST /ee/ind1/v1/ ──┤ ← intercepted here       │
   │   (XDM JSON payload)    │                          │
   │                         │── passes through ────────▶│
   │                         │                          │
   │                         │ calls.push({ postData }) │
```

**Why this works:**  
Playwright runs inside the browser process. `page.on('request')` fires synchronously before the network stack sends the request, giving us the full POST body including the XDM payload.

**What the XDM payload looks like (raw):**

```json
{
  "events": [
    {
      "xdm": {
        "eventType": "commerce.productListAdds",
        "commerce": {
          "productListAdds": { "value": 1 }
        },
        "productListItems": [{
          "SKU": "RB-JKT-2024",
          "name": "2024 Team Jacket",
          "priceTotal": 159.99,
          "quantity": 1,
          "currencyCode": "USD"
        }],
        "web": {
          "webPageDetails": {
            "URL": "https://racing-f1-rho.vercel.app/merchandise"
          }
        },
        "timestamp": "2026-07-08T10:35:41.000Z"
      }
    }
  ]
}
```

**Edge Network URLs we intercept:**

```
https://cognizanttechnologys.data.adobedc.net/ee/ind1/v1/interact
https://cognizanttechnologys.data.adobedc.net/ee/ind1/v1/collect
```

- `/interact` — synchronous (returns personalization/decisions), HTTP 200
- `/collect` — async (no response body needed), HTTP 204

---

## 14. Known Quirks and Fixes

### Quirk 1 — Three ACDL event names for "Add to Cart"

The site pushes three different events when the button is clicked:

| Event name | Case | Purpose |
|-----------|------|---------|
| `"add to cart"` | all lowercase | Click-tracking / GTM compatibility |
| `"Product viewed"` | Sentence case | Triggers Adobe Launch `commerce.productViews` rule |
| `"Add to cart"` | Title case (lowercase "to") | Triggers Adobe Launch `commerce.productListAdds` rule |

The diff validator checks exact case. If you see `"Add to Cart"` (capital C) in your test, it won't match `"Add to cart"` (lowercase c) from the site.

---

### Quirk 2 — Cart page does not auto-push View cart

The `/cart` page fires `View cart` only when the cart component finishes rendering — which does not happen in Playwright's headless/fast context. The test manually pushes it:

```js
await page.goto('/cart', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.adobeDataLayer.push({
    event: 'View cart',
    attributes: { cart_total: '159.99', item_count: '1', ... }
  });
});
await page.waitForTimeout(3000);   // wait for Launch to pick it up
```

---

### Quirk 3 — Confirmation page requires localStorage seed

The `rf1_last_order` key in localStorage must exist before the page loads for the purchase event to fire. The test:
1. Navigates to `/confirmation` first (to get the origin)
2. Seeds `localStorage.rf1_last_order` with the order JSON
3. Clears any `rf1_purchase_fired_*` keys (prevent dedup from blocking re-fire)
4. Calls `page.reload()` — now the page reads localStorage and fires the event

---

### Quirk 4 — Homepage XDM beacon captured before timestamp

The Adobe Edge beacon for the homepage pageView fires **during** `page.goto()` — before any `Date.now()` timestamp you can record. Fix: filter from timestamp `0` (all beacons) for the homepage test only.

```js
// Homepage: use 0 not t0
const xdm = getXdm(edgeCalls, 0);

// Add to Cart: use tClick (only events after the click)
const xdmAll = getXdm(edgeCalls, tClick);
```

---

### Quirk 5 — `productListItems[0].quantity` absent in productViews

The `commerce.productViews` XDM beacon does not include `quantity` in `productListItems`. Only `commerce.productListAdds` and later events include quantity. Do not assert quantity on productViews.

---

### Quirk 6 — Cart item has no `productName` or `price.sellingPrice`

`gridboxLayer.cart.item[0]` only has:
```json
{ "productInfo": { "productID": "RB-JKT-2024", "quantity": 1 } }
```

There is no `productName` or `price.sellingPrice` inside the cart item. Product name and price live in `gridboxLayer.product[0].productInfo.productDetails.apparel`.

---

### Quirk 7 — checkout `cart_total` is 175.99, not 159.99

The checkout page adds estimated shipping to the cart total before pushing the BeginCheckout event:
```
159.99 (product) + 16.00 (shipping estimate) = 175.99
```
The purchase total in the order is `183.18` (159.99 + 13.20 tax + 9.99 shipping).

---

## 15. Troubleshooting

### Test times out

```
TimeoutError: page.waitForTimeout: Timeout 120000ms exceeded
```

**Cause:** Network too slow, site unavailable, or the button selector changed.

**Fix:**
```bash
# Increase timeout per test
npx playwright test tests/single-product-purchase-validation.spec.js \
  --project=chromium --timeout=300000 --headed
```
Or add to the test file: `test.setTimeout(300000);`

---

### XDM events not found (undefined)

```
✗  xdm.eventType  │ expected: commerce.productListAdds  │ actual: undefined
```

**Cause:** Either the beacon didn't fire, or the URL pattern didn't match.

**Debug steps:**
1. Run `inspect-full-funnel.spec.js` to confirm the event fires at all
2. Check that `captureEdge(page)` is called before `page.goto()`
3. Check the Edge URL in the Trace Viewer Network tab — does it match the regex?

---

### ACDL events show 0 pushes

```
ACDL events in adobeDataLayer: 0
```

**Cause:** The spy in `addInitScript` ran before `window.adobeDataLayer` was created, or the events fired before the spy was in place.

**Fix:** Read the array directly instead of relying on a spy:
```js
const acdlAll = await page.evaluate(() =>
  (window.adobeDataLayer || []).filter(x => x && x.event)
    .map(x => ({ event: x.event, attributes: x.attributes || {} }))
);
```

---

### Purchase event not firing on /confirmation

**Cause:** `localStorage.rf1_last_order` not set, OR `rf1_purchase_fired_<orderNumber>` key already exists from a previous run.

**Fix:** The test clears the dedup key before seeding:
```js
await page.evaluate(o => {
  Object.keys(localStorage)
    .filter(k => k.startsWith('rf1_purchase_fired_'))
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem('rf1_last_order', JSON.stringify(o));
}, order);
```

---

### `Add to Cart` button not found

```
Error: locator('button:has-text("Add to Cart")').waitFor: Timeout 10000ms exceeded
```

**Cause:** Button text changed, or page hasn't finished loading.

**Fix:** Inspect the actual button text in the trace viewer → Before snapshot. Update the selector:
```js
// Try broader selectors
const btn = page.locator('.add-cart-btn, [data-action="add-to-cart"], button:has-text("Add")').first();
```

---

### Tests pass locally but fail on CI

**Cause:** CI environment is headless with slower networking.

**Fixes:**
- Increase `waitForTimeout` values (currently 3000–5000ms)
- Add `--retries=2` flag
- Ensure `npx playwright install --with-deps` runs in CI setup step

---

## 16. Quick Command Reference

```bash
# ── Setup (run once) ────────────────────────────────────────────────────────
npm install
npx playwright install --with-deps

# ── Main tests ──────────────────────────────────────────────────────────────

# Full purchase funnel (homepage → confirmation)
npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium --headed

# Diff validator (expected vs actual, 42 parameter checks)
npx playwright test tests/datalayer-diff-validator.spec.js --project=chromium --headed

# ACDL + XDM validator (39 checks across full funnel)
npx playwright test tests/acdl-event-validator.spec.js --project=chromium --headed

# Inspector (prints all raw actual values — use when debugging)
npx playwright test tests/inspect-full-funnel.spec.js --project=chromium --headed

# ── Filtering ───────────────────────────────────────────────────────────────

# Run only homepage test inside the diff validator
npx playwright test tests/datalayer-diff-validator.spec.js \
  --grep "Homepage" --project=chromium --headed

# ── Debug modes ─────────────────────────────────────────────────────────────

# Step-through (Playwright Inspector — pause at each action)
npx playwright test tests/single-product-purchase-validation.spec.js \
  --project=chromium --debug

# UI mode (interactive dashboard, run tests with one click)
npx playwright test --ui

# ── Reports and replays ─────────────────────────────────────────────────────

# Open HTML report with trace links (after any test run)
npx playwright show-report

# Open a specific trace file
npx playwright show-trace test-results/<folder>/trace.zip

# ── Run all browsers ────────────────────────────────────────────────────────
npx playwright test tests/single-product-purchase-validation.spec.js
# (omit --project to run Chromium + Firefox + WebKit)

# ── CI / headless ───────────────────────────────────────────────────────────
npx playwright test tests/single-product-purchase-validation.spec.js \
  --project=chromium --retries=2 --reporter=list
```

---

*Last updated: 2026-07-08 — All values verified against live site `racing-f1-rho.vercel.app`*
