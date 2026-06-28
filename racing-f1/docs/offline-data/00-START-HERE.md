# START HERE — Step-by-Step Implementation Guide

Complete walkthrough to implement the offline data + CJA use cases. **Every click, every field.**

**Total time:** ~3-4 hours (mostly waiting for backfills)
**Prerequisites:** AEP System Administrator role + CJA admin (we already confirmed these earlier)

---

## TABLE OF CONTENTS

| Step | What | Time |
|---|---|---|
| **STEP 1** | Create 2 custom identity namespaces (`crmId`, `loyaltyId`) | 5 min |
| **STEP 2** | Create custom tenant field group `_f1racingstore` | 15 min |
| **STEP 3** | Create the 5 XDM schemas | 60 min |
| **STEP 4** | Create the 5 datasets | 15 min |
| **STEP 5** | Upload 5 CSVs via Sources | 30 min |
| **STEP 6** | Verify identity stitching | 15 min |
| **STEP 7** | Create merge policy | 5 min |
| **STEP 8** | Update CJA Connection with offline datasets | 15 min |
| **STEP 9** | Update CJA Data View with offline components | 30 min |
| **STEP 10** | Build Use Case 2 — Customer 360 Dashboard | 30 min |
| **STEP 11** | Build Use Case 1 — Cart Abandonment Recovery | 45 min |
| **STEP 12** | Validate end-to-end | 15 min |

Do them in order. Skip nothing. Each step builds on the previous.

---

# STEP 1 — Create Custom Identity Namespaces (5 min)

Identity namespaces tell Adobe how to recognize and link different IDs (Email, CRM ID, Loyalty ID, etc.).

## Why
Standard namespaces `Email` and `ECID` already exist in Adobe. We need to add 2 custom ones for our offline IDs.

## Steps

1. Open **Adobe Experience Platform** (`experience.adobe.com → Experience Platform`)
2. Left navigation → **Identities**
3. Top tab → **Browse**
4. Top-right → click **Create identity namespace** button

### Create namespace #1: crmId
| Field | Value |
|---|---|
| Display name | `CRM ID` |
| Identity symbol | `crmId` |
| Description | `Internal CRM customer ID for offline records` |
| Identity type | **Cross-device ID** |

Click **Create**.

### Create namespace #2: loyaltyId
Same screen, same flow:
| Field | Value |
|---|---|
| Display name | `Loyalty ID` |
| Identity symbol | `loyaltyId` |
| Description | `Loyalty program membership ID` |
| Identity type | **Cross-device ID** |

Click **Create**.

## Verify
You should now see in the Identities list:
- ✅ Email (built-in)
- ✅ ECID (built-in)
- ✅ AAID (built-in — from earlier Analytics work)
- ✅ **CRM ID** (just created)
- ✅ **Loyalty ID** (just created)

---

# STEP 2 — Create Tenant Field Group `_f1racingstore` (15 min)

Each schema will reuse a custom field group. Easier to create once and reference.

## Why
All our offline data has F1-specific fields (customerTier, loyalty, channel, etc.). Adobe stores tenant-specific extensions under `_{tenantId}` to keep them separate from standard fields.

## Steps

1. Left navigation → **Schemas**
2. Top tab → **Field groups**
3. Top-right → **Create field group**

### Field group #1: F1 CRM Profile Extension
| Field | Value |
|---|---|
| Display name | `F1 CRM Profile Extension` |
| Description | `F1 Racing Store CRM-specific profile fields` |
| Class | **XDM Individual Profile** |

Click **Save**.

Now add fields. Click **+ Add** next to the schema root (right-side panel).

For each field, define under `_{tenant}.f1racingstore.crm.{fieldName}`:

| Field name | Type | Notes |
|---|---|---|
| customerTier | String | Enum: standard, silver, gold, vip |
| lifetimeValue | Double | Currency |
| favoriteTeam | String | |
| registrationDate | Date | |
| lastActivityDate | Date | |
| marketingConsent | Boolean | |
| emailOptIn | Boolean | |
| smsOptIn | Boolean | |

**Save**.

### Field group #2: F1 Loyalty Extension
Repeat Create field group:
| Field | Value |
|---|---|
| Display name | `F1 Loyalty Extension` |
| Class | **XDM Individual Profile** |

Add fields under `_{tenant}.f1racingstore.loyalty.{fieldName}`:

