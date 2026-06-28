# XDM Schemas for Offline Datasets

Per Adobe official documentation. Each CSV → one AEP schema → one dataset.

**References:**
- XDM Individual Profile: `experienceleague.adobe.com/docs/experience-platform/xdm/classes/individual-profile.html`
- XDM Field Groups: `experienceleague.adobe.com/docs/experience-platform/xdm/field-groups/`
- Identity Service: `experienceleague.adobe.com/docs/experience-platform/identity/home.html`

---

## Identity Namespaces (create FIRST in AEP)

Before any schema, create the identity namespaces in **AEP → Identities → Namespaces**:

| Namespace | Symbol | Type | Identity Type | Purpose |
|---|---|---|---|---|
| Email | `Email` | Standard (built-in) | Email Address | Primary stitch — matches online identityMap.Email |
| ECID | `ECID` | Standard (built-in) | Cookie | Online anonymous |
| CRM ID | `crmId` | Custom (create) | Cross-device ID | Offline primary |
| Loyalty ID | `loyaltyId` | Custom (create) | Cross-device ID | Loyalty program |

To create custom namespace: **Identities → New namespace** → fill name `crmId` → symbol `crmId` → type `Cross-device ID` → Save. Repeat for `loyaltyId`.

---

## Schema 1: F1 - CRM Customer Profile

**Class:** XDM Individual Profile
**Dataset:** `F1 CRM Customers`
**Source CSV:** `1-crm-customer-profile.csv` (200 rows)
**Profile-enabled:** ✅ YES (this is the master profile)

### Field Groups to add
- Profile Person Details (`person.name.firstName`, `.lastName`, `person.birthDate`)
- Profile Personal Details (`personalEmail.address`, `homeAddress.*`)
- Profile Loyalty Details (Adobe built-in)
- IdentityMap (Email, crmId)
- Consents and Preferences

### Custom field group `_f1racingstore.crm`
```
customerTier        string  (standard|silver|gold|vip)
lifetimeValue       number  (currency)
favoriteTeam        string
registrationDate    date
lastActivityDate    date
marketingConsent    boolean
emailOptIn          boolean
smsOptIn            boolean
```

### CSV → XDM mapping (use in AEP Sources mapper)
| CSV column | XDM path |
|---|---|
| customerId | `identityMap.crmId[0].id` (primary: true) |
| email | `identityMap.Email[0].id` + `personalEmail.address` |
| firstName | `person.name.firstName` |
| lastName | `person.name.lastName` |
| dateOfBirth | `person.birthDate` |
| phone | `mobilePhone.number` |
| country | `homeAddress.country` |
| city | `homeAddress.city` |
| addressLine1 | `homeAddress.street1` |
| postalCode | `homeAddress.postalCode` |
| customerTier | `_f1racingstore.crm.customerTier` |
| lifetimeValue | `_f1racingstore.crm.lifetimeValue` |
| favoriteTeam | `_f1racingstore.crm.favoriteTeam` |
| registrationDate | `_f1racingstore.crm.registrationDate` |
| marketingConsent | `consents.marketing.email.val` (`y` / `n`) |

---

## Schema 2: F1 - Loyalty Program

**Class:** XDM Individual Profile
**Dataset:** `F1 Loyalty Members`
**Source CSV:** `2-loyalty-program.csv` (200 rows)
**Profile-enabled:** ✅ YES (enriches existing profiles)

### Field Groups
- IdentityMap (loyaltyId, Email, crmId)
- Profile Loyalty Details (Adobe built-in)
- Custom `_f1racingstore.loyalty`

### Custom field group `_f1racingstore.loyalty`
```
membershipTier              string
pointsBalance               integer
pointsLifetimeEarned        integer
pointsLifetimeRedeemed      integer
membershipStartDate         date
nextTierThresholdPoints     integer
isActive                    boolean
```

### Mapping
| CSV column | XDM path |
|---|---|
| loyaltyId | `identityMap.loyaltyId[0].id` |
| customerId | `identityMap.crmId[0].id` |
| email | `identityMap.Email[0].id` |
| membershipTier | `_f1racingstore.loyalty.membershipTier` |
| pointsBalance | `_f1racingstore.loyalty.pointsBalance` |
| pointsLifetimeEarned | `_f1racingstore.loyalty.pointsLifetimeEarned` |

---

## Schema 3: F1 - Offline Purchases

**Class:** XDM ExperienceEvent
**Dataset:** `F1 Offline Purchases`
**Source CSV:** `3-offline-purchases.csv` (2,179 rows)
**Profile-enabled:** ✅ YES

### Field Groups
- Commerce Details (`commerce.purchases`, `commerce.order`)
- Product List Items
- IdentityMap (Email, crmId, loyaltyId)
- Custom `_f1racingstore.offlineOrder`

### Custom field group `_f1racingstore.offlineOrder`
```
channel             string (store-newyork, store-london, phone, catalog, etc.)
salesAssociate      string
promoCode           string
storeId             string
```

