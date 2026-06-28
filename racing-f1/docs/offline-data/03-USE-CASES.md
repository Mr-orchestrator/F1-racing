# CJA Use Case Playbook — Full Capability Showcase

6 production-grade use cases that combine **online (Web SDK)** + **offline (CRM/Loyalty/Email/Call Center)** data via identity stitching.

Each use case includes:
- Business question + KPI
- CJA Workspace project spec (panels/components)
- RTCDP audience definition (XDM segment rule)
- Activation destination
- Measurement of success

---

# Use Case 1: Cart Abandonment Recovery

**Business question:** Which logged-in customers abandoned a cart in the last 7 days, and do they have offline purchase history we can leverage in re-engagement?

**Pipeline:**
```
Web SDK fires: commerce.productListAdds → AEP dataset
NO commerce.purchases in 7 days
Stitched profile: also exists in F1 CRM Customers
        ↓
RTCDP audience: "Cart Abandoners (Identified)"
        ↓
Activation: Adobe Campaign / SFMC / Marketo → personalized email
            Adobe Target → on-site recovery banner
```

## CJA Workspace project: `01 Cart Abandonment Recovery`

### Panel A: Cart Abandoners by Tier
| Component | Type | Source |
|---|---|---|
| Dimension: Customer Tier | offline | `_f1racingstore.crm.customerTier` |
| Metric: Cart Adds (no purchase) | calc | `Cart Adds [no purchase in 7d]` |
| Metric: Avg Cart Value | calc | `Sum(productListItems.priceTotal) / Cart Add Events` |
| Metric: Past Offline Revenue | offline | Sum order.priceTotal where dataset=Offline Purchases |

### Panel B: Abandonment Funnel
Visualization: **Fallout chart**
- Step 1: Product Viewed (commerce.productViews)
- Step 2: Add to Cart (commerce.productListAdds)
- Step 3: Begin Checkout (commerce.checkouts)
- Step 4: Purchase (commerce.purchases) — drop = abandonment

Apply segment: **Last 30 days** AND **Person ID is identified**.

### Panel C: Abandonment by Channel Mix
Freeform: Channel × Cart Adds × Email Click Rate × Calls Last 30 Days

## RTCDP Audience: `Cart Abandoners — Identified`

**Build rule:**
```
INCLUDE persons WHERE
  commerce.productListAdds.value >= 1 in last 7 days
  AND NOT commerce.purchases.value >= 1 in last 7 days
  AND identityMap.Email[].id EXISTS
  AND _f1racingstore.crm.emailOptIn = true
```

Expected size: ~30-50 profiles (from our synthetic data).

## Activation

| Destination | Trigger | Payload |
|---|---|---|
| **Adobe Campaign / SFMC** | New audience member | Email template `cart-recovery` with cart items, 10% discount, expiry 48h |
| **Adobe Target** | Returning visitor in audience | On-site banner: "Complete your order — items still available" |
| **Meta Custom Audiences** | Hashed Email | Retargeting ads for abandoned products |

## KPI

| Metric | Target |
|---|---|
| Recovery rate | ≥ 12% of audience converts in 30 days |
| Average recovered cart value | ≥ ₹8,000 (~$95) |
| Email engagement on recovery campaign | open ≥ 30%, CTR ≥ 8% |

---

# Use Case 2: Customer 360 (Full Stitched Profile)

**Business question:** Show the complete cross-channel view of one customer — what they did online, bought offline, how loyal they are, what their service history is.

**Pipeline:**
```
Single Email → stitched via identity graph to:
  - ECID (web behaviour)
  - crmId (CRM profile attributes)
  - loyaltyId (loyalty points + tier)
  - Multiple ExperienceEvents from web/offline/email/calls
```

## CJA Workspace project: `02 Customer 360 Dashboard`

Use Workspace **"Customer profile"** panel (CJA standard widget).

### Layout

**Top scorecard row** (filtered to single person ID via search box):
- Lifetime Value (Online + Offline) — `Sum(commerce.order.priceTotal)`
- Loyalty Points Balance — `_f1racingstore.loyalty.pointsBalance` (latest)
- Customer Tier — `_f1racingstore.crm.customerTier`
- Total Sessions — `count(distinct sessions)`
- Days Since Last Purchase
- Total Email Engagement — `Email Opens + Clicks`
- Open Support Cases — `count(callCenter.resolved=false)`
- Average CSAT — `avg(satisfactionRating)`

**Middle: Cross-channel timeline**
Visualization: **Flow** (left-to-right, time-ordered events colored by source):
- Blue: Web events
- Green: Offline purchases
- Orange: Email engagements
- Red: Call center

**Bottom: Two side-by-side panels**
- Top Products Bought (Online vs Offline split)
- Engagement Heatmap (day × channel)

