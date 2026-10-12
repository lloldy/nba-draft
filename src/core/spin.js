// Weighted spin order: strong and famous boards (franchise + decade) come up more often.
// Deterministic: the order depends only on the seed and the pool, so friends see the same boards.

import { SPIN } from './config.js';

// How attractive a board is: its best players' ratings plus a share of their fame (fans value).
export function boardValue(players) {
  const top = [...players].sort((a, b) => b.rating - a.rating).slice(0, SPIN.topN);
  const avg = (key) => top.reduce((s, p) => s + p[key], 0) / top.length;
  return avg('rating') + SPIN.fameWeight * avg('fans');
}

// pool: Map "FRA|decade" -> players. Returns { key: weight } (average board has weight ~1).
export function boardWeights(pool) {
  const values = new Map([...pool].map(([k, list]) => [k, boardValue(list)]));
  const mean = [...values.values()].reduce((a, b) => a + b, 0) / values.size;
  return new Map([...values].map(([k, v]) => [k, Math.exp((v - mean) / SPIN.temperature)]));
}

// Weighted shuffle without replacement (Efraimidis-Spirakis): sort by u^(1/w), highest first.
export function weightedOrder(keys, weights, rng) {
  return keys
    .map((k) => ({ k, score: Math.log(Math.max(rng.next(), 1e-12)) / weights.get(k) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.k);
}