### Mapping
| CSV column | XDM path |
|---|---|
| orderId | `commerce.order.purchaseID` |
| customerId | `identityMap.crmId[0].id` |
| email | `identityMap.Email[0].id` |
| orderDate | `timestamp` |
| channel | `_f1racingstore.offlineOrder.channel` |
| productId | `productListItems[].SKU` |
| productName | `productListItems[].name` |
| productCategory | `productListItems[].productCategories[0].categoryID` |
| quantity | `productListItems[].quantity` |
| unitPrice | (set `commerce.purchases.value=1`, `productListItems[].priceTotal=unitPrice*quantity`) |
| lineTotal | `commerce.order.priceTotal` (aggregate, or use `productListItems[].priceTotal`) |
| currency | `commerce.order.currencyCode` + `productListItems[].currencyCode` |
| paymentMethod | `commerce.order.payments[0].paymentType` |
| salesAssociate | `_f1racingstore.offlineOrder.salesAssociate` |
| promoCode | `_f1racingstore.offlineOrder.promoCode` |

Also set `eventType: "commerce.purchases"`.

---

## Schema 4: F1 - Email Engagement

**Class:** XDM ExperienceEvent
**Dataset:** `F1 Email Marketing`
**Source CSV:** `4-email-engagement.csv` (2,385 rows)
**Profile-enabled:** ✅ YES

### Field Groups
- Direct Marketing (`directMarketing.opens`, `directMarketing.clicks`, `directMarketing.sends`)
- IdentityMap (Email, crmId)
- Custom `_f1racingstore.email`

### Mapping
| CSV column | XDM path |
|---|---|
| emailId | `_id` |
| email | `identityMap.Email[0].id` |
| customerId | `identityMap.crmId[0].id` |
| campaignName | `_experience.campaign.message.profile.messageID` + `directMarketing.deliveries.value=1` |
| sendDate | `timestamp` |
| opened | (if true: also produce 2nd event with `directMarketing.opens.value=1`, timestamp=openTimestamp) |
| clicked | (if true: 3rd event with `directMarketing.clicks.value=1`) |
| converted | `_f1racingstore.email.converted` |
| conversionValue | `_f1racingstore.email.conversionValue` |
| campaignType | `_f1racingstore.email.campaignType` |
| unsubscribed | `_f1racingstore.email.unsubscribed` (boolean) |
| deviceType | `device.type` |
| emailClient | `_f1racingstore.email.client` |

**Important:** One CSV row → up to 3 events (send / open / click). Either preprocess CSV before upload OR set eventType per row.

Set `eventType: "directMarketing.emailSent"` (or `.emailOpened`, `.emailClicked`).

---

## Schema 5: F1 - Call Center Interactions

**Class:** XDM ExperienceEvent
**Dataset:** `F1 Customer Service`
**Source CSV:** `5-call-center.csv` (378 rows)
**Profile-enabled:** ✅ YES

### Field Groups
- IdentityMap (Email, crmId)
- Custom `_f1racingstore.callCenter`

### Custom field group `_f1racingstore.callCenter`
```
callReason          string
callCategory        string
agentId             string
durationSeconds     integer
resolved            boolean
satisfactionRating  integer (1-5)
escalated           boolean
followUpRequired    boolean
channel             string (phone, chat, email, whatsapp)
```

### Mapping
| CSV column | XDM path |
|---|---|
| callId | `_id` |
| customerId | `identityMap.crmId[0].id` |
| email | `identityMap.Email[0].id` |
| callDate | `timestamp` |
| channel | `_f1racingstore.callCenter.channel` |
| callReason | `_f1racingstore.callCenter.callReason` |
| callCategory | `_f1racingstore.callCenter.callCategory` |
| agentId | `_f1racingstore.callCenter.agentId` |
| durationSeconds | `_f1racingstore.callCenter.durationSeconds` |
| resolved | `_f1racingstore.callCenter.resolved` |
| satisfactionRating | `_f1racingstore.callCenter.satisfactionRating` |

Set `eventType: "customerService.interaction"`.

---

## Profile Merge Policy

After all 5 schemas exist with Profile enabled, create the merge policy:

**AEP → Profiles → Merge Policies → Create**

| Setting | Value |
|---|---|
| Name | `F1 Customer Master Profile` |
| Schema | `XDM Individual Profile` |
| Identity Graph | **Private Graph** |
| Merge attributes | **Timestamp ordered** (latest wins) |
| Active on edge | Yes |
| Default merge policy | ✅ Yes |

This stitches:
- Online ECID (anonymous web) + Online Email (authenticated web)
- Offline crmId + Offline Email
- Loyalty loyaltyId

All linked by **Email**, producing a unified person profile across:
- Web (online)
- CRM (offline)
- Loyalty (offline)
- Offline Purchases
- Email Marketing
- Call Center
