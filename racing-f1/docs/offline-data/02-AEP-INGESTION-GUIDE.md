# AEP Ingestion & Identity Stitching — Step-by-Step

End-to-end guide to ingest the 5 CSVs into AEP and enable identity stitching with online Web SDK data.

**References:**
- Sources overview: `experienceleague.adobe.com/docs/experience-platform/sources/home.html`
- Local file upload: `experienceleague.adobe.com/docs/experience-platform/sources/connectors/data-partners/data-landing-zone.html`
- Identity stitching: `experienceleague.adobe.com/docs/analytics-platform/using/cja-connections/configure-stitching.html`

---

## Prerequisites checklist

- [ ] You have AEP **System Administrator** or equivalent permission
- [ ] Web SDK is already pushing online data to `F1 Racing Store midValues` (current prod state ✓)
- [ ] You've created the 4 identity namespaces (see `01-XDM-SCHEMAS.md`)
- [ ] CSV files exist in `docs/offline-data/data/`

---

## PHASE 1 — Create the 5 schemas

For each of the 5 schemas in `01-XDM-SCHEMAS.md`:

1. **AEP → Schemas → Create schema**
2. Pick the class (Individual Profile OR ExperienceEvent — see schema doc)
3. Add the listed field groups (Adobe-built-in + your custom `_f1racingstore.*`)
4. Add `identityMap` field group
5. Mark identity fields as `Identity` (right-pane) with the correct namespace
6. Toggle **"Profile"** ON (top-right)
7. Save

**Order matters:** Create the **`F1 - CRM Customer Profile`** schema first — it's the master profile. The other 4 schemas reference identities (Email, crmId) that need to exist.

---

## PHASE 2 — Create 5 datasets

For each schema:

1. **AEP → Datasets → Create dataset → From schema**
2. Pick the schema
3. Name it exactly:
   - `F1 CRM Customers`
   - `F1 Loyalty Members`
   - `F1 Offline Purchases`
   - `F1 Email Marketing`
   - `F1 Customer Service`
4. Toggle **Profile** ON
5. Save

---

## PHASE 3 — Upload CSVs via Sources

For each CSV, use the **Local file upload** source (no S3/Azure required).

### 3.1 Upload `1-crm-customer-profile.csv`

1. **AEP → Sources → Catalog**
2. Search **"Local file upload"** → click it → **Add data**
3. Drag-drop `docs/offline-data/data/1-crm-customer-profile.csv`
4. Click **Next**
5. **Select dataset** → choose **`F1 CRM Customers`**
6. **Mapping screen** — Adobe shows CSV columns on left, XDM fields on right
   - Map each column to the XDM path from `01-XDM-SCHEMAS.md → Schema 1 mapping table`
   - **Critical:** for `customerId` map to `identityMap.crmId[0].id` and toggle **"Is primary identity"** ON
   - For `email` map to BOTH `identityMap.Email[0].id` AND `personalEmail.address`
7. **Next → Dataflow detail** → Name: `F1 CRM ingestion`, set **Run once**
8. **Next → Review → Finish**

### 3.2 Repeat for the other 4 CSVs

Same process, using the mapping tables from `01-XDM-SCHEMAS.md`:
- `2-loyalty-program.csv` → `F1 Loyalty Members` dataset
- `3-offline-purchases.csv` → `F1 Offline Purchases` dataset
- `4-email-engagement.csv` → `F1 Email Marketing` dataset
- `5-call-center.csv` → `F1 Customer Service` dataset

### 3.3 Verify ingestion (after ~15 min)

For each dataset:
1. **AEP → Datasets → click the dataset**
2. Check **"Records ingested"** count matches:
   - CRM: 200
   - Loyalty: 200
   - Offline Purchases: 2,179
   - Email: 2,385
   - Call Center: 378
3. Click **Preview dataset** → spot-check the field mappings

---

## PHASE 4 — Identity stitching

### 4.1 Verify identity graph

**AEP → Identities → Identity Graph Viewer**

Search for an email that appears in BOTH online + offline (e.g., `rf1-w5-s10-gold-xxx@f1traffic.com`).

Expected graph:
```
        ┌─ ECID:xxx (from web)
Email ──┤
        ├─ crmId:CRM-00010005 (from CRM)
        └─ loyaltyId:LYL-00020005 (from loyalty)
```

If the graph shows multiple identities linked to one Email → **stitching works**.

### 4.2 Create merge policy

**AEP → Profiles → Merge Policies → Create**

| Field | Value |
|---|---|
| Name | `F1 Customer Master Profile` |
| Schema | XDM Individual Profile |
| Identity graph | Private Graph |
| Attribute merge | Timestamp ordered (newest wins) |
| Active on edge | ✅ Yes |
| Default merge policy | ✅ Yes |

Save.

### 4.3 Verify unified profile

**AEP → Profiles → Browse → search by Email**

