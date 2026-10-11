// ════════════════════════════════════════════════════════════════════════════
// XDM ExperienceEvent Data Element — FINAL VERSION
//
// Verified against Adobe Official Documentation:
//   • Commerce Details: https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/commerce-details.html
//   • Product List Item: https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/product-list-item.html
//   • Web Page Details:  https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/web-page-details.html
//   • Web Interaction:   https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/web-interaction.html
//   • IdentityMap:       https://experienceleague.adobe.com/docs/experience-platform/identity/identity-map.html
//   • AA Custom Dims:    https://experienceleague.adobe.com/docs/experience-platform/xdm/field-groups/event/adobe-analytics-experienceevent-full-extension.html
//
// Architecture:
//   1. Detect triggering event from adobeDataLayer (with priority logic to avoid race conditions)
//   2. Map domain event name → Adobe XDM eventType
//   3. Build standard XDM commerce + web + identity payload
//   4. Add Adobe Analytics custom dimensions (eVars/props/events) for AA forwarding
//   5. Always return valid XDM (defaults to pageView if no event found)
// ════════════════════════════════════════════════════════════════════════════

// ═══ STEP 1: Find the triggering event (INDEX-BASED CONSUMPTION) ════════════
//
// ACDL processes events from adobeDataLayer in PUSH ORDER. When multiple
// events are pushed synchronously (e.g., Add to Cart click pushes 3 events),
// rules fire one at a time but the data element runs when the data layer
// already contains ALL events.
//
// Solution: Track index of the last event consumed by the data element.
// Each invocation returns the NEXT unconsumed event in order. This guarantees
// the data element returns the exact event that triggered the current rule.
// ════════════════════════════════════════════════════════════════════════════

var dl = window.adobeDataLayer || [];

// Initialize / reset consumed-index pointer
if (typeof window.__dlConsumedIndex !== 'number') window.__dlConsumedIndex = -1;
// Reset if data layer was cleared (full page nav resets window anyway, this
// handles SPA navigation where window persists but datalayer may shrink)
if (window.__dlConsumedIndex >= dl.length) window.__dlConsumedIndex = -1;

// ONLY events that have Launch RULES (trigger data element via Send Event).
// Page-state events like "PageView" and "PageLoadMetrics" exist in the data
// layer but have NO rules listening — they must NOT be counted in consume
// tracking, otherwise they'd pollute the index pointer.
var ruleEvents = {
  'Product viewed': 1,
  'Add to cart': 1, 'Remove from cart': 1, 'View cart': 1,
  'BeginCheckout': 1, 'Add payment info': 1, 'Add shipping info': 1,
  'Purchase': 1, 'Purchase completed': 1, 'ClearCart': 1,
  'User logged in': 1, 'User logged out': 1, 'User signed up': 1,
  'Search performed': 1, 'Promo code applied': 1,
  'Race details viewed': 1, 'Race selected': 1,
  'Ticket type selected': 1, 'Seat selected': 1, 'Team profile viewed': 1,
  'Experience booked': 1, 'Hospitality package selected': 1, 'Error occurred': 1
};

// Find the next UNCONSUMED rule-triggering event in the data layer.
// Only RULE events advance the pointer — page-state events (PageView,
// PageLoadMetrics) are ignored so they don't pollute the consume index.
var triggeringEvent = null;
var startIdx = window.__dlConsumedIndex + 1;
for (var i = startIdx; i < dl.length; i++) {
  var entry = dl[i];
  if (entry && entry.event && ruleEvents[entry.event]) {
    triggeringEvent = entry;
    window.__dlConsumedIndex = i;
    break;
  }
}

// Library Loaded fallback — when the Page Load rule fires there's no rule
// event to consume. Use most recent rule event if any (e.g., for SPA nav),
// otherwise fall through to default page-view XDM at the bottom.
if (!triggeringEvent) {
  for (var j = dl.length - 1; j >= 0; j--) {
    if (dl[j] && dl[j].event && ruleEvents[dl[j].event]) {
      triggeringEvent = dl[j];
      break;
    }
  }
}

