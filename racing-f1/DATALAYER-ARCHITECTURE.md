# GridBox Analytics - DataLayer Architecture

## Overview

GridBox is an enterprise-grade analytics data layer implementation that follows the W3C Customer Experience Digital Data Layer specification while also supporting Google Tag Manager (GTM) dataLayer format.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           BROWSER WINDOW                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      GridBox Analytics Layer                        │ │
│  │                         (analytics.js)                              │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │  ┌─────────────────────┐     ┌─────────────────────┐              │ │
│  │  │   digitalData       │     │    dataLayer        │              │ │
│  │  │   (W3C Standard)    │     │    (GTM Format)     │              │ │
│  │  ├─────────────────────┤     ├─────────────────────┤              │ │
│  │  │ • page              │     │ • event             │              │ │
│  │  │ • user[]            │     │ • page_name         │              │ │
│  │  │ • product[]         │     │ • page_type         │              │ │
│  │  │ • cart              │     │ • user_id           │              │ │
│  │  │ • transaction       │     │ • ecommerce         │              │ │
│  │  │ • event[]           │     │ • custom dimensions │              │ │
│  │  │ • component[]       │     │                     │              │ │
│  │  └─────────────────────┘     └─────────────────────┘              │ │
│  │           │                           │                            │ │
│  │           ▼                           ▼                            │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                    gridbox_data                              │  │ │
│  │  │              (Flat Key-Value Object)                         │  │ │
│  │  │  Like utag_data - merged into all events                     │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Public API                                │  │ │
│  │  ├─────────────────────────────────────────────────────────────┤  │ │
│  │  │  gridbox.view(data, callback)  - Page view tracking         │  │ │
│  │  │  gridbox.link(data, callback)  - Interaction tracking       │  │ │
│  │  │  gridbox.track(action_type, payload) - Event callback       │  │ │
│  │  │  gridbox.flatten(obj)          - Flatten digitalData        │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    SPA Event Layer (booking-spa.html)               │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  Manual page view triggering for Single Page Applications           │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │  gridboxSPA.triggerPageView(pageId)                         │   │ │
│  │  │  gridboxSPA.trackUserEvent(key, name, component, attrs)     │   │ │
│  │  │  gridboxSPA.trackDisplayEvent(key, name, component, attrs)  │   │ │
│  │  │  gridboxSPA.trackCustomMetric(key, name, attrs)             │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        TAG MANAGEMENT SYSTEMS                            │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐   │
│  │  Google Tag        │  │  Google Analytics  │  │  Other Tags      │   │
│  │  Manager (GTM)     │  │  4 (GA4)           │  │  (Meta, etc.)    │   │
│  └────────────────────┘  └────────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Layer Objects

### 1. digitalData (W3C Standard)

The primary data layer following W3C Customer Experience Digital Data Layer specification.

```javascript
window.digitalData = {
    page: {
        pageInfo: {
            pageId: "HOME",
            pageName: "Home Page",
            pageURL: "https://example.com/",
            referringURL: "",
            language: "en",
            sysEnv: "desktop"
        },
        category: {
            primaryCategory: "home",
            subCategory: "",
            pageType: "home"
        },
        attributes: {}
    },
    user: [{
        profile: [{
            profileInfo: {
                profileID: "user_123",
                userName: "john.doe",
                email: "john@example.com"
            },
            attributes: {
                loggedIn: true,
                userType: "registered",
                customerTier: "gold"
            }
        }]
    }],
    product: [],
    cart: {
        cartID: "cart_456",
        price: {
            basePrice: 100.00,
            currency: "USD",
            taxRate: 0.1,
            shipping: 9.99,
            cartTotal: 119.99
        },
        item: [
            {
                productInfo: {
                    productID: "SKU-001",
                    productName: "Team Jacket",
                    productImage: "/images/jacket.jpg"
                },
                category: {
                    primaryCategory: "apparel"
                },
                quantity: 1,
                price: {
                    basePrice: 100.00,
                    currency: "USD"
                }
            }
        ]
    },
    transaction: {
        transactionID: "RF1-2025-123456",
        profile: {
            profileInfo: {},
            address: {}
        },
        total: {
            basePrice: 100.00,
            currency: "USD",
            transactionTotal: 119.99
        },
        item: []
    },
    event: [],      // Array of all tracked events
    component: [],  // Component-level data
    version: "1.0"
};
```

### 2. dataLayer (GTM Format)

Google Tag Manager compatible data layer for tag firing.

