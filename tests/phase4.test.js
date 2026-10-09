import { describe, it, expect } from 'vitest';
import { RULES, ruleById, dailyRule, constraintsFor, pickLegend, checkRule } from '../src/core/rules.js';
import { dailyInfo, prevDate, emptyDaily, startAttempt, finishAttempt, currentStreak, hasPlayed } from '../src/core/daily.js';
import { playoffScore, runScore, addRun, leaderboard, summarize } from '../src/core/stats.js';
import { encodeChallenge, parseChallenge, compareToRecord } from '../src/core/challenge.js';
import { franchisePage, eraPage, topPlayers } from '../src/core/browse.js';
import { createDraft, pick, isComplete } from '../src/core/draft.js';
import { dailySeed } from '../src/core/seed.js';
import { POSITIONS } from '../src/core/config.js';

const mk = (id, name, franchise, decade, pos, rating, extra = {}) => ({ id, name, franchise, decade, pos: [pos], altPos: [], rating, fans: 50, ...extra });
const pool = [];
for (const f of ['AAA', 'BBB', 'CCC', 'DDD']) for (const d of [1980, 1990, 2000, 2010]) for (let i = 0; i < 3; i++) pool.push(mk(`${f}${d}${i}`, `${f}${d}${i}`, f, d, POSITIONS[i], 60 + i * 10));

describe('rules', () => {
  it('has 13 rules of three kinds', () => {
    expect(RULES).toHaveLength(13);
    expect(new Set(RULES.map((r) => r.type))).toEqual(new Set(['constraint', 'objective', 'legend']));
  });

  it('daily rule and seed depend only on the date', () => {
    expect(dailyRule('2026-10-09')).toBe(dailyRule('2026-10-09'));
    expect(dailyInfo('2026-10-09').seed).toBe(dailySeed(new Date('2026-10-09T12:00:00Z')));
    const seen = new Set();
    for (let d = 1; d <= 28; d++) seen.add(dailyRule(`2026-02-${String(d).padStart(2, '0')}`).id);
    expect(seen.size).toBeGreaterThan(5);
  });

  it('constraints are applied to the draft pool', () => {
    const rule = ruleById('nolakceltics');
    expect(constraintsFor(rule)).toEqual({ excludeFranchises: ['LAL', 'BOS'] });
    expect(constraintsFor(ruleById('only90s'), 2000).decades).toEqual([1990]);
    expect(constraintsFor(null, 2000).decades).toEqual([2000]);
  });

  it('objectives are evaluated', () => {
    const lineup = [{ player: { ppg: 31, bpg: 3, fans: 70 } }, { player: { ppg: 10, bpg: 5.5, fans: 80 } }];
    const ctx = { wins: 66, streak: 21, lineup, chem: { perfect: false } };
    expect(checkRule(ruleById('wins65'), ctx)).toBe(true);
    expect(checkRule(ruleById('wins70'), ctx)).toBe(false);
    expect(checkRule(ruleById('scorer30'), ctx)).toBe(true);
    expect(checkRule(ruleById('blocks8'), ctx)).toBe(true);
    expect(checkRule(ruleById('streak20'), ctx)).toBe(true);
    expect(checkRule(ruleById('perfectchem'), ctx)).toBe(false);
    expect(checkRule(ruleById('fans300'), ctx)).toBe(true);
    expect(checkRule(ruleById('fans300'), { ...ctx, lineup: [{ player: { fans: 150 } }, { player: { fans: 150 } }] })).toBe(false);
    expect(checkRule(ruleById('only90s'), ctx)).toBe(true);
  });

  it('locked legend starts on the team and is never offered again', () => {
    const locked = pickLegend(pool, 5);
    expect(locked).toEqual(pickLegend(pool, 5));
    let s = createDraft({ seed: 5, players: pool, locked });
    expect(s.slots[locked.slot]).toBe(locked.playerId);
    let picks = 0;
    while (!isComplete(s)) {
      expect(s.current.players.some((p) => p.id === locked.playerId)).toBe(false);
      const slot = POSITIONS.find((x) => !s.slots[x]);
      s = pick(s, s.current.players.find((p) => !Object.values(s.slots).includes(p.id)).id, slot);
      picks++;
    }
    expect(picks).toBe(4);
  });

  it('the same person from another decade cannot be drafted twice', () => {
    const dup = [mk('a1', 'Same Guy', 'AAA', 1980, 'PG', 90), mk('a2', 'Same Guy', 'AAA', 1990, 'PG', 90), mk('b1', 'Other', 'AAA', 1980, 'SG', 80)];
    let s = createDraft({ seed: 1, players: dup });
    const first = s.current.players[0];
    s = pick(s, first.id, 'PG');
    const sameName = dup.find((p) => p.name === 'Same Guy' && p.id !== first.id);
    s = { ...s, current: { ...s.current, players: [sameName] } };
    expect(() => pick(s, sameName.id, 'SG')).toThrow(/schon in deinem Team/);
  });
});

