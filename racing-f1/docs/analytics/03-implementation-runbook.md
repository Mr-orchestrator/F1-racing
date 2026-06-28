# Implementation Runbook
## F1 Racing Store — Web SDK + CJA + RTCDP build (click-by-click)

Execute top-to-bottom. Boxes `[ ]` are check-off steps. Mirrors the publishing flow you already know (Dev → Submitted → Approved → Published). Keep the existing **AppMeasurement Page View** rule live until Phase C.

---

## PHASE 0 — Prerequisites
- [ ] Confirm Adobe org: `D1D7123F524450A60A490D45@AdobeOrg`.
- [ ] Confirm AEP + CJA + RTCDP product access (sandboxes visible in Experience Platform).
- [ ] Create AA dev report suite **`ageo1xxlonf1racingstore-dev`** (Admin → Report Suites → Add; copy settings from prod, INR, IST).

---

## PHASE 1 — AEP: schemas, identities, datasets

### 1.1 Identity namespaces (AEP → Identities)
- [ ] Confirm `ECID` and `Email` exist (standard).
- [ ] Create custom namespace **`crmId`** — Type: *Cross-device*; Identity Symbol `crmId`.

### 1.2 Create ExperienceEvent schema (AEP → Schemas → Create schema)
- [ ] Class = **XDM ExperienceEvent**. Name = **`F1 - Web ExperienceEvent`**.
- [ ] Add field groups: **AEP Web SDK ExperienceEvent**, **Commerce Details**, **Product List Items**, **Consents and Preferences**, **Environment Details**, **Web Details**.
- [ ] Create + add custom field group **`F1 Racing Store - Event Details`** with object `_<tenantId>.f1racingstore` containing the structure in `xdm/experienceevent-schema.json` (race, ticket, seat, team, driver, experience, hospitality, promo, search, step, eventInfo).
- [ ] Set **identityMap** + mark schema **"Profile"** enabled (toggle top-right).
- [ ] Set primary identity behaviour (ECID as identity at field level via Web SDK).

### 1.3 Create Profile schema (RTCDP)
- [ ] Class = **XDM Individual Profile**. Name = **`F1 - Individual Profile`**.
- [ ] Field groups: Demographic Details, Personal Contact Details, **Loyalty Details** (customerTier), IdentityMap, Consents.
- [ ] Set `crmId` as primary identity; `Email` (hashed) + `ECID` as identities.
- [ ] Enable **Profile**.

### 1.4 Datasets (AEP → Datasets → Create)
- [ ] `F1 Web Events - dev` from `F1 - Web ExperienceEvent` → **enable for Profile**.
- [ ] `F1 Web Events - prod` from same schema → **enable for Profile**.
- [ ] (Optional) `F1 CRM Profiles` from `F1 - Individual Profile`.

### 1.5 Merge policy (RTCDP → Profiles → Merge Policies)
- [ ] Create **`F1 Default`** — Identity graph: **Private Graph**; Merge: **Timestamp ordered**; set as **default**.

---

## PHASE 2 — Datastreams (Data Collection → Datastreams)

### 2.1 Dev datastream
- [ ] Create **`F1 Racing Store - Dev`**. Add services:
  - **Adobe Analytics** → Report Suite `ageo1xxlonf1racingstore-dev`.
  - **Adobe Experience Platform** → Sandbox = dev; Event dataset = `F1 Web Events - dev`; **Profile dataset** = on.
- [ ] Enable **Consent** if using.

### 2.2 Prod datastream
- [ ] Create **`F1 Racing Store - Prod`**. Services:
  - **Adobe Analytics** → `ageo1xxlonf1racingstore-prod`.
  - **Adobe Experience Platform** → prod sandbox; dataset `F1 Web Events - prod`; Profile = on.
- [ ] Record both **Datastream IDs**.

---

## PHASE 3 — Tags: Web SDK extension + data elements + rules

### 3.1 Install Web SDK extension (Tags → Extensions → Catalog)
- [ ] Install **Adobe Experience Platform Web SDK**.
- [ ] Datastreams: **per-environment** → Development = Dev datastream ID; Staging = Dev; **Production = Prod** datastream ID.
- [ ] Edge domain: leave default first-party `*.adobedc.net` (NOT `2o7.net`); optionally a CNAME later.
- [ ] Identity: enable ECID (default). Save.

