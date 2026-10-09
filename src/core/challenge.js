// Friend challenge: seed + rule + your record live in the URL hash, no backend needed.
import { runScore } from './stats.js';

export function encodeChallenge({ seed, era, rule, by, wins, po }) {
  const p = new URLSearchParams({ seed: String(seed) });
  if (era) p.set('era', era);
  if (rule) p.set('rule', rule);
  if (by) p.set('by', by.slice(0, 20));
  if (wins != null) { p.set('rw', wins); p.set('rp', po ?? 0); }
  return p.toString();
}

// Returns null when the hash is not a challenge (e.g. "#/franchise/LAL" or empty).
export function parseChallenge(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const seed = Number(p.get('seed'));
  if (!seed) return null;
  return {
    seed,
    era: Number(p.get('era')) || null,
    rule: p.get('rule') || null,
    by: p.get('by') || null,
    record: p.has('rw') ? { wins: Number(p.get('rw')), po: Number(p.get('rp')) || 0 } : null,
  };
}

// 'win' | 'tie' | 'lose' for your run vs. the friend's record.
export function compareToRecord(run, record) {
  const diff = runScore(run) - runScore(record);
  return diff > 0 ? 'win' : diff === 0 ? 'tie' : 'lose';
}
