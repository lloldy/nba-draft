// Shows how often boards come up in the first 5 spins, with the current SPIN config.
import { loadPlayers } from '../src/core/data.js';
import { createDraft, spin } from '../src/core/draft.js';
import { SPIN } from '../src/core/config.js';
for (const kv of (process.env.BAL ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); SPIN[k] = Number(v); }
const { players } = await loadPlayers('public/data/players.json');
const N = 3000, count = {}, byDec = {};
for (let seed = 1; seed <= N; seed++) {
  let s = createDraft({ seed, players });
  for (let i = 0; i < 5; i++) {
    const k = `${s.current.franchise} ${s.current.decade}`;
    count[k] = (count[k] ?? 0) + 1;
    byDec[s.current.decade] = (byDec[s.current.decade] ?? 0) + 1;
    s = spin(s);
  }
}
const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
const share = (n) => ((n / (N * 5)) * 100).toFixed(1) + '%';
console.log('most frequent:', top.slice(0, 8).map(([k, n]) => `${k} ${share(n)}`).join(' | '));
console.log('rarest seen:  ', top.slice(-5).map(([k, n]) => `${k} ${share(n)}`).join(' | '));
console.log('by decade:    ', Object.entries(byDec).map(([d, n]) => `${d} ${share(n)}`).join(' | '));