### 3.2 Data Elements (Tags → Data Elements) — create from SDR §1
- [ ] Create all `DL - *` ACDL data elements (paths in SDR §1).
- [ ] Create `currencyCode` (ACDL `cart.price.totalPrice.currency`, default `USD`) — *already exists; reuse*.
- [ ] Create **`Email - SHA256`** (Custom Code):
```javascript
var email = _satellite.getVar('DL - email');
if (!email) return Promise.resolve('');
var data = new TextEncoder().encode(String(email).trim().toLowerCase());
return crypto.subtle.digest('SHA-256', data).then(function (buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return ('0' + b.toString(16)).slice(-2);
  }).join('');
});
```
- [ ] Create **`XDM - productListItems`** (Custom Code) — use the code in SDR §1.
- [ ] Create **`XDM - ExperienceEvent`** — Type **XDM Object** (select `F1 - Web ExperienceEvent`) and map fields; OR Custom Code returning the object. Base custom-code template:
```javascript
var dl = window.adobeDataLayer || [];
var e = dl[dl.length - 1] || {};
var a = e.attributes || {};
var xdm = {
  eventType: 'web.webpagedetails.pageViews',
  web: { webPageDetails: { name: _satellite.getVar('DL - pageName'), pageViews: { value: 1 } } },
  identityMap: {}
};
var ecidEmail = _satellite.getVar('Email - SHA256');
var crm = _satellite.getVar('DL - userId');
if (crm) xdm.identityMap.crmId = [{ id: String(crm), primary: true }];
if (ecidEmail) xdm.identityMap.Email_LC_SHA256 = [{ id: ecidEmail }];

switch (e.event) {
  case 'Product viewed':
    xdm.eventType = 'commerce.productViews';
    xdm.commerce = { productViews: { value: 1 } };
    xdm.productListItems = [{ SKU: a.product_id, name: a.product_name, priceTotal: Number(a.product_price)||0, currencyCode: 'USD' }];
    break;
  case 'Add to cart':
    xdm.eventType = 'commerce.productListAdds';
    xdm.commerce = { productListAdds: { value: 1 } };
    xdm.productListItems = [{ SKU: a.product_id, name: a.product_name, quantity: Number(a.product_quantity)||1, priceTotal: Number(a.product_price)||0, currencyCode: a.currency||'USD' }];
    break;
  case 'Remove from cart':
    xdm.eventType = 'commerce.productListRemovals';
    xdm.commerce = { productListRemovals: { value: 1 } };
    xdm.productListItems = [{ SKU: a.product_id, name: a.product_name, quantity: Number(a.quantity_removed)||1 }];
    break;
  case 'BeginCheckout':
    xdm.eventType = 'commerce.checkouts';
    xdm.commerce = { checkouts: { value: 1 } };
    xdm.productListItems = _satellite.getVar('XDM - productListItems');
    break;
  case 'Purchase':
  case 'Purchase completed':
    xdm.eventType = 'commerce.order';
    xdm.commerce = {
      purchases: { value: 1 },
      order: { purchaseID: String(a.transaction_id||''), priceTotal: Number(a.transaction_total)||0, currencyCode: a.currency||'USD' }
    };
    xdm.productListItems = _satellite.getVar('XDM - productListItems');
    break;
  default:
    // F1 domain + web interactions
    xdm.eventType = 'web.webinteraction.linkClicks';
    xdm.web = xdm.web || {};
    xdm.web.webInteraction = { name: e.event, type: 'other', linkClicks: { value: 1 } };
}
return xdm;
```

### 3.3 Rules (Tags → Rules) — one per event group
For **each** event in SDR §3 create a rule:
- [ ] **Event:** Extension = *Adobe Client Data Layer*, Event Type = **Data Pushed**, with a **Value Comparison** condition on `%DL - event%` equals the event name (e.g. `Add to cart`).
- [ ] **Action 1:** Extension = *Adobe Experience Platform Web SDK*, Action Type = **Set variable** → XDM = `%XDM - ExperienceEvent%` (or map an XDM object data element).
- [ ] **Action 2:** Extension = *Adobe Experience Platform Web SDK*, Action Type = **Send event** → uses the set XDM. (For purchase, ensure `eventType=commerce.order` and `purchaseID` set.)
- [ ] **Minimum P0 rules:** Page View, Product viewed, Add to cart, Remove from cart, BeginCheckout, **Purchase**.

> **Page View rule:** Event = *Core → Library Loaded (Page Top)*; Action = Web SDK **Send event** with XDM page-view object. (Replaces the AppMeasurement `s.t()` page view at Phase C.)