```javascript
window.dataLayer = [
    {
        event: "gridbox_page_view",
        page_name: "Home Page",
        page_type: "home",
        page_category: "home",
        page_url: "https://example.com/",
        page_path: "/"
    },
    {
        event: "retail_event",
        action_type: "gb_product_click_jacket",
        eventCategory: "product",
        eventAction: "click",
        eventLabel: "jacket",
        product_id: "SKU-001",
        product_name: "Team Jacket",
        product_price: 100.00
    }
];
```

### 3. gridbox_data (Flat Data Object)

Similar to Tealium's `utag_data`, this flat object is merged into all events.

```javascript
window.gridbox_data = {
    page_name: "Home Page",
    page_type: "home",
    page_category: "home",
    page_url: "https://example.com/",
    page_path: "/",
    user_id: "user_123",
    user_logged_in: true,
    user_type: "registered"
};
```

## Event Structure

### Standard Events (Multi-Page)

Events pushed by `gridbox.view()` and `gridbox.link()`:

```javascript
// Page View Event (gridbox.view)
{
    event: "gridbox_page_view",
    page_name: "Product Page",
    page_type: "pdp",
    page_category: "merchandise",
    page_url: "https://example.com/product/123",
    page_path: "/product/123"
}

// Interaction Event (gridbox.link)
{
    event: "retail_event",
    action_type: "gb_cart_click_add",
    event_name: "add_to_cart",
    event_category: "cart",
    event_action: "click",
    event_label: "add",
    product_id: "SKU-001",
    product_name: "Team Jacket",
    product_price: 100.00
}
```

### SPA Events (Single Page Application)

Events pushed to `digitalData.event[]` with W3C-like structure:

```javascript
// PageView Event
{
    category: {
        primaryCategory: "PageView"
    },
    eventInfo: {
        eventName: "PageView",
        pageId: "TICKETSELECTION",
        timeStamp: "2025-01-03T13:31:35.889Z",
        pageInstanceId: "1735912295889"
    }
}

// UserEvent
{
    category: {
        primaryCategory: "UserEvent"
    },
    eventInfo: {
        key: "RaceSelection",
        eventName: "Select Race",
        componentId: "race-options",
        timeStamp: "2025-01-03T13:31:40.123Z",
        pageId: "TICKETSELECTION",
        pageInstanceId: "1735912295889"
    },
    attributes: [
        { key: "raceId", value: "monaco" },
        { key: "raceName", value: "Monaco Grand Prix" },
        { key: "basePrice", value: "450" },
        { key: "currency", value: "USD" },
        { key: "PageID", value: "TICKETSELECTION" }
    ]
}

// Display Event
{
    category: {
        primaryCategory: "Display"
    },
    eventInfo: {
        key: "PaymentFormAvailable",
        eventName: "Payment Form Displayed",
        componentId: "payment-form",
        timeStamp: "2025-01-03T13:31:42.456Z",
        pageId: "TRAVELERDETAILS",
        pageInstanceId: "1735912302456"
    },
    attributes: [
        { key: "PageID", value: "TRAVELERDETAILS" }
    ]
}

// CustomMetric Event
{
    category: {
        primaryCategory: "CustomMetric"
    },
    eventInfo: {
        key: "TTIPerformance",
        eventName: "TTI (Time to Interactive)",
        timeStamp: "2025-01-03T13:31:38.559Z",
        pageId: "TICKETSELECTION",
        pageInstanceId: "1735912295889"
    },
    attributes: [
        { key: "TTI", value: 2500 },
        { key: "PageID", value: "TICKETSELECTION" }
    ]
}
```

## Event Categories

| Category | Description | Example Events |
|----------|-------------|----------------|
| `PageView` | Virtual page views in SPA | Page navigation |
| `UserEvent` | User interactions | Clicks, selections, form inputs |
| `Display` | Component visibility | Form displayed, modal opened |
| `CustomMetric` | Performance/business metrics | TTI, purchase complete |
| `Warning` | API/system warnings | Low availability, errors |

## API Reference

### gridbox.view(data, callback)

Track page views. Automatically merges `gridbox_data`.

```javascript
gridbox.view({
    page_name: "Product Detail",
    page_type: "pdp",
    product_id: "SKU-001"
});
```

### gridbox.link(data, callback)

Track user interactions.

```javascript
gridbox.link({
    event_name: "add_to_cart",
    event_category: "ecommerce",
    event_action: "click",
    event_label: "add-button",
    product_id: "SKU-001",
    product_price: 100.00
});
```

### gridbox.track(action_type, payload)

Direct event callback (uses `gb_` prefix validation).

```javascript
gridbox.track("gb_product_click_view", {
    CD: {
        product_id: "SKU-001",
        product_name: "Team Jacket"
    }
});
```