## RTCDP Audience (Profile-driven)
Not directly an activation use case — this is **analytical**. But you CAN spin out audiences from it:
- "Customers with >5 web sessions AND >1 offline purchase in 90 days" → VIP retargeting
- "Customers with low online activity but high offline LTV" → digital re-engagement campaign

## KPI
This use case is **operational** — measure adoption:
- # of customer service agents using the dashboard daily
- Time-to-resolution improvement (CSAT delta with vs without using profile)

---

# Use Case 3: Cross-Channel Attribution

**Business question:** When a customer makes an **offline** purchase, what online behaviour preceded it? (Did the in-store sale come from a Google Ad? An email? Organic web visit?)

**Pipeline:**
```
Online: web behaviour → marketing.trackingCode (utm_source/medium/campaign)
Offline: purchase → linked via Email to web sessions
Attribution algorithm: last-touch / first-touch / linear / U-shape
        ↓
Report: Revenue by Marketing Channel (online + offline combined)
```

## CJA Workspace project: `03 Cross-Channel Attribution`

### Panel A: Revenue Sourced (Online + Offline)
Freeform table:
| Marketing Channel | Online Revenue | Offline Revenue | Total | % Total |
|---|---|---|---|---|
| Google Ads | … | … | … | … |
| Email | … | … | … | … |
| Organic Search | … | … | … | … |
| Direct | … | … | … | … |
| Social Paid | … | … | … | … |

Apply **last-touch attribution** to the combined `Total Revenue` metric.

### Panel B: Time-to-Purchase by Channel
Histogram: days from first online touch → offline purchase, segmented by channel.

### Panel C: Multi-Touch Path Analysis
**Flow visualization:**
- First touch (online) → Middle touches → Last touch → Purchase (online OR offline)

Filter: only purchases where person has ≥1 online session AND ≥1 offline order.

## RTCDP Audience
- "High-intent multi-channel buyers" — saw paid ad + visited site + bought offline → upsell to VIP

## KPI
- % of offline purchases now attributable to digital sources (was 0% before unified data)
- Marketing budget reallocation efficiency

---

# Use Case 4: Loyalty Engagement Boost

**Business question:** Identify loyalty members close to a tier upgrade and incentivize behaviour that gets them there. Also identify high-tier members with declining online activity.

**Pipeline:**
```
F1 Loyalty Members dataset → tier + points balance + nextTierThresholdPoints
F1 Web Events → web/cart activity in last 30 days
        ↓
2 audiences:
  A) "Tier Climbers" — within 1000 points of next tier
  B) "VIP at Risk" — vip tier, ≤1 session in 30 days, no purchase in 60 days
```

## CJA Workspace project: `04 Loyalty Health`

### Panel A: Tier Distribution Trend
Line chart over 12 months — # customers per tier.

### Panel B: Tier Climbers
Freeform:
- Person ID (Email)
- Current Tier
- Points Balance
- Points to Next Tier (= `nextTierThresholdPoints − pointsBalance`)
- 30-day Online Activity Score (sessions × time-spent)
- 30-day Spend (Online + Offline)

Sort ascending by Points to Next Tier. Top 100 = highest-priority audience.

### Panel C: VIP Disengagement Detection
Cohort table: VIP customers by `last activity month`.
Highlight cells where last activity > 60 days = disengagement risk.

## RTCDP Audiences

### A) "Tier Climbers"
```
INCLUDE persons WHERE
  _f1racingstore.loyalty.isActive = true
  AND (_f1racingstore.loyalty.nextTierThresholdPoints − _f1racingstore.loyalty.pointsBalance) <= 1000
  AND _f1racingstore.loyalty.membershipTier != 'vip'
```

### B) "VIP at Risk"
```
INCLUDE persons WHERE
  _f1racingstore.loyalty.membershipTier = 'vip'
  AND timeSinceLastEvent(any web or purchase) > 60 days
```

## Activation

| Audience | Destination | Message |
|---|---|---|
| Tier Climbers | Email + Push | "You're 850 points away from Gold — 2x points this weekend" |
| VIP at Risk | Email + Concierge call | "Exclusive paddock access reserved for you — Monaco GP" |

## KPI
- Tier upgrades in next 90 days
- VIP retention rate

---

# Use Case 5: Churn Risk Prediction

**Business question:** Which customers are likely to churn (decreased engagement across all channels)?

**Pipeline:**
```
Multi-source signal aggregation:
  - Online: sessions/week trend (declining)
  - Offline: days since last purchase
  - Email: open rate trend
  - Call center: unresolved complaints + low CSAT
        ↓
Composite "Churn Score" calculated metric
        ↓
RTCDP audience: top 10% churn risk
```

## CJA Workspace project: `05 Churn Risk`

