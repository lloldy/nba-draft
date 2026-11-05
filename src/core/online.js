// Shared friends leaderboard on Supabase (plain REST, no SDK). Rooms hold the seed so friends play identical boards.
import { runScore } from './stats.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid typos
export const ROOM_RE = /^[A-Z0-9]{5}$/;

export function makeRoomCode(rand = Math.random) {
  return Array.from({ length: 5 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('');
}

export const normalizeCode = (s) => String(s ?? '').trim().toUpperCase();

export function scoreRow(run, room, playerId, name) {
  return {
    room, player_id: playerId, name: (name || 'Anonym').slice(0, 20),
    wins: run.wins, losses: run.losses, po: run.po, score: runScore(run),
    strength: Math.round(run.strength ?? 0), chem: run.chem ?? null,
    lineup: run.lineup.map((l) => ({ slot: l.slot, name: l.name, rating: l.rating })),
  };
}

export const isConfigured = (cfg) => Boolean(cfg?.url && cfg?.anonKey);

export function createApi(cfg, fetchFn = (...a) => fetch(...a)) {
  const base = `${cfg.url.replace(/\/$/, '')}/rest/v1`;
  const headers = { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json' };
  const req = async (path, opts = {}) => {
    const res = await fetchFn(`${base}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
    if (!res.ok) throw new Error(`Online-Fehler ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  const post = (path, row, prefer = 'resolution=ignore-duplicates,return=minimal') =>
    req(path, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(row) });
  const q = encodeURIComponent;
  return {
    createRoom: (room) => req('/rooms', { method: 'POST', body: JSON.stringify(room) }),
    async getRoom(code) {
      const rows = await req(`/rooms?code=eq.${q(code)}&select=*`);
      return rows?.[0] ?? null;
    },
    startRoom: (code) => req(`/rooms?code=eq.${q(code)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ started: true }) }),
    joinRoom: (row) => post('/room_players', row),
    roomPlayers: (code) => req(`/room_players?room=eq.${q(code)}&select=*&order=joined_at.asc,player_id.asc`),
    // Only the first result per player and room counts (unique constraint -> duplicates are ignored).
    submitScore: (row) => post('/scores', row),
    roomScores: (code, { day } = {}) => req(`/scores?room=eq.${q(code)}${day ? `&day=eq.${day}` : ''}&select=*&order=score.desc,created_at.asc&limit=50`),
    topScores: ({ n = 25, day } = {}) => req(`/scores?${day ? `day=eq.${day}&` : ''}select=name,wins,losses,po,score,room,player_id,created_at&order=score.desc,created_at.asc&limit=${n}`),
    postEntry: (row) => post('/po_entries', row),
    skipEntry: (room, playerId, round) => req(`/po_entries?room=eq.${q(room)}&player_id=eq.${q(playerId)}&round=eq.${round}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ skip: true }) }),
    roomEntries: (code) => req(`/po_entries?room=eq.${q(code)}&select=player_id,round,strength,skip&limit=500`),
  };
}
