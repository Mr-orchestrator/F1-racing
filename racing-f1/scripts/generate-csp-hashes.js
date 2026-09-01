/**
 * CSP Hash Generator for Racing F1 static site
 * Extracts all inline <script> content from HTML files,
 * computes SHA-256 hashes, and outputs the CSP script-src value.
 *
 * Run: node scripts/generate-csp-hashes.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// HTML files to scan (the 15 site pages — exclude node_modules, tests, reports)
const HTML_FILES = [
  'index.html', 'tickets.html', 'merchandise.html', 'checkout.html',
  'cart.html', 'confirmation.html', 'experiences.html', 'calendar.html',
  'login.html', 'register.html', 'teams.html', 'booking-spa.html',
  'privacy.html', 'support.html', 'terms.html'
];

function sha256Base64(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('base64');
}

// Extract text content of all inline <script> tags (no src attribute)
function extractInlineScripts(html) {
  const scripts = [];
  // Match <script> blocks without a src= attribute
  const regex = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1];
    if (content.trim()) scripts.push(content);
  }
  return scripts;
}

const hashMap = new Map(); // hash → Set of file:line occurrences
const contentMap = new Map(); // hash → script content (first seen)

for (const file of HTML_FILES) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) { console.warn(`  MISSING: ${file}`); continue; }

  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = extractInlineScripts(html);

  for (const script of scripts) {
    const hash = sha256Base64(script);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, new Set());
      contentMap.set(hash, script);
    }
    hashMap.get(hash).add(file);
  }
}

console.log('\n========================================');
console.log('  CSP SHA-256 HASHES FOR INLINE SCRIPTS');
console.log('========================================\n');

const hashEntries = [];
for (const [hash, files] of hashMap.entries()) {
  const content = contentMap.get(hash);
  const preview = content.trim().slice(0, 80).replace(/\s+/g, ' ');
  console.log(`Hash:    'sha256-${hash}'`);
  console.log(`Preview: ${preview}...`);
  console.log(`Files:   ${[...files].join(', ')}`);
  console.log('');
  hashEntries.push(`'sha256-${hash}'`);
}

console.log('========================================');
console.log('CSP script-src value (copy into vercel.json):');
console.log('========================================\n');

const csp = [
  "'self'",
  ...hashEntries,
  "'strict-dynamic'",
  "'unsafe-inline'",          // ignored by modern browsers when nonce/hash present; fallback for old browsers
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://assets.adobedtm.com",
  "https://tags.tiqcdn.com",
  "https://*.tiqcdn.com",
  "https://cdn.jsdelivr.net"
].join(' ');

console.log(`script-src ${csp}`);
console.log('');
console.log('Full CSP header value:');
console.log(`default-src 'self'; script-src ${csp}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://assets.adobedtm.com https://*.adobedc.net https://*.demdex.net https://*.omtrdc.net https://tags.tiqcdn.com https://*.tiqcdn.com https://collect.tealiumiq.com https://*.tealiumiq.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'none'; frame-src https://www.googletagmanager.com https://*.demdex.net; report-uri /api/csp-report;`);
