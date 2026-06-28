# F1 Racing Store — Offline Data + CJA Use Case Playbook

Complete synthetic offline dataset + AEP/CJA/RTCDP implementation showcasing full Adobe customer-360 capabilities.

## What's in this folder

```
docs/offline-data/
├── generate-offline-data.js     # Generator (Node.js — run with `node generate-offline-data.js`)
├── data/                         # Generated CSVs (5,342 records total)
│   ├── 1-crm-customer-profile.csv     (200 rows)
│   ├── 2-loyalty-program.csv          (200 rows)
│   ├── 3-offline-purchases.csv        (2,179 rows)
│   ├── 4-email-engagement.csv         (2,385 rows)
│   └── 5-call-center.csv              (378 rows)
├── 01-XDM-SCHEMAS.md             # XDM schema definitions + CSV→XDM mapping tables
├── 02-AEP-INGESTION-GUIDE.md     # Step-by-step ingestion + identity stitching
├── 03-USE-CASES.md               # 6 production use cases (CJA + RTCDP + Activation)
└── README.md                      # This file
```

## Quick reference

### Identity strategy
- **Primary stitch key:** `Email` (matches online Web SDK identityMap.Email)
- **Secondary identities:** `crmId`, `loyaltyId`, `ECID`
- **Overlap:** 60% of CRM customers (120 of 200) have matching emails to online bulk-traffic users

### Datasets feeding CJA
| # | Dataset | Type | Records | Profile-enabled |
|---|---|---|---|---|
| 1 | F1 Racing Store midValues (existing) | ExperienceEvent | 10k+ (online) | ✅ |
| 2 | F1 CRM Customers | Profile | 200 | ✅ |
| 3 | F1 Loyalty Members | Profile | 200 | ✅ |
| 4 | F1 Offline Purchases | ExperienceEvent | 2,179 | ✅ |
| 5 | F1 Email Marketing | ExperienceEvent | 2,385 | ✅ |
| 6 | F1 Customer Service | ExperienceEvent | 378 | ✅ |

### Use cases delivered
1. **Cart Abandonment Recovery** — identify + activate abandoners with offline history
2. **Customer 360 Dashboard** — unified cross-channel view for sales/CSR teams
3. **Cross-Channel Attribution** — offline purchases attributed to online sources
4. **Loyalty Engagement** — tier-climber + VIP-at-risk activation
5. **Churn Risk Prediction** — composite churn score across all channels
6. **Personalization** — offline-data-driven on-site personalization

## How to use

### Step 1 — Generate the data (already done)
```bash
node docs/offline-data/generate-offline-data.js
```

Output: 5 CSV files in `docs/offline-data/data/`.

### Step 2 — Create identity namespaces in AEP
See `01-XDM-SCHEMAS.md` → "Identity Namespaces" section.

### Step 3 — Create the 5 schemas + datasets
See `01-XDM-SCHEMAS.md` for each schema specification.

### Step 4 — Upload CSVs via AEP Sources
See `02-AEP-INGESTION-GUIDE.md` for click-by-click.

### Step 5 — Configure CJA Connection + Data View
See `02-AEP-INGESTION-GUIDE.md` Phase 5+6.

### Step 6 — Build use cases (start with #2 then #1)
See `03-USE-CASES.md` for each use case spec.

## Adobe official documentation references

| Topic | Adobe doc URL |
|---|---|
| XDM Individual Profile | `experienceleague.adobe.com/docs/experience-platform/xdm/classes/individual-profile.html` |
| XDM Commerce Details | `experienceleague.adobe.com/docs/experience-platform/xdm/data-types/commerce-details.html` |
| Identity Namespaces | `experienceleague.adobe.com/docs/experience-platform/identity/namespaces.html` |
| Source Connectors | `experienceleague.adobe.com/docs/experience-platform/sources/home.html` |
| Local File Upload | `experienceleague.adobe.com/docs/experience-platform/sources/connectors/data-partners/data-landing-zone.html` |
| Merge Policies | `experienceleague.adobe.com/docs/experience-platform/profile/merge-policies/overview.html` |
| CJA Connections | `experienceleague.adobe.com/docs/analytics-platform/using/cja-connections/create-connection.html` |
| CJA Identity Stitching | `experienceleague.adobe.com/docs/analytics-platform/using/cja-connections/configure-stitching.html` |
| CJA Data Views | `experienceleague.adobe.com/docs/analytics-platform/using/data-views/data-views.html` |
| RTCDP Audiences | `experienceleague.adobe.com/docs/experience-platform/segmentation/home.html` |
| Edge Segmentation | `experienceleague.adobe.com/docs/experience-platform/segmentation/ui/edge-segmentation.html` |
| Activation Destinations | `experienceleague.adobe.com/docs/experience-platform/destinations/home.html` |

## Data realism notes

- **Customer demographics** are diverse (15 country codes, varied name pools)
- **Purchase patterns** scale with tier (VIPs make 8-16 orders, standard 1-4)
- **Email engagement** is realistic (~55% open rate, ~30% CTR of opened, ~60% conversion of clicked)
- **Call center** ~40% coverage, ~85% resolution rate, CSAT skewed by resolution outcome
- **Loyalty points** correlate with LTV (50% of LTV in points by default)
- **Marketing consent** ~80% opt-in, ~70% email opt-in, ~50% SMS opt-in (realistic GDPR-style)

## Why this matters

This is **not a toy dataset.** It includes:
- Multiple legitimate identity overlaps for stitching tests
- Realistic skewed distributions (not uniform random)
- Multi-event email engagement (sends/opens/clicks expandable to separate events)
- Channel diversity for attribution analysis
- Time-distributed data over 18 months for cohort/trend analysis
- Resolved vs unresolved support tickets for service quality tracking

You can run all 6 use cases against this data and demonstrate every major CJA + RTCDP capability.