Pick a customer who has online + CRM + loyalty data. The profile view should show:
- Attributes from CRM (name, address, tier)
- Attributes from Loyalty (points, membership)
- Events from web (Page Views, Add to Cart)
- Events from offline purchases
- Events from email engagement
- Events from call center

That's the **unified customer 360**.

---

## PHASE 5 — Connect to CJA

### 5.1 Update existing CJA Connection

Go to **CJA → Connections → F1 Racing Store** (existing connection from earlier work).

Click **Edit Connection → Add datasets**:

Add all 4 ExperienceEvent datasets:
- `F1 Offline Purchases`
- `F1 Email Marketing`
- `F1 Customer Service`
- (Already added: `F1 Racing Store midValues` — the online data)

### 5.2 Configure Person ID per dataset

For each newly added dataset, set:

| Dataset | Person ID |
|---|---|
| F1 Racing Store midValues (existing) | Adobe Marketing Cloud ID (mcid.id) |
| F1 Offline Purchases | `identityMap.Email[0].id` |
| F1 Email Marketing | `identityMap.Email[0].id` |
| F1 Customer Service | `identityMap.Email[0].id` |

### 5.3 Enable identity stitching on the connection

Per Adobe docs:

1. Click **Edit Connection** → check **"Enable identity stitching"**
2. **Persistent ID field:** `identityMap.Email[0].id`
3. Save → re-backfill begins (~30 min)

This stitches **anonymous online visitors** with **identified online/offline customers** when they later log in or appear in offline data with the same email.

### 5.4 Add the CRM Profile + Loyalty datasets to the Connection

For Profile lookup datasets:
- **F1 CRM Customers** → "Profile" dataset type
- **F1 Loyalty Members** → "Profile" dataset type

These enrich every event with attributes from the master profile.

### 5.5 Save the connection → wait for backfill

After backfill completes (~30 min for these volumes), CJA Workspace can query the unified person view.

---

## PHASE 6 — Update the Data View

**CJA → Data Views → F1 - Web → Edit**

Add new components (dimensions/metrics) for the offline data:

### New dimensions
- `Channel (offline)` → `_f1racingstore.offlineOrder.channel`
- `Sales Associate` → `_f1racingstore.offlineOrder.salesAssociate`
- `Payment Method` → `commerce.order.payments[0].paymentType`
- `Email Campaign` → `_experience.campaign.message.profile.messageID`
- `Email Campaign Type` → `_f1racingstore.email.campaignType`
- `Call Reason` → `_f1racingstore.callCenter.callReason`
- `Call Category` → `_f1racingstore.callCenter.callCategory`
- `Customer Tier` (cross-source) → `_f1racingstore.crm.customerTier`
- `Loyalty Tier` → `_f1racingstore.loyalty.membershipTier`
- `Favorite Team` → `_f1racingstore.crm.favoriteTeam`

### New metrics
- `Offline Revenue` → `commerce.order.priceTotal` (filtered by dataset = F1 Offline Purchases)
- `Email Opens` → `directMarketing.opens.value`
- `Email Clicks` → `directMarketing.clicks.value`
- `Email Conversion Revenue` → `_f1racingstore.email.conversionValue`
- `Call Center Interactions` → `count(events)` (filtered by dataset = F1 Customer Service)
- `Average Call Satisfaction` → `avg(_f1racingstore.callCenter.satisfactionRating)`
- `Loyalty Points Balance` → `_f1racingstore.loyalty.pointsBalance` (latest per person)

### Calculated metrics
- `Total Customer Value` = `Online Revenue + Offline Revenue`
- `Cross-channel Conversion Rate` = `Customers with both Online + Offline / Total Customers`
- `Email-to-purchase Conversion` = `Orders within 7 days of email click / Email Clicks`
- `Customer Service Cost per Customer` = `Sum(durationSeconds × $0.50/min) / Unique customers`

Save the data view.

---

## Verification checklist

After all phases complete:

- [ ] All 5 datasets show ingested record counts matching CSV row counts
- [ ] Identity Graph Viewer shows linked identities for sample emails
- [ ] Profile Browse shows unified customer with web + offline + loyalty data
- [ ] CJA Connection shows 4 ExperienceEvent datasets + 2 Profile datasets
- [ ] CJA Data View has new offline dimensions/metrics
- [ ] CJA Workspace can build a Freeform table with `Customer Tier` (offline) × `Page Views` (online) — should show data

---

## Common issues

| Problem | Likely cause | Fix |
|---|---|---|
| Records ingested = 0 | CSV column header mismatch | Check exact header names, no extra whitespace |
| Identity not stitching | Email format differs (case, whitespace) | Lowercase + trim emails before ingestion |
| Profile shows split records | Wrong primary identity setting | Verify primary identity toggle in mapping |
| CJA shows offline data blank | Person ID misconfigured | Re-set Person ID = `identityMap.Email[0].id` |
| Backfill takes >2 hours | Large dataset processing queue | Check Source dataflow run status |
