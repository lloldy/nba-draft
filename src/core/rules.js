// Special rules for the daily challenge (also usable in friend challenges).
// Three kinds: draft constraints (change which players can appear),
// season objectives (checked after the run) and a locked legend.

import { createRng, hashString } from './seed.js';

const sumBy = (lineup, key) => lineup.reduce((s, l) => s + (l.player?.[key] ?? 0), 0);

// check(ctx): ctx = { wins, streak, lineup: [{ slot, player }], chem }
export const RULES = [
  // --- draft constraints ---
  { id: 'only90s', type: 'constraint', label: 'Nur 90er', desc: 'Es erscheinen nur Spieler der 1990er.', constraints: { decades: [1990] } },
  { id: 'only00s', type: 'constraint', label: 'Nur 2000er', desc: 'Es erscheinen nur Spieler der 2000er.', constraints: { decades: [2000] } },
  { id: 'pre90', type: 'constraint', label: 'Vor 1990', desc: 'Nur 1960er, 1970er und 1980er.', constraints: { decades: [1960, 1970, 1980] } },
  { id: 'modern', type: 'constraint', label: '2010er/2020er', desc: 'Nur die modernen Jahrzehnte.', constraints: { decades: [2010, 2020] } },
  { id: 'nolakceltics', type: 'constraint', label: 'Keine Lakers/Celtics', desc: 'Beide Franchises sind gesperrt.', constraints: { excludeFranchises: ['LAL', 'BOS'] } },
  { id: 'fans300', type: 'constraint', label: 'Fans-Summe unter 300', desc: 'Die Fans-Werte deines Fünfers müssen zusammen unter 300 bleiben.',
    check: (c) => sumBy(c.lineup, 'fans') < 300 },
  // --- season objectives ---
  { id: 'wins65', type: 'objective', label: '65 Siege', desc: 'Gewinne mindestens 65 Spiele.', check: (c) => c.wins >= 65 },
  { id: 'wins70', type: 'objective', label: '70 Siege', desc: 'Gewinne mindestens 70 Spiele.', check: (c) => c.wins >= 70 },
  { id: 'scorer30', type: 'objective', label: '30-Punkte-Starter', desc: 'Ein Starter mit mindestens 30 PPG.', check: (c) => c.lineup.some((l) => (l.player?.ppg ?? 0) >= 30) },
  { id: 'blocks8', type: 'objective', label: '8+ Blocks', desc: 'Dein Team kommt zusammen auf 8 oder mehr Blocks pro Spiel.', check: (c) => sumBy(c.lineup, 'bpg') >= 8 },
  { id: 'perfectchem', type: 'objective', label: 'Perfect Chemistry', desc: 'Erreiche „Perfect Team Chemistry“.', check: (c) => c.chem.perfect },
  { id: 'streak20', type: 'objective', label: '20er-Siegesserie', desc: 'Gewinne 20 Spiele in Folge.', check: (c) => c.streak >= 20 },
  // --- locked legend ---
  { id: 'legend', type: 'legend', label: 'Locked Legend', desc: 'Ein Star ist bereits auf seiner Position gesetzt.' },
];

export const ruleById = (id) => RULES.find((r) => r.id === id) ?? null;

export function dailyRule(dateStr) {
  return createRng(hashString(`${dateStr}:rule`)).pick(RULES);
}

// Draft constraints for createDraft(). A rule's decades beat the era-mode setting.
export function constraintsFor(rule, era = null) {
  const c = { ...(rule?.constraints ?? {}) };
  if (era && !c.decades) c.decades = [era];
  return c;
}

// The legend: one of the best-rated players, chosen by seed, placed on his main position.
export function pickLegend(players, seed) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  const top = sorted.slice(0, Math.max(5, Math.round(players.length * 0.02)));
  const p = createRng(seed ^ 0x1e6e4d).pick(top);
  return { slot: p.pos[0], playerId: p.id };
}

// true / false; rules without a check (constraints, legend) always pass.
export const checkRule = (rule, ctx) => (rule?.check ? !!rule.check(ctx) : true);
