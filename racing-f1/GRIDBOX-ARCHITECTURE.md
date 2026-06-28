# GridBox Analytics - Complete Architecture Documentation

**Version 2.12.0** | Last Updated: January 15, 2025

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [gridboxLayer Complete Structure](#3-gridboxlayer-complete-structure)
4. [Data Flow Architecture](#4-data-flow-architecture)
5. [User Identification System](#5-user-identification-system)
6. [Session Management](#6-session-management)
7. [Event Processing Pipeline](#7-event-processing-pipeline)
8. [Storage & Persistence](#8-storage--persistence)

---

## 1. Project Overview

### Purpose
GridBox Analytics is an enterprise-grade analytics data layer that serves as the **single source of truth** for all user interactions, behavioral data, and commerce events. It provides a standardized W3C-compliant data structure that GTM processing code reads from to fire analytics tags.

### Core Philosophy
- **gridboxLayer is the CORE** - All tracking updates gridboxLayer
- **No direct dataLayer push** - GTM processes gridboxLayer
- **W3C Compliant** - Follows W3C Customer Experience Digital Data Layer spec
- **Privacy-First** - Anonymous IDs, DNT support, bot detection

### Key Features
✅ Unique anonymous user ID (persistent across sessions)
✅ Session tracking with 30-minute timeout
✅ Event sequencing and ordering
✅ UTM parameter auto-capture
✅ Performance metrics (page load, DOM ready)
✅ Engagement tracking (time on page, scroll depth)
✅ Enhanced device/browser detection
✅ E-commerce tracking (products, cart, transactions)
✅ Bot detection and filtering

---

## 2. File Structure

```
racing-f1/
│
├── analytics.js                          # CORE DATA LAYER ENGINE
│   ├── gridboxLayer initialization       # W3C format object
│   ├── Unique user ID generation         # localStorage-based UUID
│   ├── Session management                # 30-min timeout
│   ├── UTM parameter capture             # Auto-detect campaign params
│   ├── Performance metrics               # Navigation Timing API
│   ├── Device/browser detection          # Enhanced UA parsing
│   ├── Engagement tracking               # Scroll depth, time on page
│   ├── Event callbacks                   # gbEventCallback, gbLinkCallback
│   ├── Product management                # addProduct(), product catalog
│   ├── Cart management                   # addToCart(), cart state
│   ├── Purchase tracking                 # purchase(), transaction
│   └── Global API exposure               # window.gridbox.*
│
├── app.js                                # APPLICATION LOGIC
│   ├── Cart UI interactions              # Uses gridbox.addToCart()
│   ├── User authentication               # Uses gridbox.setUser()
│   ├── Newsletter forms                  # Uses gridbox.link()
│   └── Promotion tracking                # Uses gridbox.link()
│
├── index.html                            # MAIN PAGE
│   ├── GTM container script              # GTM-5BMV9KLC
│   ├── gridboxLayer pre-init             # <script> before analytics.js
│   ├── data-track attributes             # Auto-tracked clicks
│   └── Product cards with data           # data-product-id, etc.
│
├── GTM-CONFIGURATION-GUIDE.md            # GTM SETUP GUIDE
├── TRACKING-IMPLEMENTATION-GUIDE.md      # IMPLEMENTATION GUIDE
├── GRIDBOX-ARCHITECTURE.md               # THIS DOCUMENT
└── test-datalayer.html                   # TEST SUITE

```

---

## 3. gridboxLayer Complete Structure

### 3.1 Top-Level Object

```javascript
window.gridboxLayer = {
    version: "2.12.0",
    libVersion: "1.1.0",
    
    event: [],        // All events (PageView, AddToCart, Purchase, etc.)
    page: {},         // Current page metadata
    user: [],         // User profile and device info
    product: [],      // Products viewed/interacted
    cart: {},         // Shopping cart state
    transaction: {},  // Completed purchases
    session: {},      // Current session data (NEW)
    context: {},      // Current context/state (NEW)
    component: []     // UI components (optional)
};
```

### 3.2 Event Array Structure

**Every event pushed to `gridboxLayer.event[]` has this structure:**

```javascript
{
    // IDENTIFIERS
    eventId: "evt_1705312345678_abc123",      // Unique event ID
    eventIndex: 1,                             // Sequence number (NEW)
    
    // CATEGORIZATION
    category: {
        primaryCategory: "Ecommerce"           // PageView, Ecommerce, UserEvent, Performance
    },
    
    // EVENT METADATA
    eventInfo: {
        eventName: "AddToCart",                // Human-readable name
        key: "gb_cart_add_RB-JKT-2024",       // Machine key
        timeStamp: "2025-01-15T12:00:00.000Z", // ISO timestamp
        pageId: "MERCHANDISE",                 // Current page
        pageInstanceId: "1705312345678"        // SPA instance ID
    },
    
    // CONTEXT (NEW)
    context: {
        anonymousId: "anon_xxx-xxx-xxx",       // Unique user ID
        sessionId: "sess_xxx-xxx-xxx",         // Session ID
        isNewSession: true,                    // Is this a new session?
        isBot: false                           // Bot detection
    },
    
    // EVENT ATTRIBUTES (key-value pairs)
    attributes: [
        { key: "product_id", value: "RB-JKT-2024" },
        { key: "product_name", value: "2024 Team Jacket" },
        { key: "product_price", value: "159.99" },
        { key: "cart_total", value: "159.99" },
        { key: "anonymous_id", value: "anon_xxx" },
        { key: "session_id", value: "sess_xxx" }
    ]
}
```

### 3.3 Page Object

```javascript
gridboxLayer.page = {
    pageInfo: {
        pageID: "MERCHANDISE",                     // Page identifier
        pageName: "Racing F1 - Shop",             // Page title
        pageURL: "https://example.com/shop",       // Full URL
        referringURL: "https://google.com",        // Referrer
        language: "en-US",                         // Browser language
        sysEnv: "desktop"                          // Device type
    },
    category: {
        primaryCategory: "merchandise",            // Main category
        subCategory: "jackets",                    // Sub category
        pageType: "pdp"                           // Page type
    },
    attributes: {}                                 // Custom attributes
};
```

### 3.4 User Object (Enhanced)

```javascript
gridboxLayer.user = [{
    profile: [{
        profileInfo: {
            // IDENTITY
            anonymousId: "anon_a1b2c3d4-e5f6-xxx",     // Persistent UUID (NEW)
            profileID: "anon_a1b2c3d4-e5f6-xxx",       // User ID (defaults to anonymous)
            userName: "",                              // Name (if logged in)
            email: "",                                 // Email (if logged in)
            
            // SESSION
            sessionId: "sess_xxx-xxx-xxx",             // Current session (NEW)
            isNewSession: true,                        // New session flag (NEW)
            sessionStartTime: "2025-01-15T12:00:00Z",  // Session start (NEW)
            loginStatus: false,                        // Logged in?
            
            // DEVICE & BROWSER (Enhanced)
            userAgent: "Mozilla/5.0...",               // Full UA string
            deviceType: "desktop",                     // mobile/tablet/desktop
            OS: "Windows 10",                          // Operating system
            browser: "Chrome 120.0",                   // Browser + version (NEW)
            language: "en-US",                         // Primary language (NEW)
            
            // SCREEN & VIEWPORT (NEW)
            screenResolution: "1920x1080",             // Screen size
            viewportSize: "1920x937",                  // Viewport size
            devicePixelRatio: 1,                       // Pixel density
            screenColorDepth: 24,                      // Color depth
            
            // CAPABILITIES (NEW)
            touchSupport: false,                       // Touch screen?
            cookieEnabled: true,                       // Cookies enabled?
            doNotTrack: false,                         // DNT header?
            online: true,                              // Online status
            isBot: false                               // Bot detection (NEW)
        },
        attributes: {
            userType: "guest",                         // guest/registered/premium
            customerTier: ""                           // gold/silver/bronze
        }
    }]
}];
```

### 3.5 Product Array

```javascript
gridboxLayer.product = [
    {
        productInfo: {
            productID: "RB-JKT-2024",                  // SKU/ID
            productName: "2024 Team Jacket",           // Name
            productImage: "/images/jacket.jpg",        // Image URL
            productURL: "/product/jacket",             // Product page
            sku: "RB-JKT-2024"                        // SKU
        },
        category: {
            primaryCategory: "Apparel",                // Main category
            subCategory: "Jackets"                     // Sub category
        },
        price: {
            basePrice: 159.99,                         // Base price
            currency: "USD",                           // Currency
            salePrice: 159.99                          // Sale price (if different)
        },
        attributes: {
            brand: "Red Bull Racing",                  // Brand
            variant: "Large",                          // Variant/size
            position: 1,                               // List position
            list: "Featured Products"                  // List name
        }
    }
];
```

### 3.6 Cart Object

```javascript
gridboxLayer.cart = {
    cartID: "cart_1705312345678",                      // Unique cart ID
    
    price: {
        basePrice: 159.99,                             // Subtotal
        currency: "USD",                               // Currency
        taxRate: 0.1,                                  // Tax rate (10%)
        shipping: 9.99,                                // Shipping cost
        priceWithTax: 175.99,                          // Subtotal + tax
        cartTotal: 185.98                              // Grand total
    },
    
    item: [
        {
            productInfo: {
                productID: "RB-JKT-2024",
                productName: "2024 Team Jacket",
                productImage: "/images/jacket.jpg"
            },
            category: {
                primaryCategory: "Apparel"
            },
            quantity: 1,                               // Quantity
            price: {
                basePrice: 159.99,
                currency: "USD"
            },
            linkedProduct: [],                         // Related products
            attributes: {
                brand: "Red Bull Racing",
                variant: "Large"
            }
        }
    ],
    
    attributes: {}                                     // Custom attributes
};
```

### 3.7 Transaction Object

```javascript
gridboxLayer.transaction = {
    transactionID: "RF1-2024-ABC123",                  // Order ID
    
    profile: {
        profileInfo: {
            profileID: "user_123",                     // User ID
            userName: "John Doe"                       // Name
        },
        address: {                                     // Shipping address
            city: "Monaco",
            country: "MC",
            postalCode: "98000"
        }
    },
    
    total: {
        basePrice: 159.99,                             // Subtotal
        currency: "USD",                               // Currency
        taxRate: 0.1,                                  // Tax rate
        shipping: 9.99,                                // Shipping
        tax: 16.00,                                    // Tax amount
        transactionTotal: 185.98                       // Grand total
    },
    
    item: [                                            // Same as cart.item
        {
            productInfo: { ... },
            quantity: 1,
            price: { ... }
        }
    ],
    
    attributes: {                                      // Custom attributes
        paymentMethod: "credit_card",
        couponCode: "SUMMER2025"
    }
};
```

### 3.8 Session Object (NEW)

```javascript
gridboxLayer.session = {
    sessionId: "sess_a1b2c3d4-e5f6-xxx",              // Unique session ID
    isNewSession: true,                                // Is new session?
    startTime: "2025-01-15T12:00:00.000Z",            // Session start time
    pageViews: 3,                                      // Page views in session
    events: 12,                                        // Total events in session
    utmParams: {                                       // Campaign parameters
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "winter_sale"
    }
};
```

### 3.9 Context Object (NEW)

```javascript
gridboxLayer.context = {
    anonymousId: "anon_xxx-xxx-xxx",                   // Persistent user ID
    sessionId: "sess_xxx-xxx-xxx",                     // Current session ID
    pageInstanceId: "1705312345678",                   // Page instance (SPA)
    eventSequence: 12,                                 // Event counter
    referrer: "https://google.com",                    // Referrer URL
    timestamp: "2025-01-15T12:00:00.000Z"             // Last update time
};
```

---

## 4. Data Flow Architecture

### 4.1 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                                   │
│  (Click button, Add to cart, Submit form, View product, Complete purchase)  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPTURE LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. data-track attribute (auto-capture clicks)                              │
│  2. gridbox.addToCart(product, qty)                                         │
│  3. gridbox.purchase(transactionData)                                       │
│  4. gridbox.setUser(userData)                                               │
│  5. gridbox.link(eventData)                                                 │
│  6. gridbox.view(pageData)                                                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT LAYER (analytics.js)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Generate unique eventId                                                 │
│  2. Add eventIndex (sequence)                                               │
│  3. Add context (anonymousId, sessionId, isNewSession)                      │
│  4. Add timestamp                                                           │
│  5. Filter through CD_WHITELIST                                             │
│  6. Normalize data format                                                   │
│  7. Update session counters                                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CORE DATA LAYER (gridboxLayer)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ event[]      │  │ product[]    │  │ cart         │  │ transaction  │   │
│  │              │  │              │  │              │  │              │   │
│  │ • PageView   │  │ • productID  │  │ • item[]     │  │ • txnID      │   │
│  │ • AddToCart  │  │ • name       │  │ • cartTotal  │  │ • total      │   │
│  │ • Purchase   │  │ • price      │  │ • taxRate    │  │ • items[]    │   │
│  │ • UserEvent  │  │ • category   │  │ • shipping   │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ user[]       │  │ session      │  │ context      │                      │
│  │              │  │              │  │              │                      │
│  │ • anonymousId│  │ • sessionId  │  │ • anonymousId│                      │
│  │ • sessionId  │  │ • isNew      │  │ • sessionId  │                      │
│  │ • deviceType │  │ • pageViews  │  │ • eventSeq   │                      │
│  │ • browser    │  │ • utmParams  │  │ • timestamp  │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   GTM PROCESSING CODE (Custom HTML Tag)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Read gridboxLayer.event[] array                                         │
│  2. Track last processed index                                              │
│  3. Process only new events                                                 │
│  4. Convert W3C format to dataLayer format                                  │
│  5. Extract attributes array to flat object                                 │
│  6. Push to window.dataLayer                                                │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        window.dataLayer (GTM)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                           │
│    event: 'gridbox_event',                                                  │
│    gb_event_name: 'AddToCart',                                              │
│    gb_event_category: 'Ecommerce',                                          │
│    product_id: 'RB-JKT-2024',                                               │
│    cart_total: '159.99',                                                    │
│    anonymous_id: 'anon_xxx',                                                │
│    session_id: 'sess_xxx'                                                   │
│  }                                                                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GTM TRIGGERS → GA4 TAGS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  • GridBox - PageView      → GA4 Page View Event                            │
│  • GridBox - AddToCart     → GA4 Add to Cart Event                          │
│  • GridBox - Purchase      → GA4 Purchase Event                             │
│  • GridBox - Custom Event  → GA4 Custom Event                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Event Flow Example: Add to Cart

```
1. USER CLICKS "Add to Cart" button
   ↓
2. app.js calls:
   gridbox.addToCart({
       id: 'RB-JKT-2024',
       name: '2024 Team Jacket',
       price: 159.99
   }, 1)
   ↓
3. analytics.js enriches data:
   - Creates cartItem object
   - Checks if item exists in cart
   - Updates cart.item[] array
   - Recalculates cart totals
   - Generates eventId: "evt_1705312345678_abc"
   - Gets eventIndex: 5
   - Adds context: { anonymousId, sessionId }
   ↓
4. Pushes to gridboxLayer.event[]:
   {
       eventId: "evt_1705312345678_abc",
       eventIndex: 5,
       category: { primaryCategory: "Ecommerce" },
       eventInfo: {
           eventName: "AddToCart",
           key: "gb_cart_add_RB-JKT-2024",
           timeStamp: "2025-01-15T12:30:00.000Z"
       },
       context: {
           anonymousId: "anon_xxx",
           sessionId: "sess_xxx"
       },
       attributes: [
           { key: "product_id", value: "RB-JKT-2024" },
           { key: "cart_total", value: "159.99" }
       ]
   }
   ↓
5. Updates gridboxLayer.cart:
   cart.item.push(cartItem)
   cart.price.cartTotal = 159.99
   ↓
6. GTM processor reads gridboxLayer.event[5]
   ↓
7. Converts to dataLayer format and pushes:
   {
       event: 'gridbox_ecommerce',
       gb_event_name: 'AddToCart',
       product_id: 'RB-JKT-2024',
       cart_total: '159.99'
   }
   ↓
8. GTM trigger "GridBox - AddToCart" fires
   ↓
9. GA4 tag sends event to Google Analytics
```

---

## 5. User Identification System

### 5.1 Anonymous ID Generation

**Purpose:** Create a persistent unique identifier for each user across sessions.

```javascript
// Storage Key
const GB_USER_ID_KEY = 'gb_anonymous_id';

// Generation Function
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getAnonymousId() {
    // Check localStorage
    var id = localStorage.getItem(GB_USER_ID_KEY);
    
    if (!id) {
        // Generate new ID
        id = 'anon_' + generateUUID();
        localStorage.setItem(GB_USER_ID_KEY, id);
    }
    
    return id;
}

// Result: "anon_a1b2c3d4-e5f6-4a7b-8c9d-e1f2a3b4c5d6"
```

**Characteristics:**
- ✅ RFC4122-compliant UUID v4
- ✅ Stored in localStorage (persists across sessions)
- ✅ Prefixed with `anon_` for clarity
- ✅ Fallback for private browsing mode
- ✅ Unique per browser/device
- ✅ Never changes unless user clears storage

**Usage:**
```javascript
// Get anonymous ID
const anonymousId = gridbox.getAnonymousId();

// Access in gridboxLayer
gridboxLayer.user[0].profile[0].profileInfo.anonymousId
gridboxLayer.context.anonymousId

// Included in every event
event.context.anonymousId
```

### 5.2 User Lifecycle

```
FIRST VISIT
├─ Generate anonymousId → Store in localStorage
├─ Set as profileID (default)
├─ loginStatus = false
└─ userType = "guest"

USER LOGS IN
├─ gridbox.setUser({ id: 'user_123', email: 'john@example.com' })
├─ Update profileID = "user_123"
├─ loginStatus = true
├─ userType = "registered"
└─ anonymousId remains unchanged (for cross-device tracking)

USER LOGS OUT
├─ Reset profileID to anonymousId
├─ loginStatus = false
└─ userType = "guest"

SUBSEQUENT VISITS
├─ Retrieve anonymousId from localStorage
├─ Same anonymousId across sessions
└─ Check login status from cookies/API
```

---

## 6. Session Management

### 6.1 Session Structure

```javascript
// Storage Key
const GB_SESSION_KEY = 'gb_session';
const GB_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Session Object
{
    id: "sess_xxx-xxx-xxx",              // Unique session ID
    startTime: 1705312345678,            // Timestamp (ms)
    lastActivity: 1705313245678,         // Last activity timestamp
    pageViews: 3,                        // Pages viewed
    events: 12,                          // Total events
    isNew: true                          // Is new session?
}
```

### 6.2 Session Lifecycle

```
SESSION START (New Visitor or Timeout)
├─ Generate new sessionId
├─ Set startTime = now
├─ Set lastActivity = now
├─ pageViews = 0
├─ events = 0
└─ isNew = true

USER ACTIVITY (Within 30 min)
├─ Retrieve session from localStorage
├─ Update lastActivity = now
├─ Increment pageViews (on page view)
├─ Increment events (on any event)
├─ isNew = false
└─ Save to localStorage

SESSION TIMEOUT (> 30 min inactive)
├─ Previous session expires
├─ Generate NEW sessionId
├─ Reset counters
└─ isNew = true

PAGE REFRESH/NAVIGATION
├─ Check lastActivity timestamp
├─ If < 30 min → Continue session
└─ If > 30 min → New session
```

### 6.3 Session Data in gridboxLayer

```javascript
// Direct access
gridboxLayer.session = {
    sessionId: "sess_xxx",
    isNewSession: true,
    startTime: "2025-01-15T12:00:00Z",
    pageViews: 1,
    events: 3,
    utmParams: { utm_source: "google" }
};

// Also in user profile
gridboxLayer.user[0].profile[0].profileInfo.sessionId
gridboxLayer.user[0].profile[0].profileInfo.isNewSession

// And in context
gridboxLayer.context.sessionId

// Every event includes session context
event.context.sessionId
event.context.isNewSession
```

---

## 7. Event Processing Pipeline

### 7.1 Pipeline Stages

```
STAGE 1: CAPTURE
├─ data-track attribute clicked
├─ gridbox.addToCart() called
├─ gridbox.purchase() called
└─ gridbox.link() called

STAGE 2: VALIDATE
├─ Check eventPrefix (gb_)
├─ Validate format (category_action_label)
└─ Apply shouldFire() logic

STAGE 3: ENRICH
├─ Generate eventId
├─ Assign eventIndex (sequence)
├─ Add timestamp
├─ Add context (anonymousId, sessionId, isBot)
└─ Filter attributes through CD_WHITELIST

STAGE 4: NORMALIZE
├─ Convert to W3C format
├─ Create attributes array
├─ Set category object
└─ Set eventInfo object

STAGE 5: PERSIST
├─ Push to gridboxLayer.event[]
├─ Update gridboxLayer.cart (if cart event)
├─ Update gridboxLayer.product (if product event)
├─ Update gridboxLayer.transaction (if purchase)
└─ Update session counters

STAGE 6: SYNC (GTM)
├─ GTM processor reads gridboxLayer.event[]
├─ Convert W3C to flat format
├─ Push to window.dataLayer
└─ Trigger GTM tags
```

### 7.2 Event Categories & Types

| Category | Event Types | Updates |
|----------|-------------|---------|
| **PageView** | PageView | event[], page, session |
| **Ecommerce** | AddToCart, RemoveFromCart, UpdateCart, ClearCart, BeginCheckout, Purchase | event[], cart, transaction, session |
| **ProductInteraction** | ProductView | event[], product[], session |
| **UserEvent** | Click, Submit, UserIdentified, Login, Logout | event[], user[], session |
| **Performance** | PageLoadMetrics | event[] |

---

## 8. Storage & Persistence

### 8.1 localStorage Keys

```javascript
// User Identity
'gb_anonymous_id'         → "anon_xxx-xxx-xxx"          // Never expires

// Session
'gb_session'              → { id, startTime, ... }       // 30-min timeout

// UTM Parameters
'gb_utm_params'           → { utm_source, ... }          // Session lifetime

// User Preferences (optional, used by app.js)
'rf1_cart'                → Cart data                     // App-specific
'rf1_user'                → User data                     // App-specific
```

### 8.2 Data Retention

| Data Type | Location | Lifetime | Cleared By |
|-----------|----------|----------|------------|
| Anonymous ID | localStorage | Indefinite | User clears browser data |
| Session ID | localStorage | 30 min inactivity | Auto-expires |
| UTM Params | localStorage | Session | New UTM params or user clears |
| gridboxLayer | Memory | Page session | Page refresh (reconstructed) |
| Events | Memory | Page session | Page refresh |
| Cart | Memory + localStorage | Until purchase/clear | User action |

### 8.3 Privacy Compliance

```javascript
// Check Do Not Track
deviceInfo.doNotTrack = navigator.doNotTrack === '1';

// Bot Detection
deviceInfo.isBot = /bot|crawler|spider/i.test(ua);

// Cookie Consent Check
deviceInfo.cookieEnabled = navigator.cookieEnabled;

// Respect DNT in events
if (deviceInfo.doNotTrack) {
    // Can skip certain tracking
    // Or anonymize further
}
```

---

## Appendix: Quick Reference

### Global Objects

```javascript
window.gridboxLayer        // Core data layer (MAIN)
window.digitalData         // Alias to gridboxLayer
window.gridbox_data        // Flat key-value object
window.gridbox             // API namespace
window.gridboxAnalytics    // Core analytics object
window.racingF1Analytics   // Backward compatibility
```

### API Methods

```javascript
// Core Tracking
gridbox.view(data)
gridbox.link(data)
gridbox.track(actionType, payload)

// Products & Cart
gridbox.addProduct(product)
gridbox.addToCart(product, qty)
gridbox.removeFromCart(productId, qty)
gridbox.updateCartQuantity(productId, qty)
gridbox.clearCart()
gridbox.getCart()

// Purchase
gridbox.beginCheckout()
gridbox.purchase(transactionData)

// User
gridbox.setUser(userData)
gridbox.getUser()

// Utilities
gridbox.getAnonymousId()
gridbox.getSession()
gridbox.getDeviceInfo()
gridbox.getEngagement()
gridbox.getPerformance()
gridbox.getUTMParams()
gridbox.flatten(obj)
```

### Event Structure Template

```javascript
{
    eventId: "evt_<timestamp>_<random>",
    eventIndex: <sequence>,
    category: { primaryCategory: "<category>" },
    eventInfo: {
        eventName: "<name>",
        key: "gb_<key>",
        timeStamp: "<ISO>",
        pageId: "<pageId>",
        pageInstanceId: "<instanceId>"
    },
    context: {
        anonymousId: "<anon_id>",
        sessionId: "<sess_id>",
        isNewSession: <boolean>,
        isBot: <boolean>
    },
    attributes: [
        { key: "<key>", value: "<value>" }
    ]
}
```

---

**End of Architecture Documentation**