| Field name | Type |
|---|---|
| membershipTier | String |
| pointsBalance | Integer |
| pointsLifetimeEarned | Integer |
| pointsLifetimeRedeemed | Integer |
| membershipStartDate | Date |
| nextTierThresholdPoints | Integer |
| isActive | Boolean |

**Save**.

### Field group #3: F1 Offline Order Extension
| Field | Value |
|---|---|
| Display name | `F1 Offline Order Extension` |
| Class | **XDM ExperienceEvent** |

Add under `_{tenant}.f1racingstore.offlineOrder.{fieldName}`:

| Field name | Type |
|---|---|
| channel | String |
| salesAssociate | String |
| promoCode | String |
| storeId | String |

**Save**.

### Field group #4: F1 Email Extension
| Field | Value |
|---|---|
| Display name | `F1 Email Extension` |
| Class | **XDM ExperienceEvent** |

Add under `_{tenant}.f1racingstore.email.{fieldName}`:

| Field name | Type |
|---|---|
| campaignType | String |
| converted | Boolean |
| conversionValue | Double |
| unsubscribed | Boolean |
| client | String |

**Save**.

### Field group #5: F1 Call Center Extension
| Field | Value |
|---|---|
| Display name | `F1 Call Center Extension` |
| Class | **XDM ExperienceEvent** |

Add under `_{tenant}.f1racingstore.callCenter.{fieldName}`:

| Field name | Type |
|---|---|
| callReason | String |
| callCategory | String |
| agentId | String |
| durationSeconds | Integer |
| resolved | Boolean |
| satisfactionRating | Integer |
| escalated | Boolean |
| followUpRequired | Boolean |
| channel | String |

**Save**.

## Verify
**Schemas → Field groups → Filter "F1"** — should show 5 field groups created.

---

# STEP 3 — Create the 5 Schemas (60 min)

Now we assemble schemas using Adobe-built-in field groups + our custom field groups.

## Schema 1: F1 - CRM Customer Profile

### Create
1. **Schemas → Browse → Create schema**
2. Pick **Individual Profile** class → **Next**
3. Name: `F1 - CRM Customer Profile`
4. Description: `Master CRM profile for F1 Racing Store customers`

### Add Field Groups (click "+ Add" next to schema name)
- **Demographic Details** (built-in) — gives `person.name.firstName`, `.lastName`, `person.birthDate`
- **Personal Contact Details** (built-in) — gives `personalEmail.address`, `mobilePhone.number`, `homeAddress.*`
- **IdentityMap** (built-in)
- **Consents and Preferences** (built-in)
- **F1 CRM Profile Extension** (created in Step 2)

### Configure identities
1. Click **identityMap** field → right pane → confirm it's an identity field
2. Top-right toggle: **Profile** → ON

### Save
Top-right **Save**.

## Schema 2: F1 - Loyalty Program

1. **Create schema** → **Individual Profile** class
2. Name: `F1 - Loyalty Program`
3. Add field groups:
   - **IdentityMap**
   - **F1 Loyalty Extension**
4. Toggle **Profile: ON**
5. **Save**

## Schema 3: F1 - Offline Purchases

1. **Create schema** → **XDM ExperienceEvent** class
2. Name: `F1 - Offline Purchases`
3. Add field groups:
   - **Commerce Details** (built-in)
   - **Product List Items** (built-in)
   - **IdentityMap**
   - **F1 Offline Order Extension**
4. Toggle **Profile: ON**
5. **Save**

## Schema 4: F1 - Email Engagement

1. **Create schema** → **XDM ExperienceEvent** class
2. Name: `F1 - Email Engagement`
3. Add field groups:
   - **Direct Marketing** (built-in)
   - **IdentityMap**
   - **F1 Email Extension**
4. Toggle **Profile: ON**
5. **Save**

## Schema 5: F1 - Customer Service

1. **Create schema** → **XDM ExperienceEvent** class
2. Name: `F1 - Customer Service`
3. Add field groups:
   - **IdentityMap**
   - **F1 Call Center Extension**
4. Toggle **Profile: ON**
5. **Save**

## Verify
**Schemas → Browse → Filter "F1"** — should show 5 schemas, each marked Profile-enabled.

---

# STEP 4 — Create the 5 Datasets (15 min)

A dataset is the storage container that uses a schema.

For each schema, repeat this flow:

