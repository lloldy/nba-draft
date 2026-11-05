import { h } from './dom.js';
import { app, go, register } from './state.js';
import { load, save, KEYS } from './storage.js';
import { ONLINE } from '../online-config.js';
import { createApi, isConfigured, scoreRow } from '../core/online.js';
import { PO_LABELS } from '../core/stats.js';

export const onlineEnabled = isConfigured(ONLINE);
export const api = onlineEnabled ? createApi(ONLINE) : null;

export function playerId() {
  let id = load(KEYS.pid, null);
  if (!id) {
    id = crypto.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2)}`;
    save(KEYS.pid, id);
  }
  return id;
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);
export const roomLink = (code) => `${location.origin}${location.pathname}#room=${code}`;

// Friends room runs go to the room, daily runs to the shared DAILY board.
export const boardCodeFor = (run) => app.room ?? (run?.mode === 'daily' ? 'DAILY' : null);

export async function submitRun(run) {
  const room = boardCodeFor(run);
  if (!api || !room) return false;
  try { await api.submitScore(scoreRow(run, room, playerId(), app.name)); return true; } catch { return false; }
}

const medal = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

function table(rows, { showRoom = false } = {}) {
  if (!rows.length) return h('p', { class: 'hint' }, 'Noch keine Einträge.');
  return h('ol', { class: 'board-list online' }, rows.map((r, i) => h('li', { class: r.player_id === playerId() ? 'me' : '' },
    h('b', {}, medal(i)),
    h('span', {}, `${r.name} · ${r.wins}–${r.losses} · ${PO_LABELS[r.po]}`),
    h('em', {}, showRoom ? (r.room === 'DAILY' ? 'Daily' : `Raum ${r.room}`) : (r.lineup ?? []).map((l) => l.name).join(', ')))));
}

// Leaderboard box that keeps refreshing while it is on screen (friends finish at different times).
export function roomBoard(code, { day } = {}) {
  const daily = code === 'DAILY';
  const title = h('h3', {}, daily ? 'Daily-Challenge heute' : `Raum ${code}`);
  const body = h('div', {}, h('p', { class: 'hint' }, 'Lade…'));
  const box = h('section', { class: 'panel' }, title, body);
  let timer = null;
  const refresh = async () => {
    if (timer && !box.isConnected) { clearInterval(timer); return; }
    try {
      const [rows, players] = await Promise.all([api.roomScores(code, { day: daily ? day ?? todayUtc() : undefined }), daily ? [] : api.roomPlayers(code)]);
      const done = new Set(rows.map((r) => r.player_id));
      const pending = (players ?? []).filter((p) => !done.has(p.player_id));
      body.replaceChildren(
        table(rows ?? []),
        pending.length > 0 && h('p', { class: 'hint' }, `Noch unterwegs: ${pending.map((p) => p.name).join(', ')}`));
    } catch { body.replaceChildren(h('p', { class: 'out' }, 'Bestenliste nicht erreichbar.')); }
  };
  refresh();
  timer = setInterval(refresh, 4000);
  return box;
}

function tableBox(title, promise, opts) {
  const body = h('p', { class: 'hint' }, 'Lade…');
  const box = h('section', { class: 'panel' }, h('h3', {}, title), body);
  promise.then((rows) => body.replaceWith(table(rows ?? [], opts))).catch(() => body.replaceWith(h('p', { class: 'out' }, 'Nicht erreichbar.')));
  return box;
}

function boardScreen() {
  const tab = app.boardTab ?? 'today';
  const tabBtn = (id, label) => h('button', { class: `btn${tab === id ? ' primary' : ' ghost'}`, onclick: () => { app.boardTab = id; go('board'); } }, label);
  const day = todayUtc();
  const content =
    tab === 'daily' ? roomBoard('DAILY', { day })
      : tab === 'today' ? tableBox(`Heute (${day})`, api.topScores({ day }), { showRoom: true })
        : tableBox('Alle Zeiten', api.topScores(), { showRoom: true });
  return h('main', { class: 'screen stats' },
    h('h2', {}, 'Bestenliste'),
    h('div', { class: 'row' }, tabBtn('today', 'Heute'), tabBtn('daily', 'Daily'), tabBtn('all', 'Alle Zeiten')),
    app.room && roomBoard(app.room),
    content,
    h('button', { class: 'btn primary', onclick: () => go('start') }, 'Zurück'));
}

register('board', boardScreen);
