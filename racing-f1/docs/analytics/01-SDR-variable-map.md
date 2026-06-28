# Solution Design Reference (SDR)
## F1 Racing Store — Event & Variable Map (AA + XDM/CJA + RTCDP)

The single source of truth mapping **data-layer event → AA variables → XDM path → CJA component**. Companion machine-readable files: `01-SDR-variable-map.csv`, `xdm/event-mapping.json`.

**Conventions**
- `attributes.*` = keys on the `adobeDataLayer` event (from `analytics.js`).
- AA set via the datastream's Analytics service (mapped from XDM) or AA extension. eVar/prop/event numbers are **proposed** — adjust to your suite's free slots.
- XDM paths assume schema `F1 - Web ExperienceEvent` (tenant namespace shown as `_f1racingstore`).

---

## 1. Data Elements (Tags) — create once, reuse everywhere

| Data Element | Type | Source path (`adobeDataLayer`) | Default |
|---|---|---|---|
| `DL - event` | ACDL | `event` | — |
| `DL - pageName` | ACDL | `page.pageInfo.pageName` | `unknown` |
| `DL - pageURL` | ACDL | `page.pageInfo.pageURL` | — |
| `DL - pageType` | ACDL | `page.category.pageType` | — |
| `DL - loginStatus` | ACDL | `user.0.profile.0.profileInfo.loginStatus` | `false` |
| `DL - userType` | ACDL | `user.0.profile.0.attributes.userType` | `guest` |
| `DL - userId` | ACDL | `user.0.profile.0.profileInfo.profileID` | — |
| `DL - email` | ACDL | `user.0.profile.0.profileInfo.email` | — |
| `DL - customerTier` | ACDL | `user.0.profile.0.attributes.customerTier` | — |
| `currencyCode` | ACDL | `cart.price.totalPrice.currency` | `USD` |
| `DL - product_id` | ACDL | `attributes.product_id` | — |
| `DL - product_name` | ACDL | `attributes.product_name` | — |
| `DL - product_category` | ACDL | `attributes.product_category` | — |
| `DL - product_price` | ACDL | `attributes.product_price` | `0` |
| `DL - product_qty` | ACDL | `attributes.product_quantity` | `1` |
| `DL - cart_total` | ACDL | `attributes.cart_total` | `0` |
| `DL - item_count` | ACDL | `attributes.item_count` | `0` |
| `DL - transaction_id` | ACDL | `attributes.transaction_id` | — |
| `DL - transaction_total` | ACDL | `attributes.transaction_total` | `0` |
| `DL - transaction_tax` | ACDL | `attributes.transaction_tax` | `0` |
| `DL - transaction_shipping` | ACDL | `attributes.transaction_shipping` | `0` |
| `DL - search_term` | ACDL | `attributes.search_term` | — |
| `DL - promo_code` | ACDL | `attributes.promo_code` | — |
| `Email - SHA256` | Custom code | hash(lowercase(trim(`DL - email`))) | — |
| `XDM - productListItems` | Custom code | build array from `cart.item[]` (full, not item_0 only) | `[]` |
| `XDM - ExperienceEvent` | Custom code / XDM object | assembles full XDM per event | `{}` |

**`XDM - productListItems` (custom code) — builds every line item:**
```javascript
var dl = window.adobeDataLayer || [];
var last = dl[dl.length - 1] || {};
var items = (last.cart && last.cart.item) ? last.cart.item : [];
return items.map(function (it) {
  var info = it.productInfo || {};
  var price = (it.price && (it.price.amount != null ? it.price.amount : it.price)) || info.price || 0;
  return {
    SKU: info.productID || it.product_id || '',
    name: info.productName || it.product_name || '',
    quantity: Number(info.quantity || it.quantity || 1),
    priceTotal: Number(price) * Number(info.quantity || 1),
    currencyCode: 'USD',
    productCategories: it.category ? [{ categoryID: it.category }] : []
  };
});
```

---

## 2. AA Variable allocation (proposed)

