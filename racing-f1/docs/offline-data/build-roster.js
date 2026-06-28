// Extract the 120 online-matchable customers (@f1traffic.com) from the CRM CSV
// into a roster the web traffic generator logs in as — so online identityMap.Email
// exactly matches offline data, enabling the CJA online↔offline merge.
const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.join(__dirname,'data','1-crm-customer-profile.csv'),'utf8').trim().split(/\r?\n/);
const H = lines[0].split(',');
const idx = n => H.indexOf(n);
const roster = lines.slice(1).map(l=>{
  const c=l.split(',');
  return {
    email:c[idx('email')], firstName:c[idx('firstName')], lastName:c[idx('lastName')],
    customerTier:c[idx('customerTier')], favoriteTeam:c[idx('favoriteTeam')], country:c[idx('country')],
    profileID:c[idx('email')].split('@')[0]   // rf1-w..-..  (matches gridbox user_id convention)
  };
}).filter(r=>r.email.endsWith('@f1traffic.com'));
fs.writeFileSync(path.join(__dirname,'online-roster.json'), JSON.stringify(roster,null,2));
const byTier={}; roster.forEach(r=>byTier[r.customerTier]=(byTier[r.customerTier]||0)+1);
console.log(`Roster: ${roster.length} online-matchable customers`);
console.log('Tier mix:', byTier);
console.log('Sample:', roster[0]);
