# KPI & Measurement Framework
## F1 Racing Store — CJA / Adobe Analytics / RTCDP

Maps **business questions → KPIs → KPRs (targets) → metrics + dimensions → CJA component**. Revenue reported in **INR** (report-suite base); on-site prices are USD and converted by Adobe — see SDD §6.

---

## 1. KPI structure

| Term | Meaning |
|---|---|
| **KPI** | Key Performance Indicator — the headline number. |
| **KPR** | Key Performance Result — the target/threshold for the KPI. |
| **Metric** | The measurable component(s) used to compute the KPI. |
| **Dimension** | The breakdown/segment the KPI is analysed by. |

---

## 2. KPI catalogue

### A. Revenue & Conversion (primary)

| Business question | KPI | KPR (target) | Metric(s) | Dimensions | CJA component |
|---|---|---|---|---|---|
| How much are we selling? | **Total Revenue (INR)** | Growth MoM ≥ 8% | Revenue (`order.priceTotal`) | Date, Channel, Category, Race | Metric: Revenue |
| How well do visits convert? | **Order Conversion Rate** | ≥ 2.5% | Orders / Visits | Channel, Device, New vs Return | Calc: `Orders / Visits` |
| What's a typical order worth? | **Average Order Value** | ≥ ₹X | Revenue / Orders | Category, Customer Tier | Calc: `Revenue / Orders` |
| Value per visit? | **Revenue per Visit** | ≥ ₹Y | Revenue / Visits | Channel | Calc: `Revenue / Visits` |
| Where do we lose buyers? | **Funnel Step Conversion** | Checkout→Purchase ≥ 60% | Step counters | Step, Device | Fallout / Flow |
| Carts left behind? | **Cart Abandonment Rate** | ≤ 65% | 1 − (Orders / Cart Adds-sessions) | Device, Category | Calc |

### B. Product & Merchandise

| Question | KPI | KPR | Metric | Dimensions | CJA |
|---|---|---|---|---|---|
| Top sellers? | **Units Sold** | — | Units (`productListItems.quantity`) | Product ID/Name, Category, Team | Metric: Units |
| Best categories? | **Revenue by Category** | — | Revenue | Product Category, Team, Driver | Freeform |
| Add-to-cart appeal? | **Cart-Add Rate** | ≥ 12% | Cart Adds / Product Views | Product, Category | Calc |
| View→buy? | **Product Conversion** | — | Orders(product) / Product Views | Product | Calc |

### C. Tickets, Experiences & Hospitality (F1-specific)

| Question | KPI | KPR | Metric | Dimensions | CJA |
|---|---|---|---|---|---|
| Ticket revenue by race? | **Ticket Revenue** | — | Revenue (ticket items) | Race Name, Stand, Ticket Type | Freeform |
| Do users finish seat selection? | **Seat-Selection Completion** | ≥ 70% | Seat Selects / Seat Map Views | Race, Stand | Calc |
| Hospitality attach? | **Hospitality Attach Rate** | — | Hosp Selects / Ticket Orders | Race | Calc |
| Experiences booked? | **Experience Bookings** | — | event8 / Exp Bookings | Experience Type | Metric |

### D. Acquisition & Engagement

| Question | KPI | KPR | Metric | Dimensions | CJA |
|---|---|---|---|---|---|
| Traffic volume? | **Visits / Unique Visitors** | — | Visits, People | Channel (UTM), Device | Metric |
| Best channels? | **Channel Revenue & CVR** | — | Revenue, Orders/Visits | Marketing Channel, Source/Medium | Freeform |
| Engagement quality? | **Pages per Visit, Bounce Rate** | Bounce ≤ 45% | Page Views/Visits; single-page visits | Page Type | Calc |
| Search usage & value? | **Search→Purchase Rate** | — | Orders(searchers)/Searches | Search Term | Calc |
| New vs returning? | **New Visitor %** | — | New / Total People | Date | Calc |

### E. Audience & RTCDP

| Question | KPI | KPR | Metric | Dimensions | Source |
|---|---|---|---|---|---|
| How big is the addressable base? | **Profile Count** | grow | Merged profiles | Identity type | RTCDP |
| Audience sizes? | **Audience Membership** | per-audience target | Profiles in audience | Audience | RTCDP |
| Activation reach? | **Activated Reach / Match Rate** | ≥ 60% match | Profiles sent / matched | Destination | RTCDP |
| Qualification velocity? | **Segment Qualification Rate** | — | New qualifications / day | Audience | RTCDP |

---

## 3. CJA Calculated Metrics (formulas to build)

| Name | Formula | Format |
|---|---|---|
| Order Conversion Rate | `Orders / Visits` | Percent |
| Average Order Value | `Revenue / Orders` | Currency (INR) |
| Revenue per Visit | `Revenue / Visits` | Currency |
| Cart-Add Rate | `Cart Adds / Product Views` | Percent |
| Cart Abandonment Rate | `1 - (Orders / Checkouts)` | Percent |
| Checkout→Purchase | `Orders / Checkouts` | Percent |
| Seat-Selection Completion | `Seat Selects / Seat Map Views` | Percent |
| Search→Purchase | `Orders [Searchers] / Searches` | Percent |
| Bounce Rate | `Single-page Visits / Visits` | Percent |
| Units per Order | `Units / Orders` | Decimal |

---

## 4. Workspace / Dashboard specs

### Project 1 — Executive Overview (1 page)
- Scorecard summary: Revenue (INR), Orders, Conversion Rate, AOV, Visits (with MoM trend).
- Line: Revenue & Orders over time.
- Bar: Revenue by Marketing Channel.
- Bar: Revenue by Product Category.
- Donut: New vs Returning.

### Project 2 — Conversion Funnel
- Fallout viz: Product View → Cart Add → Checkout → Purchase.
- Segment switch: Device, Channel.
- Cart Abandonment Rate scorecard + trend.

### Project 3 — Product & Merchandise
- Freeform: Product Name × (Product Views, Cart Adds, Units, Revenue, Product Conversion).
- Breakdown by Team / Driver / Category.

### Project 4 — Tickets & Experiences
- Freeform: Race Name × (Ticket Revenue, Units, Seat-Selection Completion, Hospitality Attach).
- Experience Bookings by Experience Type.

### Project 5 — Acquisition
- Channel × (Visits, Orders, Revenue, CVR, RPV).
- Search Term × (Searches, Search→Purchase).

---

## 5. Data View settings (CJA)
- **Currency:** INR (matches AA base; converts USD inputs).
- **Time zone:** IST (GMT+5:30).
- **Session/visit definition:** 30-min inactivity (matches `analytics.js` session timeout).
- **Person ID:** Cross-channel person key = `crmId` where present, else ECID.
- Include all dimensions/metrics from SDR §5.

---

## 6. Reporting cadence & governance
- **Daily:** Real-Time/Workspace revenue + order monitoring during launch week.
- **Weekly:** Funnel + channel review.
- **Monthly:** KPI vs KPR scorecard; audience growth & activation review.
- Each KPI has a named owner; KPRs reviewed quarterly.
