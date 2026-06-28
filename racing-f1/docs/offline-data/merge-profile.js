// Merge CRM + Loyalty into ONE row per customer for a clean CJA Lookup dataset.
// Output: data/6-customer-lookup.csv  (key = email, one row per customer)
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');

function parseCsv(file) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8').trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // simple split is safe here: these columns contain no embedded commas
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const crm = parseCsv('1-crm-customer-profile.csv');
const loyalty = parseCsv('2-loyalty-program.csv');

// index loyalty by customerId
const loyaltyById = {};
loyalty.forEach(l => { loyaltyById[l.customerId] = l; });

const outHeaders = [
  'email',            // <-- lookup KEY (matches offline events customerEmail)
  'customerId',
  'firstName', 'lastName', 'country', 'city',
  'customerTier', 'lifetimeValue', 'favoriteTeam',
  'marketingConsent', 'emailOptIn', 'smsOptIn',
  'loyaltyId', 'membershipTier', 'pointsBalance',
  'pointsLifetimeEarned', 'nextTierThresholdPoints', 'isActive'
];

const rows = crm.map(c => {
  const l = loyaltyById[c.customerId] || {};
  return [
    c.email,
    c.customerId,
    c.firstName, c.lastName, c.country, c.city,
    c.customerTier, c.lifetimeValue, c.favoriteTeam,
    c.marketingConsent, c.emailOptIn, c.smsOptIn,
    l.loyaltyId || '', l.membershipTier || '', l.pointsBalance || '',
    l.pointsLifetimeEarned || '', l.nextTierThresholdPoints || '', l.isActive || ''
  ].join(',');
});

const out = [outHeaders.join(','), ...rows].join('\n');
fs.writeFileSync(path.join(DIR, '6-customer-lookup.csv'), out);

// sanity: unique emails
const emails = new Set(crm.map(c => c.email));
console.log(`CRM rows:      ${crm.length}`);
console.log(`Loyalty rows:  ${loyalty.length}`);
console.log(`Merged rows:   ${rows.length}  (one per customer)`);
console.log(`Unique emails: ${emails.size}  ${emails.size === rows.length ? '✓ key is unique' : '✗ DUPLICATE EMAILS'}`);
console.log(`Output: data/6-customer-lookup.csv`);
