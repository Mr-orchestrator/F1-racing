# Solution Design Document (SDD)
## F1 Racing Store — Adobe Analytics + Web SDK + CJA + RTCDP

| | |
|---|---|
| **Property** | F1 Racing Store (`racing-f1-rho.vercel.app`) |
| **Adobe Org** | `D1D7123F524450A60A490D45@AdobeOrg` |
| **Tags property** | `F1 racing Store` (`PRc5f09e7bce2f47ce82610eb5727e791b`) |
| **AA Report Suite (prod)** | `ageo1xxlonf1racingstore-prod` (base currency INR, TZ IST) |
| **AA Report Suite (dev)** | `ageo1xxlonf1racingstore-dev` *(to be created)* |
| **Source data layer** | `window.adobeDataLayer` (ACDL) — mirror of `gridboxLayer` |
| **Status** | AppMeasurement page-view live (HTTP 200). Web SDK/CJA/RTCDP = this project. |
| **Owner** | Analytics Engineering |
| **Version** | 1.0 |

---

## 1. Purpose & scope

Move from a single-solution AppMeasurement implementation (Adobe Analytics only, via the legacy `2o7.net` beacon) to a **unified Adobe Web SDK collection** that powers **four** solutions from one event:

1. **Adobe Analytics (AA)** — existing reporting continuity.
2. **Customer Journey Analytics (CJA)** — cross-channel analysis on AEP data.
3. **Real-Time CDP (RTCDP)** — profiles, audiences, activation.
4. **Web SDK / Edge** — the single collection + edge personalization layer.

Scope includes: XDM schema design, datastream config, identity & consent, the Tags (Launch) implementation pattern, CJA connection/data view, and RTCDP foundation + audiences + activation. The browser data layer (`analytics.js`) is **not** modified — XDM is assembled in Tags.

---

## 2. Current state

```
Browser → analytics.js → adobeDataLayer (ACDL)
                              │
              Tags: "Page Load - Analytics" rule (Library Loaded → s.t())
                              │
                  AppMeasurement → ageo1xxlonf1racingstoreprod.112.2o7.net/b/ss/
                              │
                       Adobe Analytics (only)
```

Problems this design fixes:
- **CJA & RTCDP get no data** — AppMeasurement does not write to AEP.
- **`2o7.net` is ad-block-prone** → visit/revenue undercount.
- **No real-time profile / audience / activation** capability.

---

## 3. Target architecture

```
  gridboxLayer / adobeDataLayer  (UNCHANGED)
        │  ACDL "Data Pushed"
        ▼
  Adobe Tags (Launch)
   ├─ Adobe Client Data Layer extension      (listens to events)
   ├─ Adobe Experience Platform Web SDK ext.  (Alloy)
   ├─ Data Elements: XDM ExperienceEvent (+ field elements)
   └─ Rules: one per event → "Set XDM" → alloy sendEvent
        │  HTTPS  edge.adobedc.net/ee/v2/interact   (first-party, NOT 2o7.net)
        ▼
  DATASTREAM  "F1 Racing Store - <Dev|Prod>"
   ├─ Adobe Analytics service      → RSID (dev/prod)
   ├─ Adobe Experience Platform svc → ExperienceEvent dataset (Profile=on)
   └─ Edge Network: consent, identity (ECID), datastream overrides
        │
        ├─► Adobe Analytics  (Workspace, Real-Time)
        ├─► AEP data lake    → CJA Connection → Data View → Workspace
        └─► AEP Profile      → RTCDP → Audiences → Destinations (activation)
```

**Principle:** *collect once, distribute everywhere.* One `sendEvent` XDM payload is fanned out by the Edge to AA, CJA and Profile based on datastream services.

---

## 4. XDM schema design

### 4.1 ExperienceEvent schema — `F1 - Web ExperienceEvent`
Class: **XDM ExperienceEvent**. Field groups:

| Field group | Key fields | Source (adobeDataLayer) |
|---|---|---|
| **AEP Web SDK ExperienceEvent** (`web`) | `web.webPageDetails.name/URL/pageViews.value`, `web.webInteraction.name/type/linkClicks.value` | `page.pageInfo.pageName`, `page.pageInfo.pageURL`, event name |
| **Commerce Details** (`commerce`) | `productViews`, `productListAdds`, `productListRemovals`, `checkouts`, `purchases`, `cartAbandons` (each `.value`); `order.priceTotal`, `order.currencyCode`, `order.purchaseID`, `order.payments[]` | cart/transaction events |
| **Product List Items** (`productListItems[]`) | `SKU`, `name`, `priceTotal`, `quantity`, `currencyCode`, `productCategories[]` | `attributes.product_*`, `cart.item[]` |
| **Consents and Preferences** (`consents`) | `consents.collect.val`, `consents.marketing.*` | `context.consentCategories` |
| **IdentityMap** (`identityMap`) | `ECID`, `Email_LC_SHA256`, `crmId` | ECID auto; `setUser` email/userId |
| **Environment / Device** (auto via Web SDK) | `environment.*`, `device.*` | Web SDK auto-collect |
| **`_f1racingstore` (tenant custom)** | see 4.3 | F1-domain events |

