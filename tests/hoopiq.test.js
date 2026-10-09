import { describe, it, expect } from 'vitest';
import { iqScore } from '../src/core/hoopiq.js';
import { createDraft, pick, undoLastPick } from '../src/core/draft.js';

const mk = (id, rating, f = 'AAA', d = 1990) => ({ id, name: id, franchise: f, decade: d, pos: ['PG'], altPos: [], rating });
const byId = new Map([mk('hi', 90), mk('mid', 70), mk('lo', 50)].map((p) => [p.id, p]));
const pk = (playerId) => ({ playerId, bestId: 'hi', worstId: 'lo' }); // board: 90 / 70 / 50

describe('hoopiq', () => {
  it('scores each pick between the worst (0 %) and best (100 %) player of its board', () => {
    expect(iqScore([pk('hi'), pk('hi')], byId)).toMatchObject({ pct: 100, title: 'Draft-Genie', perfect: 2 });
    expect(iqScore([pk('lo'), pk('lo')], byId)).toMatchObject({ pct: 0, title: 'Rookie', perfect: 0 });
    const mixed = iqScore([pk('mid'), pk('hi')], byId); // 50 % and 100 %
    expect(mixed.pct).toBe(75);
    expect(mixed.rows[0]).toMatchObject({ name: 'mid', bestName: 'hi' });
  });

  it('title thresholds', () => {
    const title = (id) => iqScore([pk(id)], byId).title;
    expect(title('hi')).toBe('Draft-Genie');
    expect(title('mid')).toBe('Rookie'); // 50 %
  });

  it('a board with equal ratings counts as perfect', () => {
    const same = new Map([mk('a', 70), mk('b', 70)].map((p) => [p.id, p]));
    expect(iqScore([{ playerId: 'a', bestId: 'a', worstId: 'b' }], same).pct).toBe(100);
  });

  it('draft records best and worst player of every board and undo removes the pick', () => {
    const pool = [];
    for (const f of ['AAA', 'BBB', 'CCC']) for (const d of [1980, 1990]) for (let i = 0; i < 3; i++) pool.push(mk(`${f}${d}${i}`, 50 + i * 10, f, d));
    let s = createDraft({ seed: 3, players: pool });
    const board = s.current.players;
    s = pick(s, board[0].id, 'PG');
    expect(s.picks[0].bestId).toBe(board.find((p) => p.rating === 70).id);
    expect(s.picks[0].worstId).toBe(board.find((p) => p.rating === 50).id);
    s = undoLastPick(s);
    expect(s.picks).toHaveLength(0);
  });
});