1. **Datasets → Create dataset**
2. **Create dataset from schema** → pick the schema
3. Name: (match the schema, drop "F1 -" prefix for brevity)
4. Toggle **Profile: ON**
5. **Save**

| Schema | Dataset name |
|---|---|
| F1 - CRM Customer Profile | `F1 CRM Customers` |
| F1 - Loyalty Program | `F1 Loyalty Members` |
| F1 - Offline Purchases | `F1 Offline Purchases` |
| F1 - Email Engagement | `F1 Email Marketing` |
| F1 - Customer Service | `F1 Customer Service` |

## Verify
**Datasets → Filter "F1"** — should show 5 + the existing `F1 Racing Store midValues` (online).

---

# STEP 5 — Upload the 5 CSVs (30 min)

We'll use Adobe's **Local file upload** source — no S3/Azure needed.

CSV files are in: `D:\ideation\racing-f1\docs\offline-data\data\`

## Upload 5.1 — CRM Customers

1. **Sources → Catalog**
2. Find **"Local system"** category → **"Local file upload"** → click → **Add data**
3. Drag-drop **`1-crm-customer-profile.csv`**
4. Wait for preview (Adobe parses first ~100 rows)
5. **Next → Dataflow detail**:
   - Dataset: select **`F1 CRM Customers`**
6. **Next → Mapping**:
   - Adobe shows CSV columns on left, XDM target on right
   - Map each column:

| CSV column | XDM target |
|---|---|
| customerId | `identityMap.crmId[0].id` — toggle **"Primary identity"** ON |
| email | `identityMap.Email[0].id` — toggle **"Primary identity"** OFF |
| email | (also map to `personalEmail.address`) |
| firstName | `person.name.firstName` |
| lastName | `person.name.lastName` |
| dateOfBirth | `person.birthDate` |
| phone | `mobilePhone.number` |
| country | `homeAddress.country` |
| city | `homeAddress.city` |
| addressLine1 | `homeAddress.street1` |
| postalCode | `homeAddress.postalCode` |
| customerTier | `_tenant.f1racingstore.crm.customerTier` |
| lifetimeValue | `_tenant.f1racingstore.crm.lifetimeValue` |
| favoriteTeam | `_tenant.f1racingstore.crm.favoriteTeam` |
| registrationDate | `_tenant.f1racingstore.crm.registrationDate` |
| lastActivityDate | `_tenant.f1racingstore.crm.lastActivityDate` |
| marketingConsent | `_tenant.f1racingstore.crm.marketingConsent` |
| emailOptIn | `_tenant.f1racingstore.crm.emailOptIn` |
| smsOptIn | `_tenant.f1racingstore.crm.smsOptIn` |

(`_tenant` shows as your actual org tenant ID — leave Adobe's auto-fill)

7. **Next → Review** → **Finish**

Wait ~5 min for ingestion. Check **Datasets → F1 CRM Customers → Activity** — record count should reach **200**.

## Upload 5.2 — Loyalty Members

Same flow with `2-loyalty-program.csv` → dataset `F1 Loyalty Members`.

Mapping:
| CSV column | XDM target |
|---|---|
| loyaltyId | `identityMap.loyaltyId[0].id` — **Primary identity ON** |
| customerId | `identityMap.crmId[0].id` |
| email | `identityMap.Email[0].id` |
| membershipTier | `_tenant.f1racingstore.loyalty.membershipTier` |
| pointsBalance | `_tenant.f1racingstore.loyalty.pointsBalance` |
| pointsLifetimeEarned | `_tenant.f1racingstore.loyalty.pointsLifetimeEarned` |
| pointsLifetimeRedeemed | `_tenant.f1racingstore.loyalty.pointsLifetimeRedeemed` |
| membershipStartDate | `_tenant.f1racingstore.loyalty.membershipStartDate` |
| nextTierThresholdPoints | `_tenant.f1racingstore.loyalty.nextTierThresholdPoints` |
| isActive | `_tenant.f1racingstore.loyalty.isActive` |

Wait for 200 records.

## Upload 5.3 — Offline Purchases

`3-offline-purchases.csv` → dataset `F1 Offline Purchases`.

This is an ExperienceEvent, so it also needs `timestamp` and `eventType`.

| CSV column | XDM target |
|---|---|
| orderId | `commerce.order.purchaseID` |
| customerId | `identityMap.crmId[0].id` |
| loyaltyId | `identityMap.loyaltyId[0].id` |
| email | `identityMap.Email[0].id` |
| orderDate | `timestamp` |
| productId | `productListItems[0].SKU` |
| productName | `productListItems[0].name` |
| productCategory | `productListItems[0].productCategories[0].categoryID` |
| quantity | `productListItems[0].quantity` |
| unitPrice | `productListItems[0].priceTotal` |
| lineTotal | (skip — calculated) |
| currency | `productListItems[0].currencyCode` + `commerce.order.currencyCode` |
| paymentMethod | `commerce.order.payments[0].paymentType` |
| channel | `_tenant.f1racingstore.offlineOrder.channel` |
| salesAssociate | `_tenant.f1racingstore.offlineOrder.salesAssociate` |
| promoCode | `_tenant.f1racingstore.offlineOrder.promoCode` |

**Also set static values** in the mapping screen:
- `eventType` = `commerce.purchases` (constant value)
- `commerce.purchases.value` = `1` (constant)

Wait for 2,179 records.

## Upload 5.4 — Email Engagement

`4-email-engagement.csv` → dataset `F1 Email Marketing`.

| CSV column | XDM target |
|---|---|
| emailId | `_id` |
| email | `identityMap.Email[0].id` |
| customerId | `identityMap.crmId[0].id` |
| sendDate | `timestamp` |
| delivered | (use as filter — keep only delivered=true) |
| opened | (logic: if true, also set `directMarketing.opens.value = 1`) |
| clicked | (logic: if true, also set `directMarketing.clicks.value = 1`) |
| converted | `_tenant.f1racingstore.email.converted` |
| conversionValue | `_tenant.f1racingstore.email.conversionValue` |
| campaignType | `_tenant.f1racingstore.email.campaignType` |
| campaignName | `_experience.campaign.message.profile.messageID` |
| unsubscribed | `_tenant.f1racingstore.email.unsubscribed` |
| deviceType | `device.type` |
| emailClient | `_tenant.f1racingstore.email.client` |

Static:
- `eventType` = `directMarketing.emailSent`
- `directMarketing.deliveries.value` = `1`

Wait for 2,385 records.

## Upload 5.5 — Call Center

`5-call-center.csv` → dataset `F1 Customer Service`.

| CSV column | XDM target |
|---|---|
| callId | `_id` |
| customerId | `identityMap.crmId[0].id` |
| email | `identityMap.Email[0].id` |
| callDate | `timestamp` |
| channel | `_tenant.f1racingstore.callCenter.channel` |
| callReason | `_tenant.f1racingstore.callCenter.callReason` |
| callCategory | `_tenant.f1racingstore.callCenter.callCategory` |
| agentId | `_tenant.f1racingstore.callCenter.agentId` |
| durationSeconds | `_tenant.f1racingstore.callCenter.durationSeconds` |
| resolved | `_tenant.f1racingstore.callCenter.resolved` |
| satisfactionRating | `_tenant.f1racingstore.callCenter.satisfactionRating` |
| escalated | `_tenant.f1racingstore.callCenter.escalated` |
| followUpRequired | `_tenant.f1racingstore.callCenter.followUpRequired` |

Static:
- `eventType` = `customerService.interaction`

Wait for 378 records.

## Final verification — all 5 datasets

**Datasets → Filter "F1"** — verify counts:
- F1 Racing Store midValues: 10k+ (online — existing)
- **F1 CRM Customers: 200**
- **F1 Loyalty Members: 200**
- **F1 Offline Purchases: 2,179**
- **F1 Email Marketing: 2,385**
- **F1 Customer Service: 378**

If counts are wrong, click the dataset → **Activity** → check for ingestion errors.

---

# STEP 6 — Verify Identity Stitching (15 min)

Now check that Adobe is correctly linking the same person across the 5 datasets via Email.

## Test 1: Identity Graph Viewer

1. **Identities → Identity Graph Viewer**
2. **Search by:** Email
3. Enter a sample email that exists in CRM + Online (look in `1-crm-customer-profile.csv` for any `rf1-w*-s*-*-*-*@f1traffic.com` email)
4. Click **Search**

**Expected graph:**
```
       ┌─ ECID:xxx (from online Web SDK)
