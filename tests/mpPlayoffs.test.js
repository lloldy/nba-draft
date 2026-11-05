import { describe, it, expect } from 'vitest';
import { assignConferences, resolveRoom } from '../src/core/mpPlayoffs.js';

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `player-${i}000`, name: `P${i}` }));
const withConfs = (room, ps) => { const c = assignConferences(room, ps.map((p) => p.id)); return ps.map((p) => ({ ...p, conf: c[p.id] })); };
const count = (ps, c) => ps.filter((p) => p.conf === c).length;
const ctx = { franchiseCodes: ['LAL', 'BOS', 'CHI'] };

// everybody qualifies and posts every round with the given strength
function fullEntries(players, strengthOf, upTo = 3) {
  const rows = [];
  for (const p of players) {
    rows.push({ player_id: p.id, round: -1, strength: 60, skip: false });
    for (let r = 0; r <= upTo; r++) rows.push({ player_id: p.id, round: r, strength: strengthOf(p, r), skip: false });
  }
  return rows;
}

describe('conferences', () => {
  it('splits 1/2/3/4 players as 1, 1+1, 2+1, 2+2', () => {
    for (const [n, a, b] of [[1, 1, 0], [2, 1, 1], [3, 2, 1], [4, 2, 2]]) {
      const ps = withConfs('ROOM1', mk(n));
      expect([count(ps, 'A'), count(ps, 'B')]).toEqual([a, b]);
    }
  });
  it('is deterministic', () => {
    const ids = mk(4).map((p) => p.id);
    expect(assignConferences('XYZ12', ids)).toEqual(assignConferences('XYZ12', [...ids].reverse()));
  });
});

describe('multiplayer playoffs', () => {
  it('conference mates meet in round 2, results mirror each other', () => {
    const ps = withConfs('ROOM2', mk(4));
    const entries = fullEntries(ps, (p, r) => (r < 2 ? 140 : 100 + Number(p.name[1])));
    const rs = resolveRoom({ room: 'ROOM2', players: ps, entries, ...ctx });
    const a = ps.filter((p) => p.conf === 'A');
    const oa = rs.outcome(a[0].id, 2), ob = rs.outcome(a[1].id, 2);
    expect(oa.opp.kind).toBe('player');
    expect(oa.opp.id).toBe(a[1].id);
    expect(oa.series.won).toBe(!ob.series.won);
    expect(oa.series.teamWins).toBe(ob.series.oppWins);
  });

  it('finals pit the two conference champions against each other', () => {
    const ps = withConfs('ROOM3', mk(4));
    const entries = fullEntries(ps, (p) => 140 + Number(p.name[1])); // overwhelming, so everybody beats the bots
    const rs = resolveRoom({ room: 'ROOM3', players: ps, entries, ...ctx });
    const champs = ['A', 'B'].map((c) => rs.champion(c));
    expect(champs.every(Boolean)).toBe(true);
    const o = rs.outcome(champs[0], 3);
    expect(o.opp).toMatchObject({ kind: 'player', id: champs[1] });
    expect(rs.outcome(champs[1], 3).series.won).toBe(!o.series.won);
  });

  it('plays a bot in round 2 when the conference mate is eliminated earlier', () => {
    const ps = withConfs('ROOM4', mk(4));
    const a = ps.filter((p) => p.conf === 'A');
    const entries = fullEntries(ps, (p, r) => (p.id === a[1].id && r === 0 ? 40 : 140), 1); // a[1] is crushed in round 0
    // a[0] posts round 2 as well
    entries.push({ player_id: a[0].id, round: 2, strength: 140, skip: false });
    const rs = resolveRoom({ room: 'ROOM4', players: ps, entries, ...ctx });
    expect(rs.outcome(a[1].id, 0).state).toBe('loss');
    expect(rs.outcome(a[0].id, 2).opp.kind).toBe('bot');
  });

  it('waits for the partner until skipped', () => {
    const ps = withConfs('ROOM5', mk(2));
    const [x, y] = ps;
    const base = fullEntries(ps, () => 140, 1);
    const entries = [...base, { player_id: x.id, round: 2, strength: 140, skip: false }];
    // 2 players are in different conferences, so x has no mate -> bot already
    expect(resolveRoom({ room: 'ROOM5', players: ps, entries, ...ctx }).outcome(x.id, 2).opp.kind).toBe('bot');
    const ps4 = withConfs('ROOM6', mk(4));
    const [m, n] = ps4.filter((p) => p.conf === 'A');
    const e4 = [...fullEntries(ps4, () => 140, 1), { player_id: m.id, round: 2, strength: 140, skip: false }];
    expect(resolveRoom({ room: 'ROOM6', players: ps4, entries: e4, ...ctx }).outcome(m.id, 2).state).toBe('pending');
    const skipped = e4.map((e) => (e.player_id === m.id && e.round === 2 ? { ...e, skip: true } : e));
    const res = resolveRoom({ room: 'ROOM6', players: ps4, entries: skipped, ...ctx }).outcome(m.id, 2);
    expect(res.opp.kind).toBe('bot');
    expect(n).toBeTruthy();
    expect(y).toBeTruthy();
  });

  it('players who miss the playoffs are out and do not block others', () => {
    const ps = withConfs('ROOM7', mk(3));
    const entries = fullEntries(ps, () => 140, 1);
    const weak = ps[0];
    entries.find((e) => e.player_id === weak.id && e.round === -1).strength = 30;
    const rs = resolveRoom({ room: 'ROOM7', players: ps, entries, ...ctx });
    expect(rs.alive(weak.id, 0)).toBe(false);
    expect(rs.outcome(weak.id, 0).state).toBe('dead');
  });

  it('is identical for every client (pure function of entries)', () => {
    const ps = withConfs('ROOM8', mk(3));
    const entries = fullEntries(ps, (p, r) => 95 + r);
    const a = resolveRoom({ room: 'ROOM8', players: ps, entries, ...ctx });
    const b = resolveRoom({ room: 'ROOM8', players: [...ps].reverse(), entries: [...entries].reverse(), ...ctx });
    for (const p of ps) for (let r = 0; r <= 3; r++) expect(a.outcome(p.id, r).state).toBe(b.outcome(p.id, r).state);
  });
});
