// Generates a SYNTHETIC players.json for development (fake names, random stats).
// Replace it with real data via data-pipeline/build_players.py.
// Usage: npm run sample

import fs from 'node:fs';
import { createRng } from '../src/core/seed.js';
import { DECADES, POSITIONS } from '../src/core/config.js';

const franchises = Object.keys(JSON.parse(fs.readFileSync('public/data/franchises.json', 'utf8')));
const rng = createRng(1234);
const players = [];

for (const f of franchises) {
  for (const decade of DECADES) {
    if (f === 'TOR' && decade < 1990) continue;
    for (let i = 0; i < 5; i++) {
      const pos = rng.pick(POSITIONS);
      const alt = rng.next() < 0.5 ? [POSITIONS[(POSITIONS.indexOf(pos) + (rng.next() < 0.5 ? 1 : 4)) % 5]] : [];
      players.push({
        id: `${f}-${decade}-${i}`,
        name: `Sample ${f} ${decade}s #${i + 1}`,
        franchise: f,
        decade,
        pos: [pos],
        altPos: alt,
        ppg: Math.round((6 + rng.next() * 24) * 10) / 10,
        rpg: Math.round((2 + rng.next() * 10) * 10) / 10,
        apg: Math.round((1 + rng.next() * 9) * 10) / 10,
        spg: Math.round(rng.next() * 25) / 10,
        bpg: Math.round(rng.next() * 30) / 10,
        fans: rng.int(1, 100),
        rating: rng.int(55, 99),
        tags: [],
      });
    }
  }
}

fs.writeFileSync(
  'public/data/players.json',
  JSON.stringify({ meta: { source: 'SYNTHETIC SAMPLE', generated: new Date().toISOString(), version: 0 }, players }, null, 1),
);
console.log(`Wrote ${players.length} synthetic players`);