// Last resort: any latest event (used for default eventType resolution)
if (!triggeringEvent) {
  for (var k = dl.length - 1; k >= 0; k--) {
    if (dl[k] && dl[k].event) { triggeringEvent = dl[k]; break; }
  }
}

// ═══ STEP 2: Extract event data ═════════════════════════════════════════════
var eventName = triggeringEvent ? triggeringEvent.event : 'Page Loaded';
var attrs = triggeringEvent ? (triggeringEvent.attributes || {}) : {};
var pageDl = triggeringEvent ? (triggeringEvent.page || {}) : {};
var pageInfo = pageDl.pageInfo || {};
var category = pageDl.category || {};

// ─── ACDL STATE: read full cart from computed state, not just pushed event ───
// Bug: productListItems built from item_0_* flat attrs on the push event
// only contains the last item added. Full cart lives in getState().
// Fix: prefer adobeDataLayer.getState().cart.item[] when available.
// Reference: https://experienceleaguecommunities.adobe.com/t5/adobe-analytics-questions/
//   productlistitems-only-shows-last-added-item-in-web-sdk/
var cartStateItems = [];
if (typeof dl.getState === 'function') {
    var fullState = dl.getState();
    cartStateItems = (fullState && fullState.cart && fullState.cart.item) ? fullState.cart.item : [];
}

// ═══ STEP 3: Map event name → Adobe XDM eventType ═══════════════════════════
// Per Adobe official commerce.* and web.* eventType strings
var eventTypeMap = {
  'Page Loaded': 'web.webpagedetails.pageViews',
  'Page View': 'web.webpagedetails.pageViews',
  'PageView': 'web.webpagedetails.pageViews',
  'PageLoadMetrics': 'web.webpagedetails.pageViews',
  'Product viewed': 'commerce.productViews',
  'Add to cart': 'commerce.productListAdds',
  'Remove from cart': 'commerce.productListRemovals',
  'View cart': 'commerce.productListViews',
  'BeginCheckout': 'commerce.checkouts',
  'Add payment info': 'commerce.checkouts',
  'Add shipping info': 'commerce.checkouts',
  'Purchase': 'commerce.purchases',
  'Purchase completed': 'commerce.purchases',
  'ClearCart': 'commerce.productListRemovals',
  'User logged in': 'web.webinteraction.linkClicks',
  'User logged out': 'web.webinteraction.linkClicks',
  'User signed up': 'web.webinteraction.linkClicks',
  'Search performed': 'web.webinteraction.linkClicks',
  'Promo code applied': 'web.webinteraction.linkClicks',
  'Race details viewed': 'web.webinteraction.linkClicks',
  'Race selected': 'web.webinteraction.linkClicks',
  'Ticket type selected': 'web.webinteraction.linkClicks',
  'Seat selected': 'web.webinteraction.linkClicks',
  'Team profile viewed': 'web.webinteraction.linkClicks',
  'Experience booked': 'commerce.checkouts',
  'Hospitality package selected': 'web.webinteraction.linkClicks',
  'Error occurred': 'web.webinteraction.linkClicks'
};

// ═══ STEP 4: Build base XDM payload ═════════════════════════════════════════
// Standard fields required for ALL events per Adobe spec
var xdm = {
  eventType: eventTypeMap[eventName] || 'web.webpagedetails.pageViews',
  timestamp: new Date().toISOString(),
  web: {
    webPageDetails: {
      name: pageInfo.pageName || document.title || window.location.pathname || 'unknown',
      URL: pageInfo.pageURL || window.location.href,
      pageViews: { value: 1 },
      siteSection: category.primaryCategory || '',
      siteSubSection: category.pageType || ''
    },
    webReferrer: {
      URL: document.referrer || ''
    }
  },
  // Adobe Analytics custom dimensions container (forwarded via datastream)
  _experience: {
    analytics: {
      customDimensions: {
        eVars: {},
        props: {}
      },
      event1to100: {}
    }
  }
};

// ═══ STEP 5: Commerce events (per Adobe schema) ═════════════════════════════

