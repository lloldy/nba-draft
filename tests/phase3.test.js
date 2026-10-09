import { describe, it, expect } from 'vitest';
import { evaluateChemistry, getTags } from '../src/core/chemistry.js';
import { COACHES, coachBonus } from '../src/core/coaches.js';
import { buildTeam } from '../src/core/team.js';
import { qualifies, opponentFor, simulateSeries } from '../src/core/playoffs.js';
import { PLAYOFFS } from '../src/core/config.js';

const mk = (id, pos, stats = {}) => ({ id, name: id, franchise: 'X', decade: 1990, pos: [pos], altPos: [], rating: 80, tags: [], ...stats });
const rim = mk('rim', 'C', { bpg: 2.5 });
const shooter = mk('sh', 'SG', { ppg: 20 });
const pm = mk('pm', 'PG', { apg: 8 });
const reb = mk('reb', 'PF', { rpg: 11 });
const def = mk('def', 'SF', { spg: 2 });
const line = (arr) => ['PG', 'SG', 'SF', 'PF', 'C'].map((slot, i) => ({ slot, player: arr[i] }));

describe('chemistry', () => {
  it('derives tags from stats', () => {
    expect([...getTags(rim)]).toContain('rim_protector');
    expect(getTags(shooter).has('shooter')).toBe(true);
    expect(getTags(mk('big', 'C', { ppg: 20 })).has('shooter')).toBe(false); // bigs are not "shooters"
  });

  it('perfect chemistry when all five roles are covered by five different players', () => {
    const c = evaluateChemistry(line([pm, shooter, def, reb, rim]));
    expect(c.perfect).toBe(true);
    expect(c.name).toBe('Perfect Team Chemistry');
    expect(c.bonus).toBe(6);
  });

  it('one player cannot fill two roles', () => {
    const superstar = mk('s', 'PG', { apg: 9, ppg: 25, spg: 2 }); // playmaker + shooter + defender
    const c = evaluateChemistry(line([superstar, mk('a', 'SG'), mk('b', 'SF'), mk('c', 'PF'), mk('d', 'C')]));
    expect(c.count).toBe(1);
  });

  it('matching reassigns roles so the best split is found', () => {
    const flex = mk('flex', 'SG', { ppg: 20, spg: 2 }); // shooter OR defender
    const c = evaluateChemistry(line([pm, flex, def, mk('x', 'PF'), mk('y', 'C')]));
    expect(c.count).toBe(3); // pm=playmaker, def=defender, flex=shooter
  });

  it('off-position players do not contribute', () => {
    const onPos = evaluateChemistry(line([pm, shooter, def, reb, rim]));
    const swapped = evaluateChemistry(line([rim, shooter, def, reb, pm])); // C at PG, PG at C
    expect(swapped.count).toBeLessThan(onPos.count);
  });
});

describe('coaches + team', () => {
  it('has 6-8 coaches covering four styles', () => {
    expect(COACHES.length).toBeGreaterThanOrEqual(6);
    expect(COACHES.length).toBeLessThanOrEqual(8);
    expect(new Set(COACHES.map((c) => c.style))).toEqual(new Set(['Tempo', 'Defense', 'Shooting', 'Balance']));
  });

  it('style coach scales with matching players', () => {
    const brandt = COACHES.find((c) => c.id === 'brandt');
    const none = line([mk('a', 'PG'), mk('b', 'SG'), mk('c', 'SF'), mk('d', 'PF'), mk('e', 'C')]);
    const chem = evaluateChemistry(none);
    expect(coachBonus(brandt, none, chem)).toBe(0);
    const defensive = line([mk('a', 'PG', { spg: 2 }), mk('b', 'SG'), mk('c', 'SF', { spg: 2 }), mk('d', 'PF'), mk('e', 'C', { bpg: 2 })]);
    expect(coachBonus(brandt, defensive, evaluateChemistry(defensive))).toBeCloseTo(4.8);
  });

  it('strength = rating + chemistry + coach', () => {
    const players = [pm, shooter, def, reb, rim];
    const byId = new Map(players.map((p) => [p.id, p]));
    const slots = { PG: 'pm', SG: 'sh', SF: 'def', PF: 'reb', C: 'rim' };
    const t = buildTeam({ slots, byId, coach: COACHES.find((c) => c.id === 'navarro') });
    expect(t.rating).toBe(80);
    expect(t.strength).toBe(80 + 6 + 2 + 0.5 * 5);
  });
});

describe('playoffs', () => {
  const codes = ['AAA', 'BBB', 'CCC'];
  it('qualification threshold', () => {
    expect(qualifies(PLAYOFFS.minWins)).toBe(true);
    expect(qualifies(PLAYOFFS.minWins - 1)).toBe(false);
  });

  it('opponents are deterministic and get tougher', () => {
    const a = opponentFor({ seed: 5, round: 0, franchiseCodes: codes });
    expect(a).toEqual(opponentFor({ seed: 5, round: 0, franchiseCodes: codes }));
    expect(opponentFor({ seed: 5, round: 3, franchiseCodes: codes }).rating).toBeGreaterThan(a.rating);
  });

  it('a series ends when one side has 4 wins (4 to 7 games)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = simulateSeries({ seed, round: 1, strength: 82, opponent: { franchise: 'AAA', rating: 80 } });
      expect(Math.max(s.teamWins, s.oppWins)).toBe(4);
      expect(Math.min(s.teamWins, s.oppWins)).toBeLessThan(4);
      expect(s.games.length).toBe(s.teamWins + s.oppWins);
      expect(s.won).toBe(s.teamWins === 4);
    }
  });

  it('stronger teams win series more often', () => {
    const wins = (strength) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) n += simulateSeries({ seed, round: 0, strength, opponent: { franchise: 'A', rating: 80 } }).won ? 1 : 0;
      return n;
    };
    expect(wins(90)).toBeGreaterThan(wins(80));
    expect(wins(80)).toBeGreaterThan(wins(70));
  });
});