Email ─┤
       ├─ crmId:CRM-00100005 (from CRM dataset)
       └─ loyaltyId:LYL-00200005 (from Loyalty dataset)
```

If you see all 3 linked → ✅ stitching works.

If only some show → wait ~15 more min and retry (backfill still processing).

## Test 2: Profile View

1. **Profiles → Browse**
2. **Identity namespace:** Email
3. **Identity value:** paste an email that should exist
4. **View profile**

**Expected:**
- **Attributes pane** shows: firstName, lastName, customerTier, lifetimeValue, favoriteTeam (from CRM) + membershipTier, pointsBalance (from Loyalty)
- **Events pane** shows mixed: web events + offline purchase events + email events + call events
- All under ONE merged profile

---

# STEP 7 — Create Merge Policy (5 min)

Tells Adobe how to combine multiple profile fragments into one.

1. **Profiles → Merge policies → Create**
2. Fill:

| Field | Value |
|---|---|
| Name | `F1 Customer Master Profile` |
| Schema | XDM Individual Profile |
| Identity graph | **Private Graph** |
| Attribute merge | **Timestamp ordered** |
| Datasets to include | All Profile-enabled F1 datasets |
| Active on edge | ✅ Yes (for RTCDP real-time) |
| Default merge policy | ✅ Yes |

3. **Save**.

Wait ~15 min for policy to apply.

---

# STEP 8 — Add Offline Datasets to CJA Connection (15 min)

1. **CJA → Connections → F1 Racing Store** (existing from earlier work)
2. Top-right → **Edit Connection**
3. **Add datasets**:
   - F1 Offline Purchases (Event)
   - F1 Email Marketing (Event)
   - F1 Customer Service (Event)
   - F1 CRM Customers (Profile)
   - F1 Loyalty Members (Profile)

4. For each newly-added Event dataset, set **Person ID:**
   - F1 Offline Purchases → `identityMap.Email[0].id`
   - F1 Email Marketing → `identityMap.Email[0].id`
   - F1 Customer Service → `identityMap.Email[0].id`

5. **Enable identity stitching** (top of connection):
   - Check ☑ **Enable identity stitching**
   - Persistent ID field: `identityMap.Email[0].id`

6. **Save**

Connection rebuilds + backfills. Wait ~30 min.

---

# STEP 9 — Update Data View with Offline Components (30 min)

1. **CJA → Data Views → F1 - Web → Edit**
2. **Components tab**

### Add these new dimensions (left rail → drag to "Included")

Search and add:

**Profile attributes (CRM):**
- `_tenant.f1racingstore.crm.customerTier` → rename "Customer Tier"
- `_tenant.f1racingstore.crm.favoriteTeam` → rename "Favorite Team"
- `_tenant.f1racingstore.crm.registrationDate` → rename "CRM Registration Date"
- `homeAddress.country` → rename "Country"

**Profile attributes (Loyalty):**
- `_tenant.f1racingstore.loyalty.membershipTier` → rename "Loyalty Tier"

**Offline Purchase dimensions:**
- `_tenant.f1racingstore.offlineOrder.channel` → "Offline Channel"
- `_tenant.f1racingstore.offlineOrder.salesAssociate` → "Sales Associate"
- `_tenant.f1racingstore.offlineOrder.promoCode` → "Offline Promo Code"
- `commerce.order.payments[].paymentType` → "Payment Method"

**Email dimensions:**
- `_tenant.f1racingstore.email.campaignType` → "Email Campaign Type"
- `_experience.campaign.message.profile.messageID` → "Email Campaign Name"

**Call Center dimensions:**
- `_tenant.f1racingstore.callCenter.callReason` → "Call Reason"
- `_tenant.f1racingstore.callCenter.callCategory` → "Call Category"
- `_tenant.f1racingstore.callCenter.agentId` → "Agent ID"

### Add these new metrics

- `_tenant.f1racingstore.crm.lifetimeValue` → "LTV" (Format: Currency INR)
- `_tenant.f1racingstore.loyalty.pointsBalance` → "Loyalty Points"
- `commerce.order.priceTotal` → "Order Revenue" (Currency INR)
- `directMarketing.opens.value` → "Email Opens"
- `directMarketing.clicks.value` → "Email Clicks"
- `_tenant.f1racingstore.email.conversionValue` → "Email-Driven Revenue" (Currency INR)
- `_tenant.f1racingstore.callCenter.durationSeconds` → "Call Duration"
- `_tenant.f1racingstore.callCenter.satisfactionRating` → "CSAT"
- `_tenant.f1racingstore.callCenter.resolved` → "Calls Resolved" (count where = true)

### Add Calculated Metrics

**Calculated metrics tab → Create**:

**Email Open Rate**
```
Formula: Email Opens / Email Sends
Format: Percent
```

**Email CTR**
```
Formula: Email Clicks / Email Opens
Format: Percent
```

**Total Customer Value**
```
Formula: Online Revenue + Offline Order Revenue
Format: Currency INR
```

**Cart Abandonment Rate**
```
Formula: 1 - (Orders / Cart Adds)
Format: Percent
```

3. **Save and finish**

Data view rebuilds. Wait 10 min.

---

# STEP 10 — Build Use Case 2: Customer 360 Dashboard (30 min)

This is your first big payoff — a unified person view.

1. **CJA → Workspace → Projects → Create project**
2. Blank project
3. Name: **`02 Customer 360 Dashboard`**
4. Data view: **F1 - Web**

### Panel 1: Person Search Header

Add **Text** component at top: "Customer 360 — Cross-Channel Profile"

Add **Filter** at top:
- Dimension: Person ID (Email)
- Type: Specific Person ID
- The user enters an email here to filter the whole dashboard

### Panel 2: Top Scorecards Row (4 KPIs)

Use **Summary number** visualizations:

| KPI | Metric | Source |
|---|---|---|
| Lifetime Value | Total Customer Value | calc |
| Loyalty Points | Loyalty Points | profile |
| Total Sessions (web) | Sessions | online |
| Days Since Last Order | latest order date - now | calc |

### Panel 3: Cross-Channel Timeline (Flow)

Visualization: **Flow**
- Show events chronologically
- Color by dataset (Web SDK = blue, Offline = green, Email = orange, Call = red)
- Dimension breakdown: eventType
- Time range: Last 365 days

### Panel 4: Top Products (Online vs Offline) — Bar Chart

Two side-by-side **Freeform tables**:
- Left: Top 10 products from online (`commerce.productListAdds`)
- Right: Top 10 from offline (`F1 Offline Purchases`)
- Compare overlap

### Panel 5: Engagement Heatmap

**Histogram**: Day of week × Hour, colored by event count

5. **Save**

### Test it
- Top filter → enter an email that has both online + offline activity (check sample data CSVs)
- All panels should populate
- Some panels (top products) will show category differences online vs offline

---

# STEP 11 — Build Use Case 1: Cart Abandonment Recovery (45 min)

This is the highest-revenue-impact use case.

## Part A: Workspace Project

1. **Create project → Blank → Name: `01 Cart Abandonment Recovery`**
2. Data view: **F1 - Web**

### Panel 1: Abandoners by Customer Tier

**Freeform table:**
| Dim | Customer Tier (offline) |
| Metric 1 | Cart Adds Last 7 Days |
| Metric 2 | Orders Last 7 Days |
| Metric 3 | Abandonment Rate (calc) |
| Metric 4 | LTV |

Filter: Person ID is identified (not anonymous ECID-only).

### Panel 2: Abandonment Funnel

**Fallout visualization:**
1. Product Viewed (commerce.productViews)
2. Add to Cart (commerce.productListAdds)
3. Begin Checkout (commerce.checkouts)
4. Purchase (commerce.purchases)

Time: Last 30 days. Person ID: identified only.

### Panel 3: Recoverable Cart Value

**Summary number:**
- Metric: Sum of `productListItems[].priceTotal` where added but not purchased
- Filter: Persons with identityMap.Email AND opted in to marketing

This = the total revenue opportunity.

3. **Save**

## Part B: RTCDP Audience

1. **RTCDP → Audiences → Create audience → Build rule**
2. Name: **`Cart Abandoners — Identified`**

### Build rule:
- **Include** persons WHERE:
  - **Events** → `commerce.productListAdds.value ≥ 1` in **last 7 days**
- **And NOT** WHERE:
  - **Events** → `commerce.purchases.value ≥ 1` in **last 7 days**
- **And** WHERE:
  - **Profile** → `identityMap.Email[0].id` **exists**
- **And** WHERE:
  - **Profile** → `_tenant.f1racingstore.crm.emailOptIn = true`
- **And** WHERE:
  - **Profile** → `_tenant.f1racingstore.crm.marketingConsent = true`

3. **Save**

Wait ~15 min for audience to populate. Expected size: **30-50 profiles** (based on synthetic data).

## Part C: Activation (if you have a destination configured)

If Adobe Campaign / SFMC / Meta is connected:

1. **RTCDP → Destinations → Catalog**
2. Pick destination (Email = Adobe Campaign Standard)
3. **Activate audience to destination**
4. Pick **Cart Abandoners — Identified**
5. Map identity to destination's required attribute (e.g., Email hashed for Meta)
6. Schedule: **Hourly refresh**
7. Save

If no destination connected, document the intent in the use case doc and skip activation.

---

# STEP 12 — Validate End-to-End (15 min)

## Test 1: Identity stitching is real

1. Pick a customer email that exists in BOTH online + CRM (look at customer #5 in `1-crm-customer-profile.csv`)
2. **AEP → Profiles → Browse → enter that email**
3. Verify Events list contains:
   - Web events (online)
   - Offline purchase events
   - Email engagement events
   (Calls if that customer had them)

✅ All under one profile = stitching works.

## Test 2: CJA Customer 360 dashboard shows cross-channel

1. Open the `02 Customer 360 Dashboard` project
2. Filter to that same email
3. All 4 panels should show populated data
4. Timeline (Flow) should show events from multiple sources colored differently

## Test 3: Cart Abandonment audience has members

1. **RTCDP → Audiences → Cart Abandoners — Identified**
2. Wait until "Profile count" shows a number > 0
3. Click → see sample profiles (should show emails)

## Test 4: Calculated metrics work

1. Open `01 Cart Abandonment Recovery` project
2. Verify Abandonment Rate, Total Customer Value display proper numbers
3. Check the funnel — should show drop-off at each step

## All 4 tests pass → SUCCESS

You've now implemented:
- ✅ AEP Schema design (Adobe XDM compliant)
- ✅ Multi-source ingestion (5 datasets)
- ✅ Identity stitching (3 namespaces linked via Email)
- ✅ CJA Connection (online + offline unified)
- ✅ Data View (cross-source dimensions/metrics)
- ✅ Workspace projects (Customer 360 + Cart Abandonment)
- ✅ RTCDP audience definition
- ✅ Optional activation destination

---

# What's NEXT

Once Steps 1-12 are validated, build the other 4 use cases following the same pattern (Workspace project + RTCDP audience + Activation):

3. **Cross-Channel Attribution** (`03-USE-CASES.md` Use Case 3)
4. **Loyalty Engagement** (Use Case 4)
5. **Churn Risk** (Use Case 5)
6. **Personalization** (Use Case 6)

Each one uses the **same identity-stitched profile** — just different segment rules and panels.

---

# Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Dataset shows 0 records ingested | CSV header mismatch | Match exact header names; check for extra whitespace |
| Identity Graph Viewer shows no links | Email casing differs | Add lowercase transform in mapping or re-upload with lowercased emails |
| Profile shows fragments not merged | Merge policy not yet active | Wait 30 min after policy creation |
| CJA dashboard blank | Connection backfill incomplete | Check Connection → Status (should say "Active" with row count > 0) |
| Audience size = 0 | Segmentation hasn't run | Audiences refresh every 30 min by default; wait |
| Activation fails | Identity not in destination's accepted namespaces | Adjust mapping (often need hashed Email) |

---

# Estimated Total Time

| Phase | Time | Can be parallel? |
|---|---|---|
| Steps 1-4 (schemas/datasets) | 1.5 hr | No |
| Step 5 (CSV uploads) | 30 min upload + 30 min waits | Waits parallel |
| Step 6 (verify stitching) | 15 min | After waits |
| Step 7 (merge policy) | 5 min + 15 min wait | |
| Step 8 (CJA connection) | 15 min + 30 min wait | After merge policy |
| Step 9 (Data View) | 30 min + 10 min wait | |
| Step 10 (Customer 360) | 30 min | After data view |
| Step 11 (Cart Abandonment) | 45 min | After data view |
| Step 12 (Validation) | 15 min | After all |
| **TOTAL active work** | **~4 hours** | |
| **TOTAL including waits** | **~6 hours (1 day)** | |

Don't try to do this in one session — split across 2 days:
- **Day 1**: Steps 1-7 (schemas, datasets, ingestion, stitching, merge policy)
- **Day 2**: Steps 8-12 (CJA + Workspace + Audiences)

This way the waits happen naturally between work sessions.