// commerce.productViews — Product Detail Page view
if (eventName === 'Product viewed') {
  xdm.commerce = { productViews: { value: 1 } };
  xdm.productListItems = [{
    SKU: String(attrs.product_id || ''),
    name: String(attrs.product_name || ''),
    priceTotal: parseFloat(attrs.product_price) || 0,
    currencyCode: 'USD',
    productCategories: attrs.product_category ? [{ categoryID: String(attrs.product_category) }] : []
  }];
  // AA mappings
  xdm._experience.analytics.customDimensions.eVars.eVar3 = String(attrs.product_id || '');
  xdm._experience.analytics.customDimensions.eVars.eVar4 = String(attrs.product_name || '');
  xdm._experience.analytics.customDimensions.eVars.eVar5 = String(attrs.product_category || '');
  xdm._experience.analytics.event1to100.event1 = { value: 1 }; // event1 = Product Views
}

// commerce.productListAdds — Add to Cart
if (eventName === 'Add to cart') {
  xdm.commerce = { productListAdds: { value: 1 } };
  xdm.productListItems = [{
    SKU: String(attrs.product_id || ''),
    name: String(attrs.product_name || ''),
    priceTotal: parseFloat(attrs.product_price) || 0,
    quantity: parseInt(attrs.product_quantity) || 1,
    currencyCode: String(attrs.currency || 'USD'),
    productCategories: attrs.product_category ? [{ categoryID: String(attrs.product_category) }] : []
  }];
  xdm._experience.analytics.customDimensions.eVars.eVar3 = String(attrs.product_id || '');
  xdm._experience.analytics.customDimensions.eVars.eVar4 = String(attrs.product_name || '');
  xdm._experience.analytics.customDimensions.eVars.eVar5 = String(attrs.product_category || '');
}

// commerce.productListRemovals — Remove from Cart / Clear Cart
if (eventName === 'Remove from cart' || eventName === 'ClearCart') {
  xdm.commerce = { productListRemovals: { value: 1 } };
  if (attrs.product_id) {
    xdm.productListItems = [{
      SKU: String(attrs.product_id),
      name: String(attrs.product_name || ''),
      quantity: parseInt(attrs.quantity_removed) || 1,
      currencyCode: 'USD'
    }];
  }
}

// ─── SHARED: build productListItems from ACDL computed state ─────────────────
// Prefer getState() over flat item_0_* attrs — getState has the full cart.
// Fall back to flat attrs only when ACDL getState is not available (older ACDL).
function buildItemsFromState(fallbackCurrency) {
  if (cartStateItems.length) {
    return cartStateItems.map(function (it) {
      var info = it.productInfo || {};
      var rawPrice = it.price;
      var unitPrice = 0;
      if (rawPrice !== null && rawPrice !== undefined) {
        unitPrice = (typeof rawPrice === 'object' && rawPrice.amount !== undefined)
          ? parseFloat(rawPrice.amount) : parseFloat(rawPrice);
      }
      if (!unitPrice && info.price) unitPrice = parseFloat(info.price);
      var qty = parseInt(info.quantity || it.quantity || 1);
      return {
        SKU: String(info.productID || it.product_id || ''),
        name: String(info.productName || it.product_name || ''),
        quantity: qty,
        priceTotal: parseFloat((unitPrice * qty).toFixed(2)),
        currencyCode: fallbackCurrency || 'USD',
        productCategories: it.category ? [{ categoryID: String(it.category) }] : []
      };
    }).filter(function (it) { return it.SKU; });
  }
  // Legacy flat attrs fallback
  var items = [];
  var count = parseInt(attrs.item_count) || 0;
  for (var i = 0; i < count; i++) {
    var id = attrs['item_' + i + '_id'];
    if (!id) continue;
    var qty = parseInt(attrs['item_' + i + '_qty']) || 1;
    var price = parseFloat(attrs['item_' + i + '_price']) || 0;
    items.push({
      SKU: String(id),
      name: String(attrs['item_' + i + '_name'] || ''),
      quantity: qty,
      priceTotal: parseFloat((price * qty).toFixed(2)),
      currencyCode: fallbackCurrency || 'USD'
    });
  }
  return items;
}