### Calculated metric: Churn Score (lower = healthier)
```
Churn Score = (
  (Days Since Last Online Visit / 30) * 0.30 +
  (Days Since Last Purchase / 90) * 0.30 +
  (1 - 90-day Email Open Rate) * 0.20 +
  (Unresolved Calls in 60 days) * 0.10 +
  (Low CSAT incidents) * 0.10
) * 100
```

Score 0-30 = healthy, 30-60 = at-risk, 60+ = high churn risk.

### Panel A: Churn Score Distribution
Histogram of all profiles by churn score, color by tier.

### Panel B: Cohort Heatmap
Rows = signup month, Columns = months since signup, Cells = retention %.

### Panel C: Top-100 Churn Risk
Table with churn score, all signal components, recommended action.

## RTCDP Audience: `High Churn Risk`
```
INCLUDE persons WHERE
  churnScore >= 60
  AND _f1racingstore.crm.lifetimeValue >= 500
  AND _f1racingstore.crm.marketingConsent = true
```

## Activation
- Personalized win-back email (Adobe Campaign)
- Discount code via SMS (high-LTV only)
- Service callback (call center queue)

## KPI
- 30-day churn rate of audience
- Recovery revenue per intervention

---

# Use Case 6: Personalization (Online Recs Driven by Offline Data)

**Business question:** Use a customer's **offline purchase history + favorite team** to personalize the site experience on next visit.

**Pipeline:**
```
Profile attributes: favoriteTeam, last offline purchase category
        ↓
Edge segmentation: "Ferrari fan with no recent Ferrari merch purchase"
        ↓
Adobe Target / Web SDK personalization: show Ferrari merch on homepage
```

## CJA Workspace project: `06 Personalization Impact`

### A/B Test Performance
- Control: generic merchandise homepage
- Variant: personalized by `_f1racingstore.crm.favoriteTeam`

Metrics:
- CTR on hero merchandise
- Add-to-cart rate
- Revenue per visit
- Time to add to cart

### Segment performance breakdown
- Ferrari fans seeing Ferrari content (high engagement expected)
- Cross-team fans (control or random rec)
- New visitors (no offline data — use only ECID-based recs)

## RTCDP Audiences (for personalization)

### A) "Ferrari Fans — Recent Activity"
```
INCLUDE persons WHERE
  _f1racingstore.crm.favoriteTeam = 'Ferrari'
  AND visitedWeb in last 30 days
```
Edge-active → Adobe Target picks up in real-time.

### B) "Apparel Buyers — Cross-sell Collectibles"
```
INCLUDE persons WHERE
  In last 180 days: bought from category 'Apparel' (offline OR online)
  AND NOT bought from category 'Collectibles' in last 365 days
```

### C) "Race Ticket Buyers — Sell Hospitality"
```
INCLUDE persons WHERE
  Bought any productCategory='Tickets' in last 12 months
  AND NOT bought productCategory='Hospitality' ever
  AND _f1racingstore.crm.customerTier in ['gold','vip']
```

## Activation

| Destination | Use |
|---|---|
| Adobe Target / Web SDK Edge | On-site personalization (banner, recs, copy) |
| Adobe Campaign / SFMC | Personalized newsletter content blocks |
| Google Ads Customer Match | Lookalike audiences seeded from VIP profile |
| Meta Custom Audiences | Cross-sell creative targeting |

## KPI
- Lift in personalized variant vs control
- Revenue per visit improvement
- Cross-sell conversion rate

---

# Summary Table — All 6 Use Cases

| # | Use Case | Data Sources Combined | Primary Activation |
|---|---|---|---|
| 1 | Cart Abandonment Recovery | Web + CRM + Email opt-in | Adobe Campaign + Target |
| 2 | Customer 360 Dashboard | All 6 sources | Internal (CSR / Sales) |
| 3 | Cross-Channel Attribution | Web (utm) + Offline orders | Marketing budget decisions |
| 4 | Loyalty Engagement | Loyalty + Web + Offline orders | Email + Push + Concierge |
| 5 | Churn Risk Prediction | All sources (composite) | Win-back campaigns |
| 6 | Personalization | CRM (favoriteTeam) + Offline + Web | Adobe Target + ad platforms |

---

# Implementation order recommended

1. **Use Case 2 (Customer 360)** first — gives you immediate operational value AND validates data stitching
2. **Use Case 1 (Cart Abandonment)** — quick win with highest direct revenue impact
3. **Use Case 4 (Loyalty)** — leverages existing program, drives retention
4. **Use Case 3 (Attribution)** — strategic value, takes longer to set up properly
5. **Use Case 6 (Personalization)** — requires Adobe Target / Web SDK personalization config
6. **Use Case 5 (Churn)** — requires history accumulation to model accurately

Each use case in its own Workspace project keeps things modular and shareable across teams.
