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

export const roomLink = (code) => `${location.origin}${location.pathname}#room=${code}`;

export async function submitRun(run) {
  if (!api || !app.room) return false;
  try { await api.submitScore(scoreRow(run, app.room, playerId(), app.name)); return true; } catch { return false; }
}

const medal = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

function table(rows, { showRoom = false } = {}) {
  if (!rows.length) return h('p', { class: 'hint' }, 'Noch keine Einträge.');
  return h('ol', { class: 'board-list online' }, rows.map((r, i) => h('li', { class: r.player_id === playerId() ? 'me' : '' },
    h('b', {}, medal(i)),
    h('span', {}, `${r.name} · ${r.wins}–${r.losses} · ${PO_LABELS[r.po]}`),
    h('em', {}, showRoom ? `Raum ${r.room}` : (r.lineup ?? []).map((l) => l.name).join(', ')))));
}

// Async leaderboard box; fills itself in once the request returns.
export function roomBoard(code) {
  const title = h('h3', {}, `Raum ${code}`);
  const box = h('section', { class: 'panel' }, title, h('p', { class: 'hint' }, 'Lade…'));
  api?.roomScores(code)
    .then((rows) => box.replaceChildren(title, table(rows ?? [])))
    .catch(() => box.replaceChildren(title, h('p', { class: 'out' }, 'Bestenliste nicht erreichbar.')));
  return box;
}

function boardScreen() {
  const title = h('h3', {}, 'Alle Räume');
  const all = h('section', { class: 'panel' }, title, h('p', { class: 'hint' }, 'Lade…'));
  api?.topScores()
    .then((rows) => all.replaceChildren(title, table(rows ?? [], { showRoom: true })))
    .catch(() => all.replaceChildren(title, h('p', { class: 'out' }, 'Nicht erreichbar.')));
  return h('main', { class: 'screen stats' },
    h('h2', {}, 'Bestenliste'),
    app.room && roomBoard(app.room),
    all,
    h('button', { class: 'btn primary', onclick: () => go('start') }, 'Zurück'));
}

register('board', boardScreen);