// commerce.productListViews — View Cart (ADOBE REQUIREMENT: .value REQUIRED)
if (eventName === 'View cart') {
  xdm.commerce = { productListViews: { value: 1 } };
  xdm.productListItems = buildItemsFromState('USD');
}

// commerce.checkouts — Begin Checkout (and step events)
if (eventName === 'BeginCheckout' || eventName === 'Add payment info' || eventName === 'Add shipping info') {
  xdm.commerce = { checkouts: { value: 1 } };
  xdm.productListItems = buildItemsFromState(String(attrs.currency || 'USD'));
}

// commerce.purchases — Purchase (ADOBE CRITICAL: order.purchaseID REQUIRED for dedup)
if (eventName === 'Purchase' || eventName === 'Purchase completed') {
  var orderTotal = parseFloat(attrs.transaction_total) || 0;
  var orderTax = parseFloat(attrs.transaction_tax) || 0;
  var orderShipping = parseFloat(attrs.transaction_shipping) || 0;
  var orderCurrency = String(attrs.currency || 'USD');

  xdm.commerce = {
    purchases: { value: 1 },
    order: {
      purchaseID: String(attrs.transaction_id || ''),  // REQUIRED — Adobe dedup
      priceTotal: orderTotal,
      currencyCode: orderCurrency,
      payments: [{
        currencyCode: orderCurrency,
        paymentAmount: orderTotal,
        paymentType: 'credit_card'
      }]
    }
  };

  // Build productListItems[] from all items in the transaction
  // Use getState() for full cart; flat attrs are a fallback only
  xdm.productListItems = buildItemsFromState(orderCurrency);

  // AA mappings
  xdm._experience.analytics.customDimensions.eVars.eVar10 = String(attrs.transaction_id || '');
}

// commerce.checkouts — Experience booked (treated as checkout/conversion)
if (eventName === 'Experience booked') {
  xdm.commerce = { checkouts: { value: 1 } };
  xdm._experience.analytics.customDimensions.eVars.eVar15 = String(attrs.experience_name || '');
  xdm._experience.analytics.event1to100.event8 = { value: 1 };
}

// ═══ STEP 6: Web interaction events (link clicks) ═══════════════════════════

// User Login — sets identityMap for authentication
// FIXED: email must be SHA-256 hashed before sending to Edge (raw PII rejected
// by DULE I1 enforcement and causes 400s on strict datastreams).
// FIXED: crmId (profile primary key) must be in the same event as ECID so the
// private identity graph can stitch the pre-auth anonymous journey to the profile.
// Reference: https://experienceleaguecommunities.adobe.com/t5/adobe-experience-platform/
//   ecid-not-stitched-to-crmid-rtcdp-profile-after-login/
if (eventName === 'User logged in') {
  xdm.web.webInteraction = {
    name: 'User Login',
    type: 'other',
    linkClicks: { value: 1 }
  };
  var loginMap = {};
  // crmId — profile primary key (must accompany ECID in same event for stitching)
  var crmId = attrs.user_id || attrs.crmId || '';
  if (crmId) {
    loginMap['crmId'] = [{ id: String(crmId), primary: true, authenticatedState: 'authenticated' }];
  }
  // Email — hashed only; never raw. Use __adobeBridge.identity if available (async),
  // else skip — never fall back to raw email.
  var rawEmail = attrs.user_email || '';
  if (rawEmail && window.__adobeBridge && window.__adobeBridge.identity) {
    // Async: bridge will fire a follow-up sendEvent with the hash once available.
    // The login event fires immediately without email to avoid blocking.
    window.__adobeBridge.identity.hashEmail(rawEmail).then(function (hash) {
      if (hash && window.alloy) {
        window.alloy('sendEvent', {
          xdm: {
            eventType: 'web.webinteraction.linkClicks',
            identityMap: { 'Email_LC_SHA256': [{ id: hash, primary: false, authenticatedState: 'authenticated' }] }
          }
        });
      }
    });
  }
  if (Object.keys(loginMap).length) xdm.identityMap = loginMap;
  xdm._experience.analytics.customDimensions.eVars.eVar6 = 'true';
  xdm._experience.analytics.customDimensions.eVars.eVar7 = String(attrs.user_type || '');
  xdm._experience.analytics.customDimensions.eVars.eVar8 = String(attrs.customer_tier || '');
  xdm._experience.analytics.event1to100.event3 = { value: 1 };
}