### eVars / props
| Var | Name | Source | Expiry/scope |
|---|---|---|---|
| eVar1 | Page Name | `DL - pageName` | Hit |
| eVar2 | Page Type | `DL - pageType` | Hit |
| eVar3 | Product ID | `DL - product_id` | Visit |
| eVar4 | Product Name | `DL - product_name` | Visit |
| eVar5 | Product Category | `DL - product_category` | Visit |
| eVar6 | Login Status | `DL - loginStatus` | Visit |
| eVar7 | User Type | `DL - userType` | Visit |
| eVar8 | Customer Tier | `DL - customerTier` | Visit |
| eVar9 | Search Term | `DL - search_term` | Hit |
| eVar10 | Transaction ID | `DL - transaction_id` | Hit |
| eVar11 | Promo Code | `DL - promo_code` | Visit |
| eVar12 | Race Name | `_f1racingstore.race.name` | Visit |
| eVar13 | Ticket Type | `_f1racingstore.ticket.type` | Visit |
| eVar14 | Team Name | `_f1racingstore.team.name` | Visit |
| eVar15 | Experience Name | `_f1racingstore.experience.name` | Visit |
| prop1 | Page Name | `DL - pageName` | Hit |
| prop2 | Page Type | `DL - pageType` | Hit |
| prop3 | Error Message | `_f1racingstore.eventInfo.errorMessage` | Hit |

### Success events
| Event | Name | Fires on |
|---|---|---|
| event1 | Product View | `Product viewed` |
| scAdd | Cart Add | `Add to cart` |
| scRemove | Cart Remove | `Remove from cart` |
| scOpen/scView | Cart View | `View cart` |
| scCheckout | Checkout | `BeginCheckout` |
| purchase | Purchase | `Purchase`/`Purchase completed` |
| event2 | Search | `Search performed` |
| event3 | Login | `User logged in` |
| event4 | Signup | `User signed up` |
| event5 | Promo Applied | `Promo code applied` |
| event6 | Ticket Selected | `Ticket type selected` |
| event7 | Seat Selected | `Seat selected` |
| event8 | Experience Booked | `Experience booked` |
| event9 | Hospitality Selected | `Hospitality package selected` |
| event10 | Error | `Error occurred`/`AnalyticsError` |

---

## 3. Master event map

Legend: **PLI** = `productListItems[]`. Commerce measures use `.value = 1`.

### P0 — Core commerce (build first)

| # | DL `event` | XDM eventType | XDM commerce / web | XDM extra | AA event(s) | CJA metric |
|---|---|---|---|---|---|---|
| 1 | `PageView` | `web.webpagedetails.pageViews` | `web.webPageDetails.pageViews.value=1`, `.name`, `.URL` | eVar1/2 | page view | Page Views |
| 2 | `SPANavigation` | `web.webpagedetails.pageViews` | same as PageView | — | page view | Page Views |
| 3 | `Product viewed` | `commerce.productViews` | `commerce.productViews.value=1` + PLI[0] | eVar3/4/5 | event1 (prodView) | Product Views |
| 4 | `Add to cart` | `commerce.productListAdds` | `commerce.productListAdds.value=1` + PLI[0] | currencyCode | scAdd | Cart Adds |
| 5 | `Remove from cart` | `commerce.productListRemovals` | `commerce.productListRemovals.value=1` + PLI[0] | — | scRemove | Cart Removals |
| 6 | `Update cart quantity` | `commerce.productListOpens` (or custom) | PLI[0] with new qty | `_f1racingstore.step` | — | Qty Updates |
| 7 | `View cart` | `commerce.productListViews` | `commerce.productListViews.value=1` + PLI[] | — | scView | Cart Views |
| 8 | `BeginCheckout` | `commerce.checkouts` | `commerce.checkouts.value=1` + PLI[] | cart_total | scCheckout | Checkouts |
| 9 | `Add shipping info` | `commerce.checkouts` | `checkouts.value=1` (step 2) | `_f1racingstore.step` | scCheckout:2 | Checkout Step |
| 10 | `Add payment info` | `commerce.checkouts` | `checkouts.value=1` (step 3) | `_f1racingstore.step` | scCheckout:3 | Checkout Step |
| 11 | `Purchase` / `Purchase completed` | `commerce.order` | `commerce.purchases.value=1`, `order.priceTotal`, `order.purchaseID`, `order.currencyCode` + PLI[] | tax/shipping | purchase, products, **purchaseID** | Orders, Revenue |
| 12 | `Purchase failed` | `commerce.checkouts` (custom flag) | `_f1racingstore.eventInfo` | reason | event10 | Failed Orders |
| 13 | `ClearCart` | `commerce.productListRemovals` | `productListRemovals.value=1` (all) | items_cleared, value_cleared | scRemove | Cart Clears |

### P1 — User / search / promo

