'use strict';

// ─── F1 Racing Store — MCP Catalog Data ──────────────────────────────────────
// Single source of truth for all MCP tool responses.
// Extracted from app.js, bulk-traffic-generator.spec.js, and site HTML.
// ─────────────────────────────────────────────────────────────────────────────

const TICKETS = [
  // Monaco Grand Prix
  { race: 'Monaco Grand Prix', location: 'Monaco', date: '2026-05-24', circuit: 'Circuit de Monaco',
    category: 'General Admission', price: 450,  currency: 'USD', available: true,
    description: 'Standing access to all General Admission zones around the circuit.' },
  { race: 'Monaco Grand Prix', location: 'Monaco', date: '2026-05-24', circuit: 'Circuit de Monaco',
    category: 'Grandstand',       price: 890,  currency: 'USD', available: true,
    description: 'Reserved grandstand seat with unobstructed circuit view.' },
  { race: 'Monaco Grand Prix', location: 'Monaco', date: '2026-05-24', circuit: 'Circuit de Monaco',
    category: 'VIP Paddock',      price: 2499, currency: 'USD', available: true,
    description: 'Paddock Club access — exclusive hospitality suite, gourmet dining, pit lane view.' },
  { race: 'Monaco Grand Prix', location: 'Monaco', date: '2026-05-24', circuit: 'Circuit de Monaco',
    category: 'Pit Lane',         price: 3999, currency: 'USD', available: false,
    description: 'Pit lane walk + grid access. Extremely limited.' },

  // British Grand Prix
  { race: 'British Grand Prix', location: 'Silverstone', date: '2026-07-06', circuit: 'Silverstone Circuit',
    category: 'General Admission', price: 299,  currency: 'USD', available: true,
    description: 'Access to all General Admission areas at Silverstone.' },
  { race: 'British Grand Prix', location: 'Silverstone', date: '2026-07-06', circuit: 'Silverstone Circuit',
    category: 'Grandstand',       price: 599,  currency: 'USD', available: true,
    description: 'Reserved seat in Club or Brooklands grandstand.' },
  { race: 'British Grand Prix', location: 'Silverstone', date: '2026-07-06', circuit: 'Silverstone Circuit',
    category: 'VIP Paddock',      price: 1899, currency: 'USD', available: true,
    description: 'Wing Hospitality Suite with paddock access and 3-course dining.' },

  // Italian Grand Prix
  { race: 'Italian Grand Prix', location: 'Monza', date: '2026-09-07', circuit: 'Autodromo Nazionale Monza',
    category: 'General Admission', price: 199,  currency: 'USD', available: true,
    description: 'Iconic Monza park access — multiple viewing zones.' },
  { race: 'Italian Grand Prix', location: 'Monza', date: '2026-09-07', circuit: 'Autodromo Nazionale Monza',
    category: 'Grandstand',       price: 449,  currency: 'USD', available: true,
    description: 'Reserved seat — Prima Variante or Curva Grande grandstand.' },
  { race: 'Italian Grand Prix', location: 'Monza', date: '2026-09-07', circuit: 'Autodromo Nazionale Monza',
    category: 'VIP Paddock',      price: 1599, currency: 'USD', available: true,
    description: 'Paddock Club hospitality with Monza garden terrace.' },

  // Japanese Grand Prix
  { race: 'Japanese Grand Prix', location: 'Suzuka', date: '2026-04-05', circuit: 'Suzuka International Racing Course',
    category: 'General Admission', price: 249,  currency: 'USD', available: true,
    description: 'Suzuka circuit park access, multiple fan zones.' },
  { race: 'Japanese Grand Prix', location: 'Suzuka', date: '2026-04-05', circuit: 'Suzuka International Racing Course',
    category: 'Grandstand',       price: 549,  currency: 'USD', available: true,
    description: 'Reserved seat in Dunlop or 130R grandstand.' },

  // Singapore Grand Prix
  { race: 'Singapore Grand Prix', location: 'Singapore', date: '2026-09-21', circuit: 'Marina Bay Street Circuit',
    category: 'General Admission', price: 349,  currency: 'USD', available: true,
    description: 'Night race under the lights — street circuit GA zones.' },
  { race: 'Singapore Grand Prix', location: 'Singapore', date: '2026-09-21', circuit: 'Marina Bay Street Circuit',
    category: 'Grandstand',       price: 749,  currency: 'USD', available: true,
    description: 'Reserved grandstand seat with bay waterfront view.' },
  { race: 'Singapore Grand Prix', location: 'Singapore', date: '2026-09-21', circuit: 'Marina Bay Street Circuit',
    category: 'VIP Paddock',      price: 2199, currency: 'USD', available: true,
    description: 'Premium Paddock Club — Marina Bay skyline views, fine dining.' },

  // Abu Dhabi Grand Prix
  { race: 'Abu Dhabi Grand Prix', location: 'Abu Dhabi', date: '2026-12-13', circuit: 'Yas Marina Circuit',
    category: 'General Admission', price: 299,  currency: 'USD', available: true,
    description: 'Yas Marina circuit GA — sunset into night race format.' },
  { race: 'Abu Dhabi Grand Prix', location: 'Abu Dhabi', date: '2026-12-13', circuit: 'Yas Marina Circuit',
    category: 'Grandstand',       price: 649,  currency: 'USD', available: true,
    description: 'Reserved seat — Main or North grandstand.' },
  { race: 'Abu Dhabi Grand Prix', location: 'Abu Dhabi', date: '2026-12-13', circuit: 'Yas Marina Circuit',
    category: 'VIP Paddock',      price: 2299, currency: 'USD', available: true,
    description: 'Yas Paddock Club — season finale with yacht marina backdrop.' },
];