describe('daily streak', () => {
  it('one attempt per day, streak grows on consecutive days', () => {
    expect(prevDate('2026-03-01')).toBe('2026-02-28');
    let d = emptyDaily();
    expect(hasPlayed(d, '2026-10-09')).toBe(false);
    d = startAttempt(d, '2026-10-09');
    expect(hasPlayed(d, '2026-10-09')).toBe(true);
    d = finishAttempt(d, '2026-10-09', { wins: 50 });
    expect(d.streak).toBe(1);
    d = finishAttempt(startAttempt(d, '2026-10-10'), '2026-10-10', { wins: 60 });
    expect(d.streak).toBe(2);
    expect(currentStreak(d, '2026-10-11')).toBe(2); // still alive until the day is over
    expect(currentStreak(d, '2026-10-12')).toBe(0);
    d = finishAttempt(startAttempt(d, '2026-10-13'), '2026-10-13', { wins: 40 });
    expect(d.streak).toBe(1);
    expect(d.best).toBe(2);
  });
});

describe('stats', () => {
  const po = (over, round) => ({ over, results: [{ round }] });
  it('playoff score', () => {
    expect(playoffScore({ qualified: false })).toBe(0);
    expect(playoffScore({ qualified: true, po: po('out', 0) })).toBe(1);
    expect(playoffScore({ qualified: true, po: po('out', 3) })).toBe(4);
    expect(playoffScore({ qualified: true, po: po('champion', 3) })).toBe(5);
  });

  it('leaderboard ranks wins first, then playoff result', () => {
    const runs = [
      { wins: 60, losses: 22, po: 5, at: 1 },
      { wins: 70, losses: 12, po: 1, at: 2 },
      { wins: 70, losses: 12, po: 4, at: 3 },
    ];
    expect(leaderboard(runs).map((r) => r.at)).toEqual([3, 2, 1]);
    expect(runScore(runs[0])).toBe(605);
    expect(addRun(runs, { wins: 1 }, 3)).toHaveLength(3);
    expect(summarize(runs)).toMatchObject({ runs: 3, titles: 1, bestWins: 70 });
  });
});

describe('challenge link', () => {
  it('round-trips and ignores non-challenge hashes', () => {
    const enc = encodeChallenge({ seed: 123, era: 1990, rule: 'only90s', by: 'Noah', wins: 63, po: 5 });
    expect(parseChallenge('#' + enc)).toEqual({ seed: 123, era: 1990, rule: 'only90s', by: 'Noah', iq: false, record: { wins: 63, po: 5 } });
    expect(parseChallenge('#' + encodeChallenge({ seed: 5, iq: true })).iq).toBe(true);
    expect(parseChallenge('#/franchise/LAL')).toBeNull();
    expect(parseChallenge('')).toBeNull();
    expect(parseChallenge('#seed=9').record).toBeNull();
  });

  it('compares runs against a record', () => {
    const rec = { wins: 60, po: 3 };
    expect(compareToRecord({ wins: 61, po: 0 }, rec)).toBe('win');
    expect(compareToRecord({ wins: 60, po: 3 }, rec)).toBe('tie');
    expect(compareToRecord({ wins: 60, po: 2 }, rec)).toBe('lose');
  });
});

describe('browse', () => {
  it('builds franchise and era pages', () => {
    const f = franchisePage(pool, 'AAA');
    expect(f.top).toHaveLength(5);
    expect([...f.byDecade.keys()]).toEqual([1980, 1990, 2000, 2010]);
    const e = eraPage(pool, 1990);
    expect([...e.byFranchise.keys()]).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
    expect(topPlayers(pool, (p) => p.franchise === 'BBB', 2)[0].rating).toBe(80);
  });
});
