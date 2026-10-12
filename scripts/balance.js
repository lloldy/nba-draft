// Balance check: plays many drafts with simple strategies and prints win/title distributions.
// Usage: node scripts/balance.js [runs]

import { loadPlayers } from '../src/core/data.js';
import { createDraft, pick, skipTeam, skipEra, isComplete } from '../src/core/draft.js';
import { POSITIONS, PLAYOFFS, SIM, CHEM } from '../src/core/config.js';
import { effectiveRating } from '../src/core/positions.js';
import { buildTeam } from '../src/core/team.js';
import { COACHES } from '../src/core/coaches.js';
import { simulateSeason } from '../src/core/sim.js';
import { qualifies, opponentFor, simulateSeries } from '../src/core/playoffs.js';
import { createRng } from '../src/core/seed.js';

const runs = Number(process.argv[2] ?? 2000);
// Override config for tuning, e.g. BAL="SIM.oppMean=84,SIM.scale=6,PLAYOFFS.oppBase=80;84;88;92"
for (const kv of (process.env.BAL ?? '').split(',').filter(Boolean)) {
  const [path, val] = kv.split('=');
  const [obj, key] = path.split('.');
  ({ SIM, PLAYOFFS, CHEM })[obj][key] = val.includes(';') ? val.split(';').map(Number) : Number(val);
}
const { players, byId } = await loadPlayers('public/data/players.json');
const codes = [...new Set(players.map((p) => p.franchise))];

const bestOption = (s) => {
  const free = POSITIONS.filter((p) => !s.slots[p]);
  let best = null;
  for (const p of s.current.players) for (const slot of free) {
    const r = effectiveRating(p, slot);
    if (!best || r > best.r) best = { p, slot, r };
  }
  return best;
};

// strategy: 'random' (random player and free slot), 'greedy' (best rating), 'skipper' (greedy + skips when board is weak)
function draft(seed, strategy) {
  let s = createDraft({ seed, players });
  const rng = createRng(seed + 7);
  while (!isComplete(s)) {
    if (strategy === 'skipper') {
      for (const skip of [skipTeam, skipEra]) {
        if (bestOption(s).r < 88) { try { s = skip(s); } catch { /* none left */ } }
      }
    }
    if (strategy === 'random') {
      const free = POSITIONS.filter((p) => !s.slots[p]);
      const cand = rng.pick(s.current.players);
      try { s = pick(s, cand.id, rng.pick(free)); } catch { /* duplicate name: try again */ }
    } else {
      const b = bestOption(s);
      try { s = pick(s, b.p.id, b.slot); } catch {
        // same name already on the team: take the best other player
        const free = POSITIONS.filter((p) => !s.slots[p]);
        const have = new Set(Object.values(s.slots).filter(Boolean).map((id) => byId.get(id).name));
        const others = s.current.players.filter((p) => !have.has(p.name));
        const o = others.map((p) => free.map((slot) => ({ p, slot, r: effectiveRating(p, slot) }))).flat().sort((a, c) => c.r - a.r)[0];
        s = pick(s, o.p.id, o.slot);
      }
    }
  }
  return s;
}

function play(seed, strategy) {
  const s = draft(seed, strategy);
  // best coach for this lineup
  const team = COACHES.map((c) => buildTeam({ slots: s.slots, byId, coach: c })).sort((a, b) => b.strength - a.strength)[0];
  const season = simulateSeason({ seed, rating: team.strength });
  let po = -1; // -1 = missed playoffs, 0..3 = lost in round, 4 = champion
  if (qualifies(season.wins)) {
    po = 4;
    for (let r = 0; r < 4; r++) {
      const opp = opponentFor({ seed, round: r, franchiseCodes: codes });
      if (!simulateSeries({ seed, round: r, strength: team.strength, opponent: opp }).won) { po = r; break; }
    }
  }
  return { wins: season.wins, strength: team.strength, rating: team.rating, chem: team.chem.bonus, po };
}

const pct = (n) => ((n / runs) * 100).toFixed(1).padStart(5) + ' %';
for (const strategy of ['random', 'greedy', 'skipper']) {
  const res = Array.from({ length: runs }, (_, i) => play(1000 + i, strategy));
  const wins = res.map((r) => r.wins).sort((a, b) => a - b);
  const avg = (k) => (res.reduce((s, r) => s + r[k], 0) / runs).toFixed(1);
  console.log(`\n== ${strategy} (${runs} runs) ==`);
  console.log(`avg rating ${avg('rating')} | avg chem bonus ${avg('chem')} | avg strength ${avg('strength')}`);
  console.log(`wins: median ${wins[runs >> 1]}, p10 ${wins[Math.floor(runs * 0.1)]}, p90 ${wins[Math.floor(runs * 0.9)]}, max ${wins.at(-1)}`);
  console.log(`>=60 wins ${pct(res.filter((r) => r.wins >= 60).length)} | >=70 ${pct(res.filter((r) => r.wins >= 70).length)} | >=78 ${pct(res.filter((r) => r.wins >= 78).length)} | 82-0 ${pct(res.filter((r) => r.wins === 82).length)}`);
  console.log(`missed playoffs ${pct(res.filter((r) => r.po < 0).length)} | champion ${pct(res.filter((r) => r.po === 4).length)}`);
}