const MERCHANDISE = [
  // Apparel
  { id: 'RB-JKT-2024',  name: '2024 Team Jacket',     team: 'Red Bull Racing', category: 'Apparel',      price: 159.99, currency: 'USD', inStock: true,  brand: 'Red Bull',  description: 'Official Red Bull Racing team jacket, slim fit, water-resistant.' },
  { id: 'FER-JKT-2024', name: 'Scuderia Team Jacket', team: 'Ferrari',         category: 'Apparel',      price: 179.99, currency: 'USD', inStock: true,  brand: 'Ferrari',   description: 'Official Scuderia Ferrari team jacket with iconic Prancing Horse badge.' },
  { id: 'MCL-JKT-2024', name: 'Papaya Team Jacket',   team: 'McLaren',         category: 'Apparel',      price: 169.99, currency: 'USD', inStock: true,  brand: 'McLaren',   description: 'McLaren papaya orange team jacket — 2024 championship edition.' },
  { id: 'MER-PLO-2024', name: 'Team Polo Shirt',      team: 'Mercedes',        category: 'Apparel',      price: 79.99,  currency: 'USD', inStock: true,  brand: 'Mercedes',  description: 'Mercedes-AMG F1 team polo, moisture-wicking performance fabric.' },

  // Accessories
  { id: 'FER-CAP-LC16', name: 'Leclerc Signature Cap',  team: 'Ferrari',   category: 'Accessories', price: 45.00,  currency: 'USD', inStock: true,  brand: 'Ferrari',   description: 'Charles Leclerc #16 signature series cap, adjustable fit.' },
  { id: 'RB-CAP-MV1',   name: 'Verstappen Cap',         team: 'Red Bull',  category: 'Accessories', price: 39.99,  currency: 'USD', inStock: true,  brand: 'Red Bull',  description: 'Max Verstappen #1 World Champion cap, snapback.' },
  { id: 'MER-CAP-LH44', name: 'Hamilton Cap',           team: 'Mercedes',  category: 'Accessories', price: 42.00,  currency: 'USD', inStock: true,  brand: 'Mercedes',  description: 'Lewis Hamilton 44 legacy edition cap.' },
  { id: 'MCL-CAP-LN4',  name: 'Norris Cap',             team: 'McLaren',   category: 'Accessories', price: 38.00,  currency: 'USD', inStock: true,  brand: 'McLaren',   description: 'Lando Norris #4 papaya cap, embroidered logo.' },

  // Collectibles
  { id: 'MCL-MOD-38',  name: 'MCL38 1:18 Scale Model',  team: 'McLaren',  category: 'Collectibles', price: 249.99, currency: 'USD', inStock: true,  brand: 'McLaren',   description: 'Die-cast 1:18 scale replica of the 2024 McLaren MCL38. Limited edition.' },
  { id: 'FER-MOD-24',  name: 'SF-24 1:18 Scale Model',  team: 'Ferrari',  category: 'Collectibles', price: 289.99, currency: 'USD', inStock: true,  brand: 'Ferrari',   description: 'Official Ferrari SF-24 die-cast model, collector quality.' },
  { id: 'RB-MOD-20',   name: 'RB20 1:18 Scale Model',   team: 'Red Bull', category: 'Collectibles', price: 269.99, currency: 'USD', inStock: true,  brand: 'Red Bull',  description: 'Red Bull RB20 championship edition die-cast model.' },
  { id: 'MER-MOD-W15', name: 'W15 1:18 Scale Model',    team: 'Mercedes', category: 'Collectibles', price: 259.99, currency: 'USD', inStock: false, brand: 'Mercedes',  description: 'Mercedes W15 1:18 scale — currently out of stock, back-order available.' },
];

