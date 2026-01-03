# GridBox Analytics - Racing F1 Demo

A comprehensive analytics data layer implementation demonstrating enterprise-grade event tracking for e-commerce websites.

## Live Demo

🌐 **[View Live Site](https://racing-f1.vercel.app)**

## Features

- **GridBox Analytics Layer** - Tealium-style `gridbox.view()` and `gridbox.link()` methods
- **W3C digitalData** - Full W3C Customer Experience Digital Data Layer implementation
- **GTM dataLayer** - Google Tag Manager compatible event pushing
- **SPA Support** - Manual page view tracking for Single Page Applications
- **Comprehensive Test Suite** - 30+ automated tests for data layer verification

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GRIDBOX                          │
├─────────────────────────────────────────────────────┤
│  digitalData (W3C)     │    dataLayer (GTM)        │
│  ├─ page               │    ├─ event               │
│  ├─ user               │    ├─ page_*              │
│  ├─ product            │    ├─ user_*              │
│  ├─ cart               │    └─ ecommerce           │
│  ├─ transaction        │                           │
│  └─ event[]            │                           │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/racing-f1.git

# Navigate to directory
cd racing-f1

# Serve locally (any static server)
npx serve .
```

## API Reference

### Page View Tracking

```javascript
// Track page view
gridbox.view({
    page_name: "Product Detail",
    page_type: "pdp",
    product_id: "SKU-001"
});
```

### Interaction Tracking

```javascript
// Track user interaction
gridbox.link({
    event_name: "add_to_cart",
    event_category: "ecommerce",
    event_action: "click",
    event_label: "add-button",
    product_id: "SKU-001"
});
```

### SPA Page Views

```javascript
// Manual page view for SPA
gridboxSPA.triggerPageView("CHECKOUT");

// Track user event in SPA
gridboxSPA.trackUserEvent(
    "AddToCart",
    "Add item to cart",
    "product-card",
    [{ key: "productId", value: "SKU-001" }]
);
```

## Data Layer Objects

| Object | Description |
|--------|-------------|
| `window.digitalData` | W3C Customer Experience Digital Data Layer |
| `window.dataLayer` | GTM-compatible data layer array |
| `window.gridbox_data` | Flat key-value data object (like utag_data) |
| `window.gridbox` | GridBox API namespace |

## Event Categories (SPA)

| Category | Description |
|----------|-------------|
| `PageView` | Virtual page views |
| `UserEvent` | User interactions |
| `Display` | Component visibility |
| `CustomMetric` | Performance metrics |

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Home page |
| `teams.html` | F1 Teams |
| `merchandise.html` | Product listing |
| `tickets.html` | Race tickets |
| `experiences.html` | VIP experiences |
| `calendar.html` | Race calendar |
| `booking-spa.html` | SPA booking flow |
| `test-datalayer.html` | DataLayer test suite |

## Testing

Open `test-datalayer.html` in a browser and click "Run All Tests" to verify:

- ✅ Core DataLayer structure
- ✅ GridBox API functions
- ✅ Event tracking
- ✅ SPA functionality

## Console Commands

```javascript
// View digitalData
console.log(digitalData);

// View dataLayer
console.log(dataLayer);

// View flat data
console.log(gridbox_data);

// Manual tracking
gridbox.view({ page_name: "Test" });
gridbox.link({ event_category: "test", event_action: "click", event_label: "btn" });
```

## Documentation

- [DataLayer Architecture](DATALAYER-ARCHITECTURE.md) - Full technical documentation
- [GTM Configuration Guide](GTM-CONFIGURATION-GUIDE.md) - GTM setup instructions

## Tech Stack

- HTML5 / CSS3 / JavaScript (Vanilla)
- GridBox Analytics Layer
- W3C Digital Data Layer
- GTM dataLayer

## License

MIT License

---

**GridBox Analytics** - Enterprise-grade data layer for modern web applications.
