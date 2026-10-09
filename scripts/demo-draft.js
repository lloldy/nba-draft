// Plays a complete draft in the console. Usage: npm run demo -- --seed 42

import { loadPlayers } from '../src/core/data.js';
import { createDraft, pick, skipTeam, skipEra, swapSlots, undoLastPick, isComplete, teamRating } from '../src/core/draft.js';
import { POSITIONS } from '../src/core/config.js';
import { effectiveRating } from '../src/core/positions.js';

const arg = process.argv.indexOf('--seed');
const seed = arg > -1 ? Number(process.argv[arg + 1]) : 42;
const { players, byId, meta } = await loadPlayers('public/data/players.json');
console.log(`Data: ${meta.source} (${players.length} players) | seed ${seed}\n`);

let s = createDraft({ seed, players });
let round = 0;
while (!isComplete(s)) {
  round++;
  const free = POSITIONS.filter((p) => !s.slots[p]);
  // Demo strategy: skip the first board once, then take the best player for any free slot.
  if (round === 1 && s.skips.team > 0) {
    console.log(`Round ${round}: ${s.current.franchise} ${s.current.decade}s -> skip team`);
    s = skipTeam(s);
  }
  let best = null;
  for (const p of s.current.players) for (const slot of free) {
    const r = effectiveRating(p, slot);
    if (!best || r > best.r) best = { p, slot, r };
  }
  console.log(`Round ${round}: ${s.current.franchise} ${s.current.decade}s -> ${best.p.name} @ ${best.slot} (${best.r})`);
  s = pick(s, best.p.id, best.slot);
  if (round === 2) { s = undoLastPick(s); console.log('  (undo last pick)'); }
}
console.log('\nLineup:');
for (const slot of POSITIONS) console.log(`  ${slot}: ${byId.get(s.slots[slot]).name}`);
s = swapSlots(s, 'PG', 'C');
console.log('\nAfter swapping PG <-> C:', teamRating(s));