const RACES = [
  { name: 'Japanese Grand Prix',  location: 'Suzuka',      country: 'Japan',        date: '2026-04-05', circuit: 'Suzuka International Racing Course', laps: 53 },
  { name: 'Monaco Grand Prix',    location: 'Monaco',      country: 'Monaco',       date: '2026-05-24', circuit: 'Circuit de Monaco',                  laps: 78 },
  { name: 'British Grand Prix',   location: 'Silverstone', country: 'UK',           date: '2026-07-06', circuit: 'Silverstone Circuit',                laps: 52 },
  { name: 'Italian Grand Prix',   location: 'Monza',       country: 'Italy',        date: '2026-09-07', circuit: 'Autodromo Nazionale Monza',          laps: 53 },
  { name: 'Singapore Grand Prix', location: 'Singapore',   country: 'Singapore',    date: '2026-09-21', circuit: 'Marina Bay Street Circuit',          laps: 62 },
  { name: 'Abu Dhabi Grand Prix', location: 'Abu Dhabi',   country: 'UAE',          date: '2026-12-13', circuit: 'Yas Marina Circuit',                 laps: 58 },
];

const EXPERIENCES = [
  // Hospitality
  { name: 'Champions Club',          type: 'Hospitality',  price: 2499, currency: 'USD', available: true,
    description: 'Premium hospitality suite at the circuit. 3-course gourmet lunch, open bar, paddock views, team presentations and grid walk access.',
    includes: ['Paddock access', 'Gourmet 3-course meal', 'Open bar', 'Team presentations', 'Grid walk'] },
  { name: 'Paddock Lounge',          type: 'Hospitality',  price: 1699, currency: 'USD', available: true,
    description: 'Semi-private hospitality lounge with paddock-facing terrace, buffet dining, and driver sighting opportunities.',
    includes: ['Paddock terrace access', 'Buffet dining', 'Complimentary drinks', 'Driver sightings'] },
  { name: 'Monaco Exclusive Suite',  type: 'Hospitality',  price: 4999, currency: 'USD', available: false,
    description: 'Private yacht suite in Monaco harbour with front-row circuit views. Most exclusive package — extremely limited.',
    includes: ['Private yacht berth', 'Michelin-star catering', 'VIP transfer', 'Paddock passes'] },

  // Track Access
  { name: 'Pit Lane Walk',           type: 'Track Access', price: 499,  currency: 'USD', available: true,
    description: 'Exclusive guided walk through the F1 pit lane before race day. Get up close to the cars and garages.',
    includes: ['Guided pit lane tour', 'Photo opportunities', 'Technical briefing', 'Exclusive access pass'] },
  { name: 'Grid Access Pass',        type: 'Track Access', price: 899,  currency: 'USD', available: true,
    description: 'Stand on the starting grid before the formation lap. Witness the pre-race atmosphere from inside the action.',
    includes: ['Grid standing access', 'National anthem on grid', 'Formation lap viewing', 'Podium area access'] },
  { name: 'Factory Tour',            type: 'Track Access', price: 299,  currency: 'USD', available: true,
    description: 'Behind-the-scenes tour of an F1 team factory. See car manufacturing, simulators, and trophy rooms.',
    includes: ['Factory floor tour', 'Simulator viewing', 'Engineering briefing', 'Team merchandise discount'] },

  // Exclusive
  { name: 'Driver Meet & Greet',     type: 'Exclusive',    price: 1299, currency: 'USD', available: true,
    description: 'Private meet and greet session with an F1 driver. Autographed merchandise included. Limited to 10 guests.',
    includes: ['Private driver session', 'Autographed helmet', 'Photo opportunity', 'Q&A session'] },
  { name: 'Simulator Session',       type: 'Exclusive',    price: 349,  currency: 'USD', available: true,
    description: 'Drive an F1 simulator used by real teams. 45-minute coached session with a race engineer.',
    includes: ['45-min simulator time', 'Race engineer coaching', 'Lap time certificate', 'Video recording'] },
];

module.exports = { TICKETS, MERCHANDISE, RACES, EXPERIENCES };