| # | DL `event` | XDM | AA | CJA |
|---|---|---|---|---|
| 14 | `User logged in` | `identityMap.crmId` + `web.webInteraction` | event3, eVar6 | Logins |
| 15 | `User logged out` | `web.webInteraction` | eVar6=false | Logouts |
| 16 | `User signed up` | `identityMap.crmId` + Profile | event4 | Signups |
| 17 | `UserIdentified` | `identityMap` (ECID+crmId stitch) | eVar6 | Identified |
| 18 | `Search performed` | `_f1racingstore.search.{term,results}` + `web.webInteraction` | event2, eVar9 | Searches |
| 19 | `Filter applied` | `_f1racingstore.search` + `web.webInteraction` | prop | Filters |
| 20 | `Promo code applied` | `_f1racingstore.promo.{code,discount}` | event5, eVar11 | Promos Applied |
| 21 | `Promo code failed` | `_f1racingstore.promo.code` | — | Promo Fails |
| 22 | `Promo code removed` | `_f1racingstore.promo.code` | — | Promo Removes |

### P2 — F1 domain

| # | DL `event` | XDM (`_f1racingstore.*`) + `web.webInteraction` | AA | CJA |
|---|---|---|---|---|
| 23 | `Race details viewed` | `race.{name,location,date,circuit}` | eVar12 | Race Views |
| 24 | `Race selected` | `race.{name,location}` | eVar12 | Race Selects |
| 25 | `Ticket type selected` | `ticket.{type,category,stand,price}` | event6, eVar13 | Ticket Selects |
| 26 | `Ticket added to cart` | commerce.productListAdds + `ticket.*` | scAdd | Ticket Adds |
| 27 | `Seat map viewed` | `seat` + `race.name` | — | Seat Map Views |
| 28 | `Seat selected` | `seat.{id,row,section,price}` | event7 | Seat Selects |
| 29 | `Skip seat selection clicked` | `_f1racingstore.step` | — | Seat Skips |
| 30 | `Driver profile viewed` | `driver.{name,number}`, `team.name` | — | Driver Views |
| 31 | `Team profile viewed` | `team.name` | eVar14 | Team Views |
| 32 | `Merchandise item viewed` | commerce.productViews + `team.name` | event1 | Merch Views |
| 33 | `Merchandise added to cart` | commerce.productListAdds | scAdd | Merch Adds |
| 34 | `Hospitality package viewed` | `hospitality.{package,price}`, `race.name` | — | Hosp Views |
| 35 | `Hospitality package selected` | `hospitality.{package,price}` | event9 | Hosp Selects |
| 36 | `Experience booked` | `experience.{name,type,price}` | event8, eVar15 | Exp Bookings |
| 37 | `Service added` | `_f1racingstore` (ServiceCode/Price) | — | Service Adds |
| 38 | `Service removed` | `_f1racingstore` (ServiceCode/Reason) | — | Service Removes |
| 39 | `Add ancillary service` | commerce.productListAdds (ancillary) | scAdd | Ancillary Adds |
| 40 | `Proceed to next step` / `Back to previous step` | `_f1racingstore.step.{name,direction}` | — | Step Nav |
| 41 | `Error occurred` / `Warning occurred` / `AnalyticsError` | `_f1racingstore.eventInfo.{errorType,errorMessage}` | event10, prop3 | Errors |
| 42 | `Page exit` | `web.webInteraction` (close) | — | Exits |

---

## 4. Purchase event detail (most critical)

| XDM path | Source | Notes |
|---|---|---|
| `eventType` | `"commerce.order"` | |
| `commerce.purchases.value` | `1` | order counter |
| `commerce.order.purchaseID` | `DL - transaction_id` | **dedup key — mandatory** |
| `commerce.order.priceTotal` | `DL - transaction_total` | |
| `commerce.order.currencyCode` | `currencyCode` (`USD`) | |
| `productListItems[]` | `XDM - productListItems` | every line item |
| `identityMap` | ECID + crmId (if logged in) | profile stitch |
| (AA) `s.purchaseID` | mapped from `order.purchaseID` | prevents double counting |

---

## 5. CJA Data View components (summary)
Dimensions: Page Name, Page Type, Product ID/Name/Category, Race Name, Ticket Type, Team Name, Experience Name, Search Term, Promo Code, Login Status, User Type, Customer Tier, Marketing Channel (UTM).
Metrics: Page Views, Product Views, Cart Adds/Removals, Checkouts, **Orders**, **Revenue**, Units, Searches, Logins, Signups, Errors.
Calculated metrics: see `02-KPI-measurement-framework.md`.

> Full row-per-field export: `01-SDR-variable-map.csv`.
