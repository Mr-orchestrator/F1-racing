#!/usr/bin/env node
/**
 * Synthetic Offline Data Generator for F1 Racing Store — v2 (schema-aligned)
 *
 * Generates CSVs that map 1:1 to the 2 AEP schemas (no transforms needed):
 *   - F1 - Customer Profile  (Individual Profile)  ← CRM CSV + Loyalty CSV
 *   - F1 - Offline Events     (ExperienceEvent)     ← Purchases + Email + Calls
 *
 * v2 improvements:
 *   - All event files carry `timestamp` (ISO 8601) + `eventType` (constant)
 *   - Purchases: `purchasesValue` = 1 only on the first line of each order
 *     (so order count isn't inflated) + `orderPriceTotal` on first line
 *   - Email: explicit numeric `sendsValue`/`opensValue`/`clicksValue`
 *     (map straight to directMarketing.*.value — no boolean→number transform)
 *   - Email custom fields map to the renamed `F1emailEngagement.*` path
 *
 * Identity stitch key: email (matches online identityMap.Email)
 *   60% of CRM customers (120/200) use online-matching emails.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Reference pools ──────────────────────────────────────────────────────────
const FIRST_NAMES = ['Max','Charles','Lewis','Lando','George','Carlos','Fernando','Oscar','Sergio','Pierre','Esteban','Yuki','Alex','Logan','Daniel','Valtteri','Nico','Lance','Aarav','Vivaan','Aditya','Arjun','Krishna','Ishaan','Hiroshi','Kai','Ren','Liu','Wei','Hassan','Omar','Khalid','Lucas','Mateo','Diego','Liam','Noah','Ethan','Mason','James','William','Henry','Michael','Owen','David','Joseph','Samuel','Aria','Maya','Chloe','Sophia','Olivia','Ava','Emma','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Ella'];
const LAST_NAMES = ['Verstappen','Leclerc','Hamilton','Norris','Russell','Sainz','Alonso','Piastri','Perez','Gasly','Ocon','Tsunoda','Patel','Singh','Kumar','Sharma','Reddy','Iyer','Khan','Ahmed','Smith','Johnson','Brown','Williams','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Wilson','Anderson','Thomas','Taylor','Moore','Lee','Tanaka','Suzuki','Kim','Park','Chen','Wang','Zhang','Li','Liu'];
const COUNTRIES = ['IN','US','GB','IT','DE','FR','JP','AU','BR','CA','ES','NL','AE','SG','TH','MC'];
const TIERS = ['standard','silver','gold','vip'];
const PRODUCTS = [
  { id:'RB-JKT-2024', name:'2024 Team Jacket', price:159.99, category:'Apparel', brand:'Red Bull' },
  { id:'FER-JKT-2024', name:'Scuderia Team Jacket', price:179.99, category:'Apparel', brand:'Ferrari' },
  { id:'MCL-JKT-2024', name:'Papaya Team Jacket', price:169.99, category:'Apparel', brand:'McLaren' },
  { id:'MER-PLO-2024', name:'Team Polo Shirt', price:79.99, category:'Apparel', brand:'Mercedes' },
  { id:'FER-CAP-LC16', name:'Leclerc Signature Cap', price:45.00, category:'Accessories', brand:'Ferrari' },
  { id:'RB-CAP-MV1', name:'Verstappen Cap', price:39.99, category:'Accessories', brand:'Red Bull' },
  { id:'MER-CAP-LH44', name:'Hamilton Cap', price:42.00, category:'Accessories', brand:'Mercedes' },
  { id:'MCL-CAP-LN4', name:'Norris Cap', price:38.00, category:'Accessories', brand:'McLaren' },
  { id:'MCL-MOD-38', name:'MCL38 1:18 Scale Model', price:249.99, category:'Collectibles', brand:'McLaren' },
  { id:'FER-MOD-24', name:'SF-24 1:18 Scale Model', price:289.99, category:'Collectibles', brand:'Ferrari' },
  { id:'RB-MOD-20', name:'RB20 1:18 Scale Model', price:269.99, category:'Collectibles', brand:'Red Bull' },
  { id:'TICKET-MONACO-GS', name:'Monaco GP Grandstand', price:1299.00, category:'Tickets', brand:'F1' },
  { id:'TICKET-SILV-GA', name:'Silverstone GA', price:299.00, category:'Tickets', brand:'F1' },
  { id:'EXP-PIT-LANE', name:'Pit Lane Walk', price:499.00, category:'Experiences', brand:'F1' },
  { id:'EXP-DRIVER-MG', name:'Driver Meet & Greet', price:899.00, category:'Experiences', brand:'F1' },
  { id:'PKG-PADDOCK-CLUB', name:'Paddock Club VIP Package', price:4999.00, category:'Hospitality', brand:'F1' },
];
const TEAMS = ['Red Bull Racing','Ferrari','McLaren','Mercedes','Aston Martin','Alpine','Williams'];
const CALL_REASONS = ['Order status inquiry','Shipping question','Return request','Product question','Loyalty inquiry','Race ticket question','Refund request','Account issue','Hospitality booking','Complaint','Positive feedback','Promotion question'];
const EMAIL_CAMPAIGNS = [
  { name:'Welcome Series 1', type:'welcome' },
  { name:'2024 Season Launch', type:'newsletter' },
  { name:'Monaco GP Promo', type:'promo' },
  { name:'Abandoned Cart Recovery', type:'cart_abandonment' },
  { name:'Loyalty Tier Upgrade', type:'loyalty' },
  { name:'VIP Hospitality Invite', type:'vip' },
  { name:'Birthday Discount', type:'birthday' },
  { name:'Win-back Campaign', type:'reengagement' },
  { name:'Black Friday 2024', type:'promo' },
  { name:'Race Calendar Reminder', type:'newsletter' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randN(max){ return Math.floor(Math.random()*max); }
function randBetween(min,max){ return min + Math.random()*(max-min); }
function isoDate(daysBack=365){ return new Date(Date.now()-Math.floor(Math.random()*daysBack*864e5)).toISOString(); } // full ISO w/ Z
function isoDay(daysBack=365){ return isoDate(daysBack).substring(0,10); }
function pick(arr,n){ const c=[...arr],r=[]; for(let i=0;i<Math.min(n,c.length);i++) r.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); return r; }
function hashEmail(e){ return crypto.createHash('sha256').update(e.toLowerCase().trim()).digest('hex'); }
function round2(n){ return Math.round(n*100)/100; }

// ─── Customers (200; first 120 match online emails) ──────────────────────────
const CUSTOMER_COUNT = 200, ONLINE_OVERLAP = 120;
const customers = [];
for (let i=0;i<CUSTOMER_COUNT;i++){
  const firstName=rand(FIRST_NAMES), lastName=rand(LAST_NAMES);
  const isOnlineMatch = i < ONLINE_OVERLAP;
  const tier = rand(TIERS);
  const email = isOnlineMatch
    ? `rf1-w${randN(20)}-s${randN(75)}-${tier}-${i}-${crypto.randomBytes(3).toString('hex')}@f1traffic.com`
    : `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@f1retail.com`;
  const ltv = round2(tier==='vip'?randBetween(5000,25000):tier==='gold'?randBetween(2000,8000):tier==='silver'?randBetween(500,2500):randBetween(50,800));
  customers.push({
    customerId:`CRM-${String(100000+i).padStart(8,'0')}`,
    loyaltyId:`LYL-${String(200000+i).padStart(8,'0')}`,
    email, emailHashed:hashEmail(email),
    firstName, lastName,
    dob:new Date(Date.now()-randBetween(20*365,65*365)*864e5).toISOString().substring(0,10),
    phone:`+1-555-${String(1000000+randN(9000000)).substring(0,7)}`,
    country:rand(COUNTRIES), city:['Mumbai','New York','London','Milan','Paris','Tokyo'][randN(6)],
    addressLine:`${1+randN(9999)} Racing Lane`, postalCode:String(10000+randN(90000)),
    tier, ltv, points:Math.round(ltv*0.5),
    favoriteTeam:rand(TEAMS), joinDate:isoDay(1000), lastPurchaseDate:isoDay(180),
    marketingConsent:Math.random()>0.2, emailOptIn:Math.random()>0.3, smsOptIn:Math.random()>0.5,
    isOnlineMatch
  });
}

// ─── CSV writer ───────────────────────────────────────────────────────────────
function writeCsv(filename, headers, rows){
  const file = path.join(OUTPUT_DIR, filename);
  const esc = v => { if(v===null||v===undefined) return ''; const s=String(v); return (s.includes(',')||s.includes('\n')||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s; };
  const content = [headers.join(','), ...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');
  fs.writeFileSync(file, content);
  console.log(`✓ ${rows.length.toLocaleString().padStart(6)} rows → ${filename}`);
}

// ─── 1. CRM Customer Profile (→ F1 Customer Profile dataset) ─────────────────
writeCsv('1-crm-customer-profile.csv',
  ['customerId','email','emailHashedSHA256','firstName','lastName','dateOfBirth','phone','country','city','addressLine1','postalCode','customerTier','lifetimeValue','favoriteTeam','registrationDate','lastActivityDate','marketingConsent','emailOptIn','smsOptIn'],
  customers.map(c=>({
    customerId:c.customerId, email:c.email, emailHashedSHA256:c.emailHashed,
    firstName:c.firstName, lastName:c.lastName, dateOfBirth:c.dob, phone:c.phone,
    country:c.country, city:c.city, addressLine1:c.addressLine, postalCode:c.postalCode,
    customerTier:c.tier, lifetimeValue:c.ltv, favoriteTeam:c.favoriteTeam,
    registrationDate:c.joinDate, lastActivityDate:c.lastPurchaseDate,
    marketingConsent:c.marketingConsent, emailOptIn:c.emailOptIn, smsOptIn:c.smsOptIn
  }))
);

// ─── 2. Loyalty (→ F1 Customer Profile dataset, enriches same people) ────────
writeCsv('2-loyalty-program.csv',
  ['loyaltyId','customerId','email','membershipTier','pointsBalance','pointsLifetimeEarned','membershipStartDate','nextTierThresholdPoints','isActive'],
  customers.map(c=>({
    loyaltyId:c.loyaltyId, customerId:c.customerId, email:c.email,
    membershipTier:c.tier, pointsBalance:c.points,
    pointsLifetimeEarned:Math.round(c.points*1.4),
    membershipStartDate:c.joinDate,
    nextTierThresholdPoints:c.tier==='vip'?999999:c.tier==='gold'?50000:c.tier==='silver'?15000:5000,
    isActive:Math.random()>0.05
  }))
);

// ─── 3. Offline Purchases (→ F1 Offline Events dataset) ──────────────────────
// One row per ORDER LINE. purchasesValue=1 only on line 1 (accurate order count).
const purchaseRows = [];
let orderCounter = 800000;
customers.forEach(c=>{
  const orderCount = c.tier==='vip'?8+randN(8):c.tier==='gold'?4+randN(6):c.tier==='silver'?2+randN(4):1+randN(3);
  for (let o=0;o<orderCount;o++){
    const items = pick(PRODUCTS, 1+randN(3));
    const ts = isoDate(540);
    const orderId = `OFF-${String(orderCounter).padStart(8,'0')}`;
    const channel = rand(['store-newyork','store-london','store-milan','store-mumbai','phone','catalog','popup-monaco','popup-silverstone']);
    const payment = rand(['credit_card','debit_card','cash','apple_pay','google_pay','loyalty_points']);
    const associate = rand(['SA-001','SA-042','SA-117','SA-203','SA-298','online','N/A']);
    const promo = Math.random()>0.7 ? rand(['SAVE10','GOLD15','VIP25','SUMMER20','RACE2024']) : '';
    let orderTotal = 0;
    const lines = items.map((p,idx)=>{ const qty=1+randN(2); const lineTotal=round2(p.price*qty); orderTotal=round2(orderTotal+lineTotal); return {p,qty,lineTotal,idx}; });
    lines.forEach(L=>{
      purchaseRows.push({
        eventType:'commerce.purchases',
        timestamp:ts,
        orderId, orderLineNumber:L.idx+1,
        customerId:c.customerId, loyaltyId:c.loyaltyId, email:c.email,
        channel, productId:L.p.id, productName:L.p.name, productCategory:L.p.category, productBrand:L.p.brand,
        quantity:L.qty, unitPrice:L.p.price, lineTotal:L.lineTotal, currency:'USD',
        paymentMethod:payment, salesAssociate:associate, promoCode:promo,
        purchasesValue: L.idx===0 ? 1 : 0,                 // count order once
        orderPriceTotal: L.idx===0 ? orderTotal : ''       // total on first line only
      });
    });
    orderCounter++;
  }
});
writeCsv('3-offline-purchases.csv',
  ['eventType','timestamp','orderId','orderLineNumber','customerId','loyaltyId','email','channel','productId','productName','productCategory','productBrand','quantity','unitPrice','lineTotal','currency','paymentMethod','salesAssociate','promoCode','purchasesValue','orderPriceTotal'],
  purchaseRows
);

// ─── 4. Email Engagement (→ F1 Offline Events dataset) ───────────────────────
// One row per email send. Numeric sends/opens/clicks values for direct mapping.
const emailRows = [];
let emailId = 0;
customers.forEach(c=>{
  if (!c.emailOptIn) return;
  const sendCount = 8+randN(20);
  for (let s=0;s<sendCount;s++){
    const campaign = rand(EMAIL_CAMPAIGNS);
    const ts = isoDate(180);
    const opened = Math.random()>0.55;
    const clicked = opened && Math.random()>0.7;
    const converted = clicked && Math.random()>0.6;
    emailRows.push({
      eventType:'directMarketing.emailSent',
      timestamp:ts,
      emailId:`EML-${String(++emailId).padStart(10,'0')}`,
      customerId:c.customerId, email:c.email,
      campaignName:campaign.name, campaignType:campaign.type,
      sendsValue:1, opensValue:opened?1:0, clicksValue:clicked?1:0,
      converted, conversionValue:converted?round2(randBetween(30,500)):0,
      unsubscribed:Math.random()>0.985,
      deviceType:rand(['mobile','desktop','tablet']),
      emailClient:rand(['Gmail','Outlook','Apple Mail','Yahoo','Other'])
    });
  }
});
writeCsv('4-email-engagement.csv',
  ['eventType','timestamp','emailId','customerId','email','campaignName','campaignType','sendsValue','opensValue','clicksValue','converted','conversionValue','unsubscribed','deviceType','emailClient'],
  emailRows
);

// ─── 5. Call Center (→ F1 Offline Events dataset) ────────────────────────────
const callRows = [];
let callId = 0;
customers.forEach(c=>{
  if (Math.random()>0.6) return;
  const callCount = 1+randN(5);
  for (let cc=0;cc<callCount;cc++){
    const reason = rand(CALL_REASONS);
    const ts = isoDate(180);
    const resolved = Math.random()>0.15;
    callRows.push({
      eventType:'customerService.interaction',
      timestamp:ts,
      callId:`CALL-${String(++callId).padStart(10,'0')}`,
      customerId:c.customerId, email:c.email,
      channel:rand(['phone','chat','email','whatsapp']),
      callReason:reason,
      callCategory: reason.includes('Order')||reason.includes('Shipping')?'orders':reason.includes('Loyalty')?'loyalty':reason.includes('Refund')||reason.includes('Return')?'returns':reason.includes('ticket')||reason.includes('Hospitality')?'events':'support',
      agentId:`AGT-${String(1+randN(30)).padStart(3,'0')}`,
      durationSeconds:60+randN(900),
      resolved, satisfactionRating: resolved?3+randN(3):1+randN(2),
      escalated: !resolved && Math.random()>0.6,
      followUpRequired: !resolved
    });
  }
});
writeCsv('5-call-center.csv',
  ['eventType','timestamp','callId','customerId','email','channel','callReason','callCategory','agentId','durationSeconds','resolved','satisfactionRating','escalated','followUpRequired'],
  callRows
);

// ─── Summary ──────────────────────────────────────────────────────────────────
const orderCount = new Set(purchaseRows.map(r=>r.orderId)).size;
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   OFFLINE DATA v2 (schema-aligned) GENERATED               ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║   Customers:            ${String(customers.length).padEnd(34)}║`);
console.log(`║     Online-matching:    ${String(ONLINE_OVERLAP).padEnd(34)}║`);
console.log(`║   Distinct orders:      ${String(orderCount).padEnd(34)}║`);
console.log(`║   Purchase line rows:   ${String(purchaseRows.length).padEnd(34)}║`);
console.log(`║   Email rows:           ${String(emailRows.length).padEnd(34)}║`);
console.log(`║   Call rows:            ${String(callRows.length).padEnd(34)}║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\nFiles in: ${OUTPUT_DIR}`);
console.log('Email custom fields map to: _tenant.F1emailEngagement.*');
console.log('Purchases: purchasesValue=1 on first line only (accurate order count)\n');