### 3.4 Build & publish
- [ ] New library `a5` → Add All Changed Resources → **Save & Build to Development**.
- [ ] Validate (Phase 5) on Dev before promoting.
- [ ] Submit → Approve → **Publish to Production** when validated.

---

## PHASE 4 — CJA (Customer Journey Analytics)

### 4.1 Connection
- [ ] CJA → Connections → **Create**. Name `F1 Racing Store`. Add dataset `F1 Web Events - prod`. Set **Person ID** = `crmId` (fallback ECID). Import.

### 4.2 Data View
- [ ] Create Data View **`F1 - Web`**. Currency **INR**, Time zone **IST**, session timeout 30 min.
- [ ] Add dimensions & metrics from SDR §5.
- [ ] Build calculated metrics from KPI framework §3.

### 4.3 Workspace
- [ ] Build the 5 projects in KPI framework §4.

---

## PHASE 5 — Validation / QA

### 5.1 Automated (Playwright)
- [ ] Run `tests/adobe-websdk-validation.spec.js` (see file) against Dev then Prod env:
```
BASE_URL=https://racing-f1-rho.vercel.app npx playwright test adobe-websdk-validation --project=chromium
```
- [ ] Confirm `edge.adobedc.net/ee/v2/interact` 200; XDM carries correct `eventType`, commerce measures, `productListItems[].SKU`, `order.purchaseID` (purchase), `identityMap.ECID`, `currencyCode=USD`.

### 5.2 Adobe tools
- [ ] **AEP Debugger / Assurance**: create session, validate live XDM + datastream routing to AA + AEP.
- [ ] **CJA Data Preview**: confirm rows land, metrics populate, currency = INR.
- [ ] **RTCDP Profile viewer**: look up a test profile → events present; ECID+crmId stitched.

### 5.3 Per-event QA checklist
For each rule: trigger the UI action → confirm (a) edge `interact` 200, (b) correct `eventType`, (c) expected commerce/`_f1racingstore` fields, (d) AA hit in Real-Time, (e) CJA row.

---

## PHASE 6 — RTCDP audiences + activation

### 6.1 Audiences (RTCDP → Audiences → Create → Build rule)
- [ ] **Cart Abandoners** — events where `commerce.productListAdds.value ≥ 1` AND NOT `commerce.purchases.value ≥ 1` within 7 days.
- [ ] **High-Value Buyers** — sum(`commerce.order.priceTotal`) > threshold OR profile `customerTier = VIP`.
- [ ] **Ticket Intenders** — `_f1racingstore.ticket.type` exists (Ticket type selected) AND no ticket purchase.
- [ ] **Merch Browsers (no purchase)** — `commerce.productViews.value ≥ 3` AND no purchases.
- [ ] **Loyalty Re-engagement** — last `commerce.purchases` > 90 days ago.

### 6.2 Destinations (RTCDP → Destinations → Catalog)
- [ ] Connect **Google Ads / Meta** (Customer Match — map `Email_LC_SHA256`). Activate Cart Abandoners, High-Value Buyers.
- [ ] Connect **Adobe Target / Web SDK on-site** (edge audiences) for on-site personalization.
- [ ] Connect **Email** (Adobe Campaign or marketing destination) for re-engagement.
- [ ] (Optional) **Amazon S3 / cloud storage** export for downstream analytics.
- [ ] Apply **consent** & **DULE** marketing-action enforcement to all marketing destinations.

### 6.3 Activation verification
- [ ] For each audience→destination: confirm dataflow runs, match rate reported, no governance violations.

---

## PHASE 7 — Cutover (retire AppMeasurement)
- [ ] Confirm AA parity (Web SDK datastream Analytics vs AppMeasurement) over the dual-tag window.
- [ ] Disable the old **`Page Load - Analytics`** AppMeasurement rule; remove the Adobe Analytics (AppMeasurement) extension if no longer needed.
- [ ] Publish. Confirm no more `*.2o7.net` calls; only `edge.adobedc.net`.
- [ ] Re-run `adobe-websdk-validation.spec.js` to confirm Web-SDK-only collection.

---

## Quick reference — IDs
| Item | Value |
|---|---|
| Org | `D1D7123F524450A60A490D45@AdobeOrg` |
| Tags property | `PRc5f09e7bce2f47ce82610eb5727e791b` |
| AA prod RSID | `ageo1xxlonf1racingstore-prod` |
| AA dev RSID | `ageo1xxlonf1racingstore-dev` (create) |
| Datastream IDs | record after Phase 2 |
