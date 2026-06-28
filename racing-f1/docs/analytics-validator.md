# Cross-Stream Analytics Validator

`tests/crossstream-analytics-validator.spec.js` compares the **actual flow and values** the F1
site emits across the three analytics stacks, on the real DOM, and asserts they agree.

## Streams compared

| Stream | Source | Role |
|---|---|---|
| **GridBox** | `window.gridboxLayer.event[]` | source of truth (stable `eventInfo.key` + attributes) |
| **Adobe** | `window.adobeDataLayer` | ACDL, fed by `analytics.js` chokepoint → Adobe Launch |
| **GA4 / GTM** | `window.dataLayer` | fed by `analytics.js` → GTM GA4 tag |
| GA4 network | `…/g/collect` requests | best-effort capture of real GA4 hits |
| Adobe network | Edge `/ee`, `omtrdc`, `demdex` | best-effort capture of real Adobe hits |

The validator snapshots each array's length, drives an action, then slices the new entries — robust
against Adobe Launch swapping the array (no fragile push-wrapping).

## What it asserts

1. **GridBox records every event** (source of truth).
2. **Adobe (ACDL) mirrors every fired event** — the single chokepoint — and **values match GridBox**
   (`product_id`, `product_price`, `currency`, …).
3. **GA4 event-name derivation is correct** (mirrors the Tealium GA4 mapping):
   commerce keys/names → recommended events; `gb_<category>_<action>` → `ga4_<category>_<action>`.
4. **Divergence is reported**, not hidden — the per-event matrix shows which streams (GTM, GA4 net,
   Adobe net) each event actually reached.

## Coverage

- **Page coverage** (`gridbox-tealium-bridge.spec.js`): all 15 pages init gridbox + carry `data-track`.
- **Event types** (this spec): `page_view`, `data-track` click (`gb_` contract), `AddToCart`,
  `RemoveFromCart`, `BeginCheckout`, `Purchase`. Result: **5 pass, RemoveFromCart self-skips** when the
  cart-seed API shape differs (non-fatal, self-documenting).

## Run it

```bash
# local files (not the deployed build):
BASE_URL=http://localhost:3000 npx playwright test tests/crossstream-analytics-validator.spec.js --project=chromium
```

## Findings (surfaced by the validator, then fixed)

1. **`adobeDataLayer` drops the stable key.** Its payload carries only the human `eventName`
   ("Add to cart"), not `eventInfo.key` ("AddToCart"). Cross-tag correlation on the Adobe side must
   use `eventName`. This is also why the Tealium Event Bridge consumes `gridboxLayer.event[]` (the only
   stream with the stable key).
2. **Mixed funnel keys.** `AddToCart`/`ProductView` use stable keys, but `beginCheckout`/`purchase` use
   `gb_checkout_begin` / `gb_purchase_complete`. These were missing from the GA4 commerce map → they
   would mislabel as `page_view`. **Fixed** in `tealium-extensions` (GA4 mapping + unit test).
3. **Code-path divergence.** Different `gridbox.*` methods reach different streams (e.g. `addToCart`
   reaches GridBox + Adobe but not always the GTM `dataLayer`). The matrix annotations report this per
   event so gaps are visible rather than assumed away.
