// Multiplayer playoffs: players of a room are split into two conferences ("A" = Ost, "B" = West).
// Rounds 0 and 1 are against bots (every conference has its own bot opponents), the conference finals (round 2)
// are between the two players of a conference (otherwise a bot), the finals (round 3) are between the two
// conference champions (otherwise a bot).
//
// Nobody talks to anybody directly. Every client posts one row per round ("entry": strength, plus an optional skip flag)
// and then computes the very same result from all rows. Every series is a pure function of the room code and the entries,
// so all players always see identical outcomes.
import { PLAYOFFS } from './config.js';
import { hashString } from './seed.js';
import { opponentFor, simulateSeries } from './playoffs.js';

export const ROOM_MAX = 4;
export const CONF_NAMES = { A: 'Ost', B: 'West' };

// 1 player: A. 2: 1 + 1. 3: 2 + 1. 4: 2 + 2. Order is shuffled by room code, so the host is not always in A.
export function assignConferences(room, ids) {
  const order = [...ids].sort((a, b) => hashString(room + a) - hashString(room + b) || a.localeCompare(b));
  const sizeA = Math.ceil(order.length / 2);
  return Object.fromEntries(order.map((id, i) => [id, i < sizeA ? 'A' : 'B']));
}

const flip = (s) => ({
  games: s.games.map((g) => ({ win: !g.win, team: g.opp, opp: g.team })),
  teamWins: s.oppWins, oppWins: s.teamWins, won: !s.won, p: 1 - s.p,
});

// players: [{ id, name, conf }], entries: [{ player_id, round, strength, skip }] (round -1 = regular season, strength = wins)
export function resolveRoom({ room, players, entries, boards = null, franchiseCodes = [] }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ent = (id, r) => entries.find((e) => e.player_id === id && e.round === r);
  const memo = new Map();
  const botFor = (conf, round) => opponentFor({ seed: hashString(`${room}:${conf}`), round, franchiseCodes, boards });
  const finalBot = (conf) => opponentFor({ seed: hashString(`${room}:final:${conf}`), round: 3, franchiseCodes, boards });
  const mateOf = (id) => players.find((p) => p.conf === byId.get(id).conf && p.id !== id) ?? null;
  const rivals = (id) => players.filter((p) => p.conf !== byId.get(id).conf);

  // true | false | 'pending'
  function alive(id, r) {
    if (r === 0) {
      const e = ent(id, -1);
      return e ? e.strength >= PLAYOFFS.minWins : 'pending';
    }
    const a = alive(id, r - 1);
    if (a !== true) return a;
    const o = outcome(id, r - 1);
    if (o.state === 'win') return r === 3 ? champion(byId.get(id).conf) === id : true;
    return o.state === 'loss' ? false : 'pending';
  }

  // The player who won the conference finals of a conference (highest strength if several, which only happens after a skip).
  function champion(conf) {
    const winners = players.filter((p) => p.conf === conf && outcome(p.id, 2).state === 'win');
    if (!winners.length) return null;
    return winners.reduce((best, p) => {
      const sb = ent(best.id, 2).strength, sp = ent(p.id, 2).strength;
      return sp > sb || (sp === sb && p.id < best.id) ? p : best;
    }).id;
  }

  function opponentOf(id, r, e) {
    const conf = byId.get(id).conf;
    if (r <= 1) return { kind: 'bot', opp: botFor(conf, r) };
    if (r === 2) {
      const bot = { kind: 'bot', opp: botFor(conf, 2) };
      const mate = mateOf(id);
      if (!mate || e.skip) return bot;
      const a = alive(mate.id, 2);
      if (a === false) return bot;
      const em = ent(mate.id, 2);
      if (em?.skip) return bot;
      if (a === 'pending' || !em) return { kind: 'wait', on: mate };
      return { kind: 'player', id: mate.id, name: mate.name, strength: em.strength };
    }
    // finals
    const other = conf === 'A' ? 'B' : 'A';
    const bot = { kind: 'bot', opp: finalBot(other) };
    if (e.skip) return bot;
    const side = rivals(id);
    for (const y of side) {
      const a = alive(y.id, 2);
      if (a === 'pending') return { kind: 'wait', on: y };
      if (a === true) {
        const oy = outcome(y.id, 2);
        if (oy.state === 'idle' || oy.state === 'pending') return { kind: 'wait', on: y };
      }
    }
    const champ = champion(other);
    if (!champ) return bot;
    const ey = ent(champ, 3);
    if (ey?.skip) return bot;
    if (!ey) return { kind: 'wait', on: byId.get(champ) };
    return { kind: 'player', id: champ, name: byId.get(champ).name, strength: ey.strength };
  }

  // { state: 'dead' | 'pending' | 'idle' | 'win' | 'loss', series?, opp?, wait? }
  function outcome(id, r) {
    const key = `${id}:${r}`;
    if (memo.has(key)) return memo.get(key);
    let res;
    const a = alive(id, r);
    if (a === false) res = { state: 'dead' };
    else if (a === 'pending') res = { state: 'pending' };
    else {
      const e = ent(id, r);
      if (!e) res = { state: 'idle' };
      else {
        const opp = opponentOf(id, r, e);
        if (opp.kind === 'wait') res = { state: 'pending', wait: opp.on };
        else if (opp.kind === 'bot') {
          const series = simulateSeries({ seed: hashString(`${room}:${id}`), round: r, strength: e.strength, opponent: opp.opp });
          res = { state: series.won ? 'win' : 'loss', series, opp };
        } else {
          const [lo] = [id, opp.id].sort();
          const sLo = lo === id ? e.strength : opp.strength;
          const sHi = lo === id ? opp.strength : e.strength;
          const base = simulateSeries({ seed: hashString(`${room}:h2h:${r}:${[id, opp.id].sort().join('')}`), round: r, strength: sLo, opponent: { rating: sHi } });
          const series = lo === id ? base : flip(base);
          res = { state: series.won ? 'win' : 'loss', series, opp };
        }
      }
    }
    memo.set(key, res);
    return res;
  }

  return { alive, outcome, champion, mateOf };
}