### SPA: gridboxSPA.triggerPageView(pageId)

Manual page view for SPA navigation.

```javascript
gridboxSPA.triggerPageView("CHECKOUT");
```

### SPA: gridboxSPA.trackUserEvent(key, eventName, componentId, attributes)

Track user interactions in SPA.

```javascript
gridboxSPA.trackUserEvent(
    "AddToCart",
    "Add item to cart",
    "product-card",
    [
        { key: "productId", value: "SKU-001" },
        { key: "quantity", value: "1" }
    ]
);
```

## Data-Track Attribute

HTML elements with `data-track` attribute are automatically tracked on click:

```html
<button data-track="product_click_add-to-cart" 
        data-product-id="SKU-001"
        data-product-name="Team Jacket"
        data-product-price="100">
    Add to Cart
</button>
```

Format: `category_action_label`

## Custom Dimension Whitelist

Only these dimensions are passed through to GTM:

- **Product**: `product_id`, `product_name`, `product_category`, `product_price`, `product_brand`, `product_variant`, `product_quantity`, `product_position`, `product_list`
- **Transaction**: `transaction_id`, `transaction_total`, `transaction_currency`, `transaction_tax`, `transaction_shipping`, `transaction_coupon`
- **User**: `user_id`, `user_type`, `user_status`, `customer_tier`
- **Page**: `page_type`, `page_category`, `page_subcategory`, `content_type`, `content_id`
- **Campaign**: `campaign_source`, `campaign_medium`, `campaign_name`, `campaign_term`, `campaign_content`
- **Experience**: `experience_type`, `experience_name`, `race_name`, `race_location`, `team_name`
- **Promo**: `promo_id`, `promo_name`, `promo_creative`, `promo_position`
- **Error**: `ga_errorMessage`, `error_type`, `error_code`
- **Flags**: `ga_eventClick`, `ga_eventView`, `error_counter`

## GTM Integration

### Required Variables

| Variable Name | Type | Value |
|--------------|------|-------|
| `DLV - event` | Data Layer Variable | `event` |
| `DLV - page_name` | Data Layer Variable | `page_name` |
| `DLV - page_type` | Data Layer Variable | `page_type` |
| `DLV - action_type` | Data Layer Variable | `action_type` |
| `DLV - eventCategory` | Data Layer Variable | `eventCategory` |
| `DLV - eventAction` | Data Layer Variable | `eventAction` |
| `DLV - eventLabel` | Data Layer Variable | `eventLabel` |

### Required Triggers

| Trigger Name | Type | Condition |
|-------------|------|-----------|
| `GridBox - Page View` | Custom Event | `event equals gridbox_page_view` |
| `GridBox - Retail Event` | Custom Event | `event equals retail_event` |
| `GridBox - SPA Event` | Custom Event | `event equals digitalData_event` |

### Required Tags

| Tag Name | Type | Trigger |
|----------|------|---------|
| `GA4 - Page View` | GA4 Event | GridBox - Page View |
| `GA4 - Custom Event` | GA4 Event | GridBox - Retail Event |
| `GA4 - SPA Event` | GA4 Event | GridBox - SPA Event |

## Testing & Debugging

### Console Commands

```javascript
// View all digitalData events
digitalData.event

// View current dataLayer
dataLayer

// View flat data object
gridbox_data

// Manual page view
gridbox.view({ page_name: "Test Page" });

// Manual link tracking
gridbox.link({ 
    event_category: "test", 
    event_action: "click", 
    event_label: "button" 
});

// SPA: View all events
gridboxSPA.getDigitalData().event

// SPA: Manual page view
gridboxSPA.triggerPageView("TEST_PAGE");
```

### Debug Mode

Debug mode is enabled by default. Check browser console for:
- `[GridBox]` - Main analytics layer logs
- `[GridBox SPA]` - SPA-specific logs
- `[digitalData.event]` - Event push confirmations

## File Structure

```
racing-f1/
├── analytics.js           # Main GridBox analytics layer
├── booking-spa.html       # SPA with manual page tracking
├── index.html             # Home page
├── teams.html             # Teams page
├── merchandise.html       # Product listing
├── tickets.html           # Ticket booking
├── experiences.html       # VIP experiences
├── calendar.html          # Race calendar
├── cart.html              # Shopping cart
├── checkout.html          # Checkout flow
├── login.html             # Authentication
├── support.html           # Help & support
├── privacy.html           # Privacy policy
├── terms.html             # Terms of service
└── DATALAYER-ARCHITECTURE.md  # This document
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-03 | Initial release with GridBox naming |

---

**GridBox Analytics** - Enterprise-grade data layer for modern web applications.
