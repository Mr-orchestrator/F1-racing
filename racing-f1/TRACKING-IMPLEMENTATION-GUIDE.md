# GridBox Analytics - Complete Tracking Implementation Guide

**Version 2.12.0** | gridboxLayer is the CORE DATA LAYER

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [gridboxLayer - Core Data Structure](#2-gridboxlayer---core-data-structure)
3. [Event System](#3-event-system)
4. [Public API Reference](#4-public-api-reference)
5. [GTM Processing Code](#5-gtm-processing-code)
6. [Implementation Examples](#6-implementation-examples)
7. [Testing & Debugging](#7-testing--debugging)

---

## 1. Architecture Overview

### Core Concept

**`gridboxLayer` is the SINGLE SOURCE OF TRUTH.** All user interactions update `gridboxLayer`, and GTM processing code reads from it to fire tags.

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTIONS                                │
│         (clicks, page views, add to cart, purchases)                          │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         GRIDBOX ANALYTICS LAYER                               │
│                            (analytics.js)                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ gridbox.view()│  │gridbox.link() │  │gridbox.       │  │gridbox.      │  │
│  │ (Page Views)  │  │(Interactions) │  │addToCart()    │  │purchase()    │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘  │
│          │                  │                  │                 │          │
│          └──────────────────┴──────────────────┴─────────────────┘          │
│                                        │                                    │
│                                        ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ALL UPDATES GO TO gridboxLayer (CORE)                   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • gridboxLayer.event[]      ← All events pushed here               │   │
│  │  • gridboxLayer.product[]    ← Products viewed/interacted           │   │
│  │  • gridboxLayer.cart         ← Shopping cart state                  │   │
│  │  • gridboxLayer.transaction  ← Completed purchases                  │   │
│  │  • gridboxLayer.user[]       ← User profile data                    │   │
│  │  • gridboxLayer.page         ← Current page info                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    window.gridboxLayer (CORE DATA LAYER)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   event[]   │  │  product[]  │  │    cart     │  │    transaction      │ │
│  │             │  │             │  │             │  │                     │ │
│  │ • PageView  │  │ • productID │  │ • item[]    │  │ • transactionID     │ │
│  │ • AddToCart │  │ • name      │  │ • cartTotal │  │ • total             │ │
│  │ • Purchase  │  │ • price     │  │ • shipping  │  │ • item[]            │ │
│  │ • UserEvent │  │ • category  │  │ • tax       │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                              │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    GTM PROCESSING CODE (Custom HTML Tag)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  • Reads gridboxLayer.event[] for new events                                 │
│  • Processes events and fires appropriate GA4/other tags                     │
│  • Maps gridboxLayer structure to tag requirements                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. gridboxLayer - Core Data Structure

### 2.1 Complete Structure

```javascript
window.gridboxLayer = {
    version: "2.12.0",
    libVersion: "1.1.0",
    
    // =========================================
    // EVENT ARRAY - All events stored here
    // GTM reads this array for processing
    // =========================================
    event: [
        {
            eventId: "evt_1705312345678_abc123",
            category: { primaryCategory: "PageView" },
            eventInfo: {
                eventName: "PageView",
                key: "gb_page_view",
                pageId: "HOME",
                pageInstanceId: "1705312345678",
                timeStamp: "2025-01-15T12:00:00.000Z"
            },
            attributes: [
                { key: "page_name", value: "Home Page" },
                { key: "page_type", value: "home" }
            ]
        }
    ],
    
    // =========================================
    // PAGE DATA
    // =========================================
    page: {
        pageInfo: {
            pageID: "HOME",
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
        }
    },
    
    // =========================================
    // USER DATA
    // =========================================
    user: [{
        profile: [{
            profileInfo: {
                profileID: "user_123",
                userName: "john.doe",
                email: "john@example.com",
                OS: "Windows",
                deviceType: "desktop",
                userAgent: "...",
                loginStatus: true
            },
            attributes: {
                userType: "registered",
                customerTier: "gold"
            }
        }]
    }],
    
    // =========================================
    // PRODUCT CATALOG - Products viewed/interacted
    // =========================================
    product: [
        {
            productInfo: {
                productID: "RB-JKT-2024",
                productName: "2024 Team Jacket",
                productImage: "/images/jacket.jpg",
                productURL: "/product/jacket",
                sku: "RB-JKT-2024"
            },
            category: {
                primaryCategory: "Apparel",
                subCategory: "Jackets"
            },
            price: {
                basePrice: 159.99,
                currency: "USD",
                salePrice: 159.99
            },
            attributes: {
                brand: "Red Bull Racing",
                variant: "Large",
                position: 1,
                list: "Featured Products"
            }
        }
    ],
    
    // =========================================
    // SHOPPING CART
    // =========================================
    cart: {
        cartID: "cart_1705312345678",
        price: {
            basePrice: 159.99,
            currency: "USD",
            taxRate: 0.1,
            shipping: 9.99,
            priceWithTax: 175.99,
            cartTotal: 185.98
        },
        item: [
            {
                productInfo: {
                    productID: "RB-JKT-2024",
                    productName: "2024 Team Jacket",
                    productImage: "/images/jacket.jpg"
                },
                category: { primaryCategory: "Apparel" },
                quantity: 1,
                price: { basePrice: 159.99, currency: "USD" },
                attributes: { brand: "Red Bull Racing" }
            }
        ]
    },
    
    // =========================================
    // TRANSACTION - Completed purchases
    // =========================================
    transaction: {
        transactionID: "RF1-2024-ABC123",
        profile: {
            profileInfo: { profileID: "user_123" },
            address: { city: "Monaco", country: "MC" }
        },
        total: {
            basePrice: 159.99,
            currency: "USD",
            taxRate: 0.1,
            shipping: 9.99,
            tax: 16.00,
            transactionTotal: 185.98
        },
        item: [/* same as cart.item */]
    }
};
```

### 2.2 Event Categories

| Category | Description | Example Events |
|----------|-------------|----------------|
| `PageView` | Page/screen views | Initial load, SPA navigation |
| `Ecommerce` | Shopping actions | AddToCart, RemoveFromCart, Purchase, BeginCheckout |
| `ProductInteraction` | Product engagement | ProductView |
| `UserEvent` | User interactions | Click, Submit, UserIdentified |

### 2.3 Event Structure

Every event in `gridboxLayer.event[]` has this structure:

```javascript
{
    eventId: "evt_<timestamp>_<random>",  // Unique ID
    category: {
        primaryCategory: "Ecommerce"       // Event category
    },
    eventInfo: {
        eventName: "AddToCart",            // Human-readable name
        key: "gb_cart_add_RB-JKT-2024",   // Machine key
        timeStamp: "2025-01-15T12:00:00Z", // ISO timestamp
        pageId: "MERCHANDISE",             // Current page
        pageInstanceId: "1705312345678"    // SPA instance
    },
    attributes: [                          // Key-value pairs
        { key: "product_id", value: "RB-JKT-2024" },
        { key: "product_price", value: "159.99" }
    ]
}
```

---

## 3. Event System

### 3.1 Action Type Format (Data Identifier)

All events use an `action_type` identifier with this format:

```
gb_<category>_<action>_<label>
```

**Components:**
| Component | Description | Examples |
|-----------|-------------|----------|
| `gb_` | Required prefix | Always `gb_` |
| `category` | Section/feature area | `navigation-main`, `product-actions`, `ecommerce-cart` |
| `action` | User action type | `click`, `view`, `submit` |
| `label` | Specific element | `add-to-cart`, `teams`, `signup` |

**Valid Examples:**
- `gb_navigation-main_click_teams`
- `gb_product-actions_click_add-to-cart`
- `gb_hero-cta_click_shop-now`
- `gb_login-form_submit_login-success`

### 3.2 Event Callback (gbEventCallback / rf1EventCallback)

Processes events with `gb_` prefix validation.

```javascript
// Signature
window.gbEventCallback(actionType, payload);

// Example
window.gbEventCallback('gb_product-actions_click_add-to-cart', {
    CD: {
        product_id: 'RB-JKT-2024',
        product_name: '2024 Team Jacket',
        product_price: '159.99'
    }
});
```

**Processing Pipeline:**
1. Validate `gb_` prefix exists
2. Split action_type into category_action_label (must be 3 parts)
3. Normalize strings (replace `-` with spaces, lowercase)
4. Set auto-flags (`ga_eventClick`, `ga_eventView`)
5. Filter payload.CD through whitelist
6. Push to `dataLayer` and `digitalData.event[]`

### 3.3 Link Callback (gbLinkCallback / rf1LinkCallback)

For structured event data with promotion/rank/price logic.

```javascript
// Signature
window.gbLinkCallback(category, structuredPayload);

// Example
window.gbLinkCallback('ecommerce-cart', {
    action: 'click',
    label: 'add-item',
    value: 159.99,
    price: '159.99',
    rank: 1,
    promotion: {
        id: 'PROMO-001',
        name: 'Summer Sale',
        creative: 'banner-hero',
        position: 1
    },
    CD: {
        product_id: 'RB-JKT-2024',
        product_name: '2024 Team Jacket',
        product_category: 'Apparel'
    }
});
```

---

## 4. Custom Dimensions Whitelist

Only these dimensions pass through to GTM dataLayer:

### Product Dimensions
- `product_id`, `product_name`, `product_category`, `product_price`
- `product_brand`, `product_variant`, `product_quantity`, `product_position`
- `product_list`, `product_coupon`

### Transaction Dimensions
- `transaction_id`, `transaction_total`, `transaction_revenue`
- `transaction_currency`, `transaction_tax`, `transaction_shipping`
- `transaction_coupon`

### User Dimensions
- `user_id`, `user_type`, `user_status`, `customer_tier`

### Page Dimensions
- `page_type`, `page_category`, `page_subcategory`, `page_name`
- `page_url`, `page_path`, `content_type`, `content_id`

### Campaign Dimensions
- `campaign_source`, `campaign_medium`, `campaign_name`
- `campaign_term`, `campaign_content`

### Experience Dimensions
- `experience_type`, `experience_name`, `race_name`
- `race_location`, `team_name`

### Promo Dimensions
- `promo_id`, `promo_name`, `promo_creative`, `promo_position`

### Error Dimensions
- `ga_errorMessage`, `error_type`, `error_code`

### Auto Flags
- `ga_eventClick`, `ga_eventView`, `error_counter`

---

## 4. Public API Reference

All methods update `gridboxLayer` (core data layer). GTM processing code reads from gridboxLayer.

### 4.1 Page View Tracking

```javascript
// gridbox.view(data, callback)
// Updates: gridboxLayer.page, gridboxLayer.event[]

gridbox.view({
    page_name: 'Product Detail',
    page_type: 'pdp',
    page_category: 'merchandise'
});
```

### 4.2 Interaction Tracking

```javascript
// gridbox.link(data, callback)
// Updates: gridboxLayer.event[]

gridbox.link({
    event_name: 'button_click',
    event_category: 'navigation',
    event_action: 'click',
    event_label: 'teams'
});
```

### 4.3 Product Management

```javascript
// gridbox.addProduct(productData)
// Updates: gridboxLayer.product[], gridboxLayer.event[]

gridbox.addProduct({
    id: 'RB-JKT-2024',
    name: '2024 Team Jacket',
    price: 159.99,
    category: 'Apparel',
    brand: 'Red Bull Racing'
});
```

### 4.4 Cart Management

```javascript
// gridbox.addToCart(productData, quantity)
// Updates: gridboxLayer.cart.item[], gridboxLayer.event[]

gridbox.addToCart({
    id: 'RB-JKT-2024',
    name: '2024 Team Jacket',
    price: 159.99,
    category: 'Apparel'
}, 1);

// gridbox.removeFromCart(productId, quantity)
gridbox.removeFromCart('RB-JKT-2024');

// gridbox.updateCartQuantity(productId, newQuantity)
gridbox.updateCartQuantity('RB-JKT-2024', 2);

// gridbox.clearCart()
gridbox.clearCart();

// gridbox.getCart() - returns current cart state
const cart = gridbox.getCart();
console.log(cart.price.cartTotal);
```

### 4.5 Checkout & Purchase

```javascript
// gridbox.beginCheckout()
// Updates: gridboxLayer.event[]

gridbox.beginCheckout();

// gridbox.purchase(transactionData)
// Updates: gridboxLayer.transaction, gridboxLayer.event[], clears cart

gridbox.purchase({
    orderId: 'RF1-2024-ABC123',
    total: 185.98,
    tax: 16.00,
    shipping: 9.99,
    currency: 'USD'
});
```

### 4.6 User Management

```javascript
// gridbox.setUser(userData)
// Updates: gridboxLayer.user[], gridboxLayer.event[]

gridbox.setUser({
    id: 'user_123',
    email: 'john@example.com',
    type: 'registered',
    tier: 'gold'
});

// gridbox.getUser() - returns current user
const user = gridbox.getUser();
```

### 4.7 Direct Access

```javascript
// Direct access to core data layer
window.gridboxLayer         // Core data layer (MAIN)
window.digitalData          // Alias to gridboxLayer
window.gridbox.layer        // Also gridboxLayer

// Flat data object
window.gridbox_data
window.gridbox.data

// Callback functions
window.gbEventCallback(actionType, payload)
window.gbLinkCallback(category, structuredPayload)
```

### 4.8 Complete API List

| Method | Updates | Description |
|--------|---------|-------------|
| `gridbox.view()` | page, event[] | Track page views |
| `gridbox.link()` | event[] | Track interactions |
| `gridbox.track()` | event[] | Direct event callback |
| `gridbox.addProduct()` | product[], event[] | Add product to catalog |
| `gridbox.addToCart()` | cart.item[], event[] | Add item to cart |
| `gridbox.removeFromCart()` | cart.item[], event[] | Remove item from cart |
| `gridbox.updateCartQuantity()` | cart.item[], event[] | Update item quantity |
| `gridbox.clearCart()` | cart, event[] | Clear entire cart |
| `gridbox.getCart()` | - | Get cart state |
| `gridbox.beginCheckout()` | event[] | Start checkout |
| `gridbox.purchase()` | transaction, event[] | Complete purchase |
| `gridbox.setUser()` | user[], event[] | Set user data |
| `gridbox.getUser()` | - | Get user data |
| `gridbox.flatten()` | - | Utility: flatten objects |

---

## 5. GTM Processing Code

GTM reads from `gridboxLayer` and processes events. Create a Custom HTML tag in GTM with this code:

### 5.1 GTM Event Processor Tag

```html
<script>
(function() {
    // GridBox Event Processor for GTM
    // Reads gridboxLayer.event[] and fires appropriate events
    
    var gridboxLayer = window.gridboxLayer;
    if (!gridboxLayer || !gridboxLayer.event) return;
    
    var processedIndex = window._gbProcessedIndex || 0;
    var events = gridboxLayer.event;
    
    // Process new events only
    for (var i = processedIndex; i < events.length; i++) {
        var event = events[i];
        var category = event.category ? event.category.primaryCategory : '';
        var eventName = event.eventInfo ? event.eventInfo.eventName : '';
        
        // Convert attributes array to object
        var attrs = {};
        if (event.attributes) {
            event.attributes.forEach(function(attr) {
                attrs[attr.key] = attr.value;
            });
        }
        
        // Push to dataLayer based on event category
        var dlEvent = {
            event: 'gridbox_event',
            gb_event_id: event.eventId,
            gb_event_category: category,
            gb_event_name: eventName,
            gb_event_key: event.eventInfo ? event.eventInfo.key : '',
            gb_page_id: event.eventInfo ? event.eventInfo.pageId : '',
            gb_timestamp: event.eventInfo ? event.eventInfo.timeStamp : ''
        };
        
        // Merge attributes
        Object.assign(dlEvent, attrs);
        
        // Special handling for ecommerce events
        if (category === 'Ecommerce') {
            dlEvent.event = 'gridbox_ecommerce';
            
            if (eventName === 'Purchase') {
                dlEvent.ecommerce = {
                    transaction_id: attrs.transaction_id,
                    value: parseFloat(attrs.transaction_total) || 0,
                    currency: attrs.currency || 'USD',
                    tax: parseFloat(attrs.transaction_tax) || 0,
                    shipping: parseFloat(attrs.transaction_shipping) || 0
                };
            }
        }
        
        // Push to GTM dataLayer
        window.dataLayer.push(dlEvent);
    }
    
    // Update processed index
    window._gbProcessedIndex = events.length;
})();
</script>
```

### 5.2 GTM Trigger Configuration

| Trigger Name | Type | Condition |
|-------------|------|-----------|
| GridBox - All Events | Custom Event | `event equals gridbox_event` |
| GridBox - Ecommerce | Custom Event | `event equals gridbox_ecommerce` |
| GridBox - PageView | Custom Event | `gb_event_category equals PageView` |
| GridBox - AddToCart | Custom Event | `gb_event_name equals AddToCart` |
| GridBox - Purchase | Custom Event | `gb_event_name equals Purchase` |

### 5.3 GTM Variable Configuration

| Variable Name | Type | Value |
|--------------|------|-------|
| GB - Event Name | Data Layer Variable | `gb_event_name` |
| GB - Event Category | Data Layer Variable | `gb_event_category` |
| GB - Event Key | Data Layer Variable | `gb_event_key` |
| GB - Product ID | Data Layer Variable | `product_id` |
| GB - Product Name | Data Layer Variable | `product_name` |
| GB - Product Price | Data Layer Variable | `product_price` |
| GB - Cart Total | Data Layer Variable | `cart_total` |
| GB - Transaction ID | Data Layer Variable | `transaction_id` |
| GB - Transaction Total | Data Layer Variable | `transaction_total` |

### 5.4 GA4 Tag Configuration

| Tag Name | Trigger | Event Name | Parameters |
|----------|---------|------------|------------|
| GA4 - Page View | GridBox - PageView | `page_view` | page_name, page_type |
| GA4 - Add to Cart | GridBox - AddToCart | `add_to_cart` | product_id, product_name, product_price |
| GA4 - Purchase | GridBox - Purchase | `purchase` | ecommerce object |
| GA4 - Custom Event | GridBox - All Events | `{{GB - Event Name}}` | All GB variables |

---

## 7. Implementation Examples

### 7.1 HTML data-track Attribute

```html
<!-- Navigation -->
<a href="teams.html" data-track="navigation-main_click_teams">Teams</a>

<!-- Product Card -->
<button data-track="product-actions_click_add-to-cart"
        data-product-id="RB-JKT-2024"
        data-product-name="2024 Team Jacket"
        data-product-price="159.99"
        data-product-category="Apparel">
    Add to Cart
</button>

<!-- CTA Button -->
<a href="merchandise.html" data-track="hero-cta_click_shop-now">
    Shop Collection
</a>
```

### 7.2 JavaScript Event Tracking

```javascript
// Form submission
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Track login attempt
    window.racingF1Analytics.linkCallback('login-form', {
        action: 'submit',
        label: 'login-success',
        CD: {
            user_type: 'registered'
        }
    });
});

// Add to cart
function addToCart(product) {
    window.racingF1Analytics.linkCallback('ecommerce-cart', {
        action: 'click',
        label: 'add-item',
        value: product.price,
        price: product.price,
        rank: cartPosition,
        CD: {
            product_id: product.id,
            product_name: product.name,
            product_price: product.price,
            product_category: product.category,
            product_quantity: '1'
        }
    });
}

// Purchase complete
function completePurchase(order) {
    window.gridboxAnalytics.setTransaction({
        orderId: order.id,
        total: order.total,
        tax: order.tax,
        shipping: order.shipping,
        items: order.items
    });
}
```

### 7.3 SPA Page View Tracking

```javascript
// Manual page view for SPA navigation
function navigateToPage(pageId) {
    gridbox.view({
        page_name: pageId,
        page_type: pageId.toLowerCase(),
        page_category: 'booking'
    });
}
```

---

## 8. Issues Fixed

### 8.1 Critical Issues Resolved

| Issue | Description | Fix |
|-------|-------------|-----|
| Missing dataLayer push | Events only pushed to gridboxLayer, not GTM dataLayer | Added `window.dataLayer.push()` to all event functions |
| Missing CD_WHITELIST | `filterByWhitelist()` referenced undefined constant | Added complete CD_WHITELIST array with 40+ dimensions |
| Missing digitalData alias | Tests expected `window.digitalData` | Added `window.digitalData = window.gridboxLayer` |
| Missing flatten() function | Tests expected `gridbox.flatten()` | Implemented flatten function for nested objects |
| Missing racingF1Analytics | app.js used `window.racingF1Analytics` | Added backward compatibility alias |
| No initial page view | Page view not fired on page load | Added auto-fire of `gridbox_page_view` on init |
| Missing eventTimestamp | W3C events missing timestamp | Added `eventTimestamp` to all W3C events |
| Incomplete cart structure | cart object missing price/item | Added complete cart structure with price object |

### 8.2 Functions Now Working

- ✅ `gridbox.view()` → Pushes to dataLayer
- ✅ `gridbox.link()` → Pushes to dataLayer with whitelist filtering
- ✅ `gridbox.track()` → Direct event callback
- ✅ `gridbox.flatten()` → Object flattening utility
- ✅ `gbEventCallback()` → Event processing with validation
- ✅ `gbLinkCallback()` → Link processing with promo support
- ✅ `setTransaction()` → Purchase event with ecommerce object
- ✅ `data-track` clicks → Auto-captured and processed

---

## 9. Testing & Debugging

### 9.1 Console Commands

```javascript
// View GTM dataLayer
console.log(window.dataLayer);

// View W3C digitalData
console.log(window.digitalData);

// View flat data object
console.log(window.gridbox_data);

// Test page view
gridbox.view({ page_name: 'Test Page' });

// Test link event
gridbox.link({
    event_category: 'test',
    event_action: 'click',
    event_label: 'button'
});

// Test event callback
gbEventCallback('gb_test_click_button', {
    CD: { product_id: 'TEST-001' }
});

// Test link callback
gbLinkCallback('test-category', {
    action: 'click',
    label: 'test-label',
    CD: { product_id: 'TEST-001' }
});

// View last dataLayer push
console.log(window.dataLayer[window.dataLayer.length - 1]);
```

### 9.2 Debug Mode

Enable debug logging in console:
```javascript
window.gridboxAnalytics.config.debug = true;
```

### 9.3 Test Page

Open `test-datalayer.html` in browser to run automated tests:
- Core DataLayer Tests
- GridBox API Tests
- Event Tracking Tests
- SPA Flow Tests

### 9.4 GTM Preview Mode

1. Open GTM container
2. Click **Preview** button
3. Enter site URL
4. Verify triggers fire correctly
5. Check variable values

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.11.0 | 2025-01-15 | Major fix: Added dataLayer push, CD_WHITELIST, digitalData alias, flatten(), racingF1Analytics alias |
| 2.10.0 | 2025-01-03 | Initial GridBox implementation |

---

**GridBox Analytics** - Enterprise-grade data layer for modern web applications.
