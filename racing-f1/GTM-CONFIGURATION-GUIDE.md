# Google Tag Manager & GA4 Configuration Guide
## Racing F1 Analytics Implementation

---

## Table of Contents
1. [GTM Container Setup](#1-gtm-container-setup)
2. [DataLayer Structure](#2-datalayer-structure)
3. [Variable Configuration](#3-variable-configuration)
4. [Trigger Configuration](#4-trigger-configuration)
5. [Tag Configuration](#5-tag-configuration)
6. [GA4 Custom Dimensions Setup](#6-ga4-custom-dimensions-setup)
7. [Testing & Debugging](#7-testing--debugging)

---

## 1. GTM Container Setup

### Step 1: Create GTM Account
1. Go to [tagmanager.google.com](https://tagmanager.google.com)
2. Click **Create Account**
3. Enter account name: `Racing F1`
4. Enter container name: `racingf1.com`
5. Select **Web** as target platform
6. Accept Terms of Service

### Step 2: Install GTM Code
Add to `<head>` section (as high as possible):
```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->
```

Add after opening `<body>` tag:
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

---

## 2. DataLayer Structure

### Event Schema
All events pushed to dataLayer follow this structure:

```javascript
window.dataLayer.push({
    event: 'retail_event',           // Trigger event name
    action_type: 'rf1_category_action_label',  // rf1_ prefixed identifier
    eventCategory: 'category name',   // Normalized category
    eventAction: 'action name',       // Normalized action (click/view)
    eventLabel: 'label name',         // Normalized label
    eventName: 'label name',          // Same as eventLabel
    ga_eventClick: '1',               // Auto-flag for clicks
    ga_eventView: '1',                // Auto-flag for views
    // Custom dimensions from CD whitelist
    product_id: 'RB-JKT-2024',
    product_name: '2024 Team Jacket',
    product_price: '159.99',
    product_category: 'Apparel'
});
```

### Event Naming Convention (rf1_ prefix)
Format: `rf1_<category>_<action>_<label>`

| Component | Description | Example |
|-----------|-------------|---------|
| `rf1_` | Required prefix for all events | `rf1_` |
| `category` | Section/feature area | `navigation-main`, `product-actions` |
| `action` | User action type | `click`, `view`, `submit` |
| `label` | Specific element/outcome | `add-to-cart`, `teams`, `signup` |

**Examples:**
- `rf1_navigation-main_click_teams`
- `rf1_product-actions_click_add-to-cart`
- `rf1_ecommerce-cart_click_add-item`
- `rf1_login-form_submit_login-success`

### Page View Event
```javascript
window.dataLayer.push({
    event: 'page_view',
    page_title: 'Merchandise - Racing F1',
    page_location: 'https://racingf1.com/merchandise.html',
    page_path: '/merchandise.html'
});
```

### E-commerce Purchase Event
```javascript
window.dataLayer.push({
    event: 'purchase',
    ecommerce: {
        transaction_id: 'RF1-2024-ABC123',
        value: 189.98,
        tax: 17.27,
        shipping: 9.99,
        currency: 'USD',
        items: [{
            item_id: 'RB-JKT-2024',
            item_name: '2024 Team Jacket',
            item_category: 'Apparel',
            price: 159.99,
            quantity: 1,
            index: 0
        }]
    }
});
```

---

## 3. Variable Configuration

### 3.1 Data Layer Variables

Create these variables in GTM under **Variables > User-Defined Variables > New**:

#### DLV - action_type
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `action_type`
- **Data Layer Version:** Version 2

#### DLV - eventCategory
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `eventCategory`

#### DLV - eventAction
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `eventAction`

#### DLV - eventLabel
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `eventLabel`

#### DLV - eventName
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `eventName`

#### DLV - eventValue
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `eventValue`

#### DLV - product_id
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `product_id`

#### DLV - product_name
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `product_name`

#### DLV - product_price
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `product_price`

#### DLV - product_category
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `product_category`

#### DLV - ga_eventClick
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `ga_eventClick`

#### DLV - ga_eventView
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `ga_eventView`

#### DLV - ecommerce
- **Variable Type:** Data Layer Variable
- **Data Layer Variable Name:** `ecommerce`

### 3.2 Custom JavaScript Variables

#### CJS - Event Category Clean
```javascript
function() {
    var cat = {{DLV - eventCategory}};
    return cat ? cat.replace(/-/g, ' ').toLowerCase() : '';
}
```

#### CJS - Is Click Event
```javascript
function() {
    return {{DLV - ga_eventClick}} === '1';
}
```

#### CJS - Is View Event
```javascript
function() {
    return {{DLV - ga_eventView}} === '1';
}
```

---

## 4. Trigger Configuration

### 4.1 Retail Event Trigger
- **Trigger Type:** Custom Event
- **Event Name:** `retail_event`
- **This trigger fires on:** All Custom Events

### 4.2 Page View Trigger
- **Trigger Type:** Custom Event
- **Event Name:** `page_view`

### 4.3 Purchase Trigger
- **Trigger Type:** Custom Event
- **Event Name:** `purchase`

### 4.4 Add to Cart Trigger
- **Trigger Type:** Custom Event
- **Event Name:** `retail_event`
- **This trigger fires on:** Some Custom Events
- **Condition:** `{{DLV - action_type}}` contains `add-to-cart` OR `add-item`

### 4.5 Navigation Click Trigger
- **Trigger Type:** Custom Event
- **Event Name:** `retail_event`
- **Condition:** `{{DLV - action_type}}` starts with `rf1_navigation`

---

## 5. Tag Configuration

### 5.1 GA4 Configuration Tag
- **Tag Type:** Google Analytics: GA4 Configuration
- **Measurement ID:** `G-XXXXXXXXXX` (your GA4 property ID)
- **Triggering:** All Pages

### 5.2 GA4 - Retail Event Tag
- **Tag Type:** Google Analytics: GA4 Event
- **Configuration Tag:** Select your GA4 Config tag
- **Event Name:** `{{DLV - eventName}}`
- **Event Parameters:**
  | Parameter Name | Value |
  |---------------|-------|
  | event_category | {{DLV - eventCategory}} |
  | event_action | {{DLV - eventAction}} |
  | event_label | {{DLV - eventLabel}} |
  | action_type | {{DLV - action_type}} |
  | product_id | {{DLV - product_id}} |
  | product_name | {{DLV - product_name}} |
  | product_price | {{DLV - product_price}} |
  | product_category | {{DLV - product_category}} |
- **Triggering:** Retail Event Trigger

### 5.3 GA4 - Page View Tag
- **Tag Type:** Google Analytics: GA4 Event
- **Event Name:** `page_view`
- **Event Parameters:**
  | Parameter Name | Value |
  |---------------|-------|
  | page_title | {{Page Title}} |
  | page_location | {{Page URL}} |
  | page_path | {{Page Path}} |
- **Triggering:** Page View Trigger

### 5.4 GA4 - Purchase Tag
- **Tag Type:** Google Analytics: GA4 Event
- **Event Name:** `purchase`
- **Event Parameters:**
  | Parameter Name | Value |
  |---------------|-------|
  | transaction_id | {{DLV - ecommerce}}.transaction_id |
  | value | {{DLV - ecommerce}}.value |
  | currency | {{DLV - ecommerce}}.currency |
  | tax | {{DLV - ecommerce}}.tax |
  | shipping | {{DLV - ecommerce}}.shipping |
  | items | {{DLV - ecommerce}}.items |
- **Triggering:** Purchase Trigger

### 5.5 GA4 - Add to Cart Tag
- **Tag Type:** Google Analytics: GA4 Event
- **Event Name:** `add_to_cart`
- **Event Parameters:**
  | Parameter Name | Value |
  |---------------|-------|
  | currency | USD |
  | value | {{DLV - product_price}} |
  | items | (use Custom JavaScript variable to build items array) |
- **Triggering:** Add to Cart Trigger

---

## 6. GA4 Custom Dimensions Setup

### Step 1: Access GA4 Admin
1. Go to [analytics.google.com](https://analytics.google.com)
2. Select your GA4 property
3. Click **Admin** (gear icon)
4. Under **Property**, click **Custom definitions**

### Step 2: Create Custom Dimensions

Click **Create custom dimension** and configure each:

| Dimension Name | Scope | Event Parameter | Description |
|---------------|-------|-----------------|-------------|
| Product ID | Event | product_id | Unique product identifier |
| Product Name | Event | product_name | Product display name |
| Product Category | Event | product_category | Product category (Apparel, Accessories, etc.) |
| Product Price | Event | product_price | Product unit price |
| Product Brand | Event | product_brand | Team/brand name |
| Product Position | Event | product_position | Position in list/grid |
| Action Type | Event | action_type | Full rf1_ prefixed action identifier |
| Event Category | Event | event_category | Normalized event category |
| Event Action | Event | event_action | Action type (click/view/submit) |
| Event Label | Event | event_label | Specific element label |
| User Type | User | user_type | guest/registered/premium |
| Customer Tier | User | customer_tier | Customer loyalty tier |
| Page Type | Event | page_type | Page template type |
| Content Type | Event | content_type | Content classification |
| Experience Type | Event | experience_type | VIP experience category |
| Race Name | Event | race_name | Grand Prix name |
| Team Name | Event | team_name | F1 team name |
| Error Message | Event | ga_errorMessage | Error description |
| Error Type | Event | error_type | Error classification |
| Promo ID | Event | promo_id | Promotion identifier |
| Promo Name | Event | promo_name | Promotion display name |

### Step 3: Create Custom Metrics

| Metric Name | Scope | Event Parameter | Unit |
|-------------|-------|-----------------|------|
| Click Count | Event | ga_eventClick | Standard |
| View Count | Event | ga_eventView | Standard |
| Error Count | Event | error_counter | Standard |

### Step 4: Wait for Data
- Custom dimensions take 24-48 hours to populate
- Use DebugView for immediate testing

---

## 7. Testing & Debugging

### 7.1 GTM Preview Mode
1. In GTM, click **Preview** button
2. Enter your website URL
3. Navigate your site and verify:
   - Tags fire on expected triggers
   - Variables contain correct values
   - No errors in console

### 7.2 GA4 DebugView
1. In GA4, go to **Admin > DebugView**
2. Enable debug mode by:
   - Using GA Debugger Chrome extension
   - Adding `?debug_mode=true` to URL
   - Setting `debug_mode: true` in gtag config
3. Watch events appear in real-time

### 7.3 Browser Console Testing
Open DevTools Console and test:

```javascript
// Check dataLayer contents
console.log(window.dataLayer);

// Check digitalData
console.log(window.digitalData);

// Test event callback manually
window.rf1LinkCallback('test-category', {
    action: 'click',
    label: 'test-label',
    CD: {
        product_id: 'TEST-001',
        product_name: 'Test Product'
    }
});

// Verify last dataLayer push
console.log(window.dataLayer[window.dataLayer.length - 1]);
```

### 7.4 On-Site Debug Panel
The site includes a built-in debug panel:
1. Click **Debug** button (bottom-right)
2. View all fired events in real-time
3. See full event payload for each event
4. Green = fired, Red = dropped

### 7.5 Validation Checklist

| Test | Expected Result |
|------|-----------------|
| Page load | `page_view` event fires |
| Click navigation | `rf1_navigation-main_click_*` fires |
| Add to cart | `rf1_*_click_add-to-cart` fires with product data |
| Complete purchase | `purchase` event fires with ecommerce object |
| Form submission | `rf1_*-form_submit_*` fires |
| Error occurs | Event with `ga_errorMessage` fires |

---

## Quick Reference: Event Mapping

| User Action | data-track Value | dataLayer event | GA4 Event |
|------------|------------------|-----------------|-----------|
| Click nav link | `navigation-main_click_teams` | `retail_event` | `teams` |
| Add to cart | `product-actions_click_add-to-cart` | `retail_event` | `add to cart` |
| View product | `product-card_view_ferrari-cap` | `retail_event` | `ferrari cap` |
| Submit login | (via linkCallback) | `retail_event` | `login success` |
| Complete purchase | (via setTransaction) | `purchase` | `purchase` |

---

## Support

For implementation questions:
- Email: analytics@racingf1.com
- Documentation: This file
- Debug: Use on-site debug panel

**Version:** 1.0  
**Last Updated:** January 2026