// User Logout — clears authentication state
if (eventName === 'User logged out') {
  xdm.web.webInteraction = {
    name: 'User Logout',
    type: 'other',
    linkClicks: { value: 1 }
  };
  var logoutCrmId = attrs.user_id || '';
  if (logoutCrmId) {
    xdm.identityMap = {
      'crmId': [{ id: String(logoutCrmId), primary: true, authenticatedState: 'loggedOut' }]
    };
  }
  xdm._experience.analytics.customDimensions.eVars.eVar6 = 'false';
}

// User Signed Up
if (eventName === 'User signed up') {
  xdm.web.webInteraction = {
    name: 'User Signup',
    type: 'other',
    linkClicks: { value: 1 }
  };
  var signupCrmId = attrs.user_id || '';
  if (signupCrmId) {
    xdm.identityMap = { 'crmId': [{ id: String(signupCrmId), primary: true, authenticatedState: 'authenticated' }] };
  }
  // Email hash fired async via bridge — same pattern as login
  var signupEmail = attrs.user_email || '';
  if (signupEmail && window.__adobeBridge && window.__adobeBridge.identity) {
    window.__adobeBridge.identity.hashEmail(signupEmail).then(function (hash) {
      if (hash && window.alloy) {
        window.alloy('sendEvent', {
          xdm: {
            eventType: 'web.webinteraction.linkClicks',
            identityMap: { 'Email_LC_SHA256': [{ id: hash, primary: false, authenticatedState: 'authenticated' }] }
          }
        });
      }
    });
  }
  xdm._experience.analytics.event1to100.event4 = { value: 1 };
}

// Search
if (eventName === 'Search performed') {
  xdm.web.webInteraction = {
    name: 'Search',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.eVars.eVar9 = String(attrs.search_term || '');
  xdm._experience.analytics.event1to100.event2 = { value: 1 };
}

// Promo Code
if (eventName === 'Promo code applied') {
  xdm.web.webInteraction = {
    name: 'Promo Applied',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.eVars.eVar11 = String(attrs.promo_code || '');
  xdm._experience.analytics.event1to100.event5 = { value: 1 };
}

// F1 Race events
if (eventName === 'Race details viewed' || eventName === 'Race selected') {
  xdm.web.webInteraction = {
    name: eventName,
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.eVars.eVar12 = String(attrs.race_name || '');
}

// Ticket selected
if (eventName === 'Ticket type selected') {
  xdm.web.webInteraction = {
    name: 'Ticket Selected',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.eVars.eVar13 = String(attrs.ticket_type || '');
  xdm._experience.analytics.event1to100.event6 = { value: 1 };
}

// Seat selected
if (eventName === 'Seat selected') {
  xdm.web.webInteraction = {
    name: 'Seat Selected',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.event1to100.event7 = { value: 1 };
}

// Team profile viewed
if (eventName === 'Team profile viewed') {
  xdm.web.webInteraction = {
    name: 'Team Viewed',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.eVars.eVar14 = String(attrs.team_name || '');
}

// Hospitality
if (eventName === 'Hospitality package selected') {
  xdm.web.webInteraction = {
    name: 'Hospitality Selected',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.event1to100.event9 = { value: 1 };
}

// Error event
if (eventName === 'Error occurred') {
  xdm.web.webInteraction = {
    name: 'Error',
    type: 'other',
    linkClicks: { value: 1 }
  };
  xdm._experience.analytics.customDimensions.props.prop3 = String(attrs.ga_errorMessage || attrs.error_type || '');
  xdm._experience.analytics.event1to100.event10 = { value: 1 };
}

return xdm;