### 4.2 Individual Profile schema — `F1 - Individual Profile` (RTCDP)
Class: **XDM Individual Profile**. Field groups: Demographic (name), Personal Contact (email, phone), **Loyalty** (`customerTier`), IdentityMap, Consents. Identity namespaces: `crmId` (primary identity for profile), `Email` (hashed), `ECID`.

### 4.3 Tenant custom field group `_f1racingstore`
For domain events not covered by standard commerce:
```
_f1racingstore: {
  eventInfo: { name, key, category, errorType, errorMessage },
  race:    { name, location, date, circuit },
  ticket:  { type, category, stand, price },
  seat:    { id, row, section, price },
  team:    { name }, driver: { name, number },
  experience: { name, type, price },
  hospitality:{ package, price },
  promo:   { code, discount },
  search:  { term, results },
  step:    { name, direction }   // back / next step nav
}
```
> Reference JSON: `xdm/experienceevent-schema.json`, `xdm/profile-schema.json`.

---

## 5. Identity strategy

| Identity | Namespace | Set by | Primary? |
|---|---|---|---|
| ECID | `ECID` | Web SDK (auto) | Yes (anonymous) |
| CRM ID | `crmId` | `setUser({user_id})` → XDM identityMap | Yes (Profile) |
| Email (hashed) | `Email_LC_SHA256` | `setUser({email})` → lowercase+trim+SHA-256 | No |

- **Hash email client-side** before send (never send raw PII to Edge). Use SubtleCrypto SHA-256 in a Tags custom-code data element.
- **Merge policy** (RTCDP): private graph, **timestamp-ordered**, ECID+crmId stitched. Default merge policy for the schema's profile.
- Anonymous → authenticated stitching happens automatically when an authenticated event carries both ECID and crmId.

---

## 6. Consent & governance

- Map `gridboxLayer.context.consentCategories` → XDM `consents`:
  - `analytics`/`functional` → `consents.collect.val = "y"` when granted.
  - `marketing` → governs RTCDP activation eligibility.
- Web SDK **default consent** = `pending` until the data layer reports a state; gate via datastream + `setConsent`.
- **DULE labels:** label email/phone as `I1`/`I2` (directly identifiable) and apply `C1`/`C2` contractual labels; enforce on marketing destinations.
- **Currency note:** on-site prices are **USD**; XDM `commerce.order.currencyCode = "USD"`. AA report suite (INR) and the CJA data view convert/label accordingly. Document so revenue is never misread as INR-at-face-value.

---

## 7. Environments

| Env | Tags env | Datastream | AA RSID | AEP sandbox/dataset |
|---|---|---|---|---|
| Development | Development | `F1 Racing Store - Dev` | `…-dev` | `dev` sandbox dataset |
| Staging | Staging | `F1 Racing Store - Dev` (or Stage) | `…-dev` | `dev` sandbox |
| Production | Production | `F1 Racing Store - Prod` | `…-prod` | `prod` sandbox dataset |

Datastream ID is selected per Tags environment in the Web SDK extension config (datastream-per-environment mapping).

---

## 8. Migration plan (dual-tag, zero-downtime for AA)

| Phase | Action | Exit criteria |
|---|---|---|
| **A — Baseline** | Keep AppMeasurement `Page Load - Analytics` rule live. | AA still collecting (verified). |
| **B — Parallel Web SDK** | Add Web SDK + XDM + rules; Dev datastream → dev RSID + dev dataset. Validate edge `interact` + CJA rows + profiles. | XDM correct for all P0 events; CJA preview shows data; profiles build. |
| **C — Cutover** | Point AA collection to the **Web SDK datastream's Analytics service** (prod RSID); disable/remove AppMeasurement rule; retire `2o7.net`. | AA parity vs dual-tag; `2o7.net` calls gone; ad-block undercount resolved. |

Rollback: re-enable the AppMeasurement rule (kept in version history) and republish.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Revenue misread (USD vs INR) | Explicit `currencyCode`; documented; CJA currency setting. |
| Purchase double-count | `order.purchaseID = transaction_id` (dedup) — mandatory on purchase. |
| PII to Edge | Client-side SHA-256 hashing; DULE labels. |
| AA discrepancy at cutover | Dual-tag overlap window + parity check before disabling AppMeasurement. |
| Ad-block of `2o7.net` | First-party Edge domain (`*.adobedc.net` / CNAME). |
| `item_0_*` flattening only | XDM `productListItems[]` built from `cart.item[]` array (custom-code element), not just `item_0_*`. |

---

## 10. References
- `01-SDR-variable-map.md` — full variable map.
- `02-KPI-measurement-framework.md` — KPIs/KPRs & CJA components.
- `03-implementation-runbook.md` — build steps.
- `xdm/*.json` — schema + mapping artifacts.
- `tests/adobe-websdk-validation.spec.js` — automated edge/XDM validation.
