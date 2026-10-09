// Run history helpers (pure). The UI persists the array in localStorage.
import { PLAYOFFS } from './config.js';

export const PO_LABELS = ['Playoffs verpasst', ...PLAYOFFS.rounds.map((r) => `Aus in: ${r}`), 'Champion'];

// 0 = missed playoffs, 1..4 = lost in round 1..4, 5 = champion.
export function playoffScore({ qualified, po }) {
  if (!qualified) return 0;
  if (!po || !po.over) return 1;
  return po.over === 'champion' ? 5 : po.results.at(-1).round + 1;
}

export const runScore = (run) => run.wins * 10 + run.po;

export const addRun = (runs, run, max = 200) => [run, ...runs].slice(0, max);

export const leaderboard = (runs, n = 10) =>
  [...runs].sort((a, b) => runScore(b) - runScore(a) || b.at - a.at).slice(0, n);

export function summarize(runs) {
  return {
    runs: runs.length,
    titles: runs.filter((r) => r.po === 5).length,
    perfect: runs.filter((r) => r.losses === 0).length,
    bestWins: runs.reduce((m, r) => Math.max(m, r.wins), 0),
    avgWins: runs.length ? Math.round((runs.reduce((s, r) => s + r.wins, 0) / runs.length) * 10) / 10 : 0,
  };
}
