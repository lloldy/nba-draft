import { h } from './dom.js';
import { app, go, render, register } from './state.js';
import { load, save, KEYS } from './storage.js';
import { spinAnimation } from './screens.js';
import { DECADES } from '../core/config.js';
import { createDraft } from '../core/draft.js';
import { COACHES } from '../core/coaches.js';
import { constraintsFor, pickLegend, ruleById } from '../core/rules.js';
import { dailyInfo, utcDate, emptyDaily, hasPlayed, startAttempt, currentStreak } from '../core/daily.js';
import { PO_LABELS } from '../core/stats.js';
import { api, onlineEnabled, roomLink } from './online.js';
import { makeRoomCode, normalizeCode, ROOM_RE } from '../core/online.js';

export function startDraft() {
  const locked = app.rule?.type === 'legend' ? pickLegend(app.data.players, app.seed) : null;
  app.draft = createDraft({
    seed: app.seed,
    players: app.data.players,
    constraints: constraintsFor(app.rule, app.decade),
    locked,
  });
  app.selCard = app.selSlot = null;
  app.po = null;
  app.run = null;
  app.coach = COACHES.at(-1);
  app.lineupBack = 'season';
  go('draft');
  spinAnimation();
}

function startDaily() {
  const today = utcDate();
  const info = dailyInfo(today);
  save(KEYS.daily, startAttempt(load(KEYS.daily, emptyDaily()), today)); // one attempt per day, used up now
  Object.assign(app, { room: null, mode: 'daily', seed: info.seed, rule: info.rule, decade: null, dailyDate: today, hoopiq: false });
  startDraft();
}

function acceptChallenge() {
  const c = app.challenge;
  Object.assign(app, { room: c.room ?? null, mode: 'challenge', seed: c.seed, decade: c.era, rule: ruleById(c.rule), hoopiq: c.iq });
  startDraft();
}

function dailyCard() {
  const today = utcDate();
  const info = dailyInfo(today);
  const daily = load(KEYS.daily, emptyDaily());
  const played = hasPlayed(daily, today);
  const result = daily.attempts[today];
  return h('section', { class: 'panel daily' },
    h('div', { class: 'panel-head' }, h('h3', {}, `Daily vom ${today}`), h('span', { class: 'chip accent' }, `Streak ${currentStreak(daily, today)}`)),
    h('p', { class: 'rule-line' }, h('b', {}, info.rule.label), ` – ${info.rule.desc}`),
    played
      ? h('p', { class: 'hint' }, result?.done
          ? `Heute gespielt: ${result.wins} Siege · ${PO_LABELS[result.po]}${info.rule.type !== 'constraint' || info.rule.id === 'fans300' ? (result.passed ? ' · Regel erfüllt' : ' · Regel verfehlt') : ''}`
          : 'Dein heutiger Versuch ist angefangen, aber nicht beendet worden. Morgen gibt es einen neuen.')
      : h('button', { class: 'btn primary', onclick: startDaily }, 'Daily starten (1 Versuch)'),
  );
}

async function createRoom(era, iq, status) {
  if (!app.name.trim()) { status.textContent = 'Bitte zuerst deinen Namen eintragen.'; return; }
  status.textContent = 'Erstelle Raum…';
  const room = { code: makeRoomCode(), seed: Math.floor(Math.random() * 1e9) + 1, era: era.value ? Number(era.value) : null, iq: iq.checked, created_by: app.name.slice(0, 20) };
  try {
    await api.createRoom(room);
    try { await navigator.clipboard.writeText(roomLink(room.code)); } catch { /* the link is also offered after the run */ }
    app.challenge = { seed: room.seed, era: room.era, iq: room.iq, room: room.code, rule: null, by: app.name, record: null };
    go('roomready');
  } catch { status.textContent = 'Raum konnte nicht erstellt werden (offline?).'; }
}

async function joinRoom(input, status) {
  const code = normalizeCode(input.value);
  if (!ROOM_RE.test(code)) { status.textContent = 'Der Code hat 5 Zeichen.'; return; }
  if (!app.name.trim()) { status.textContent = 'Bitte zuerst deinen Namen eintragen.'; return; }
  status.textContent = 'Suche Raum…';
  try {
    const r = await api.getRoom(code);
    if (!r) { status.textContent = 'Diesen Raum gibt es nicht.'; return; }
    app.challenge = { seed: r.seed, era: r.era, iq: r.iq, room: r.code, rule: null, by: r.created_by, record: null };
    acceptChallenge();
  } catch { status.textContent = 'Raum nicht erreichbar (offline?).'; }
}

function roomReadyScreen() {
  const c = app.challenge;
  const link = roomLink(c.room);
  const btn = h('button', { class: 'btn', onclick: async () => {
    try { await navigator.clipboard.writeText(link); btn.textContent = 'Link kopiert!'; } catch { prompt('Zum Kopieren:', link); }
  } }, 'Link kopieren');
  return h('main', { class: 'screen start' },
    h('h2', {}, 'Raum erstellt'),
    h('section', { class: 'panel challenge' },
      h('p', { class: 'hint' }, 'Schick deinen Freunden diesen Code oder den Link:'),
      h('p', { class: 'room-code' }, c.room),
      h('p', { class: 'hint' }, link),
      btn),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => { app.challenge = null; go('start'); } }, 'Abbrechen'),
      h('button', { class: 'btn primary', onclick: acceptChallenge }, 'Draft starten')));
}
register('roomready', roomReadyScreen);

function roomPanel(era, iqBox) {
  if (!onlineEnabled) return null;
  const code = h('input', { type: 'text', maxlength: 5, placeholder: 'Raumcode, z. B. K7M2Q', class: 'code' });
  const status = h('p', { class: 'hint' });
  return h('section', { class: 'panel challenge' },
    h('h3', {}, 'Mit Freunden spielen'),
    h('p', { class: 'hint' }, 'Alle im Raum draften dieselben Boards. Dein erster Versuch zählt und landet in der gemeinsamen Bestenliste. Ära und HoopIQ für einen neuen Raum nimmst du aus dem Freien Spiel unten.'),
    h('div', { class: 'row' },
      code,
      h('button', { class: 'btn primary', onclick: () => joinRoom(code, status) }, 'Beitreten')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => createRoom(era, iqBox, status) }, 'Neuen Raum erstellen'),
      h('button', { class: 'btn ghost', onclick: () => go('board') }, 'Bestenliste')),
    status);
}

function startScreen() {
  const seedInput = h('input', { type: 'number', value: app.seed, id: 'seed', inputmode: 'numeric' });
  const era = h('select', { id: 'era' },
    h('option', { value: '' }, 'Alle Dekaden'),
    DECADES.map((d) => h('option', { value: d, selected: app.decade === d }, `Nur ${d}er`)));
  const name = h('input', { type: 'text', value: app.name, maxlength: 20, placeholder: 'Dein Name (für Challenge-Links)', oninput: () => { app.name = name.value; save(KEYS.name, app.name); } });
  const iqBox = h('input', { type: 'checkbox', id: 'iq', checked: app.hoopiq });
  const ch = app.challenge;
  return h('main', { class: 'screen start' },
    h('h1', { class: 'logo' }, 'NBA', h('span', {}, 'Draft')),
    h('p', { class: 'lead' }, 'Dreh das Rad, drafte fünf Spieler und simuliere 82 Spiele.'),
    app.data.meta.source.includes('SYNTHETIC') && h('p', { class: 'notice' }, 'Beispieldaten (erfundene Spieler) – echte Daten siehe DATA_SOURCES.md'),
    ch && h('section', { class: 'panel challenge' },
      h('h3', {}, ch.room ? `Freunde-Raum ${ch.room}` : `${ch.by ?? 'Ein Freund'} fordert dich heraus`),
      h('p', { class: 'rule-line' }, ch.record ? `Rekord: ${ch.record.wins} Siege · ${PO_LABELS[ch.record.po]}` : 'Gleiche Boards, gleicher Seed.',
        ch.rule && ruleById(ch.rule) ? ` · Regel: ${ruleById(ch.rule).label}` : '', ch.era ? ` · Nur ${ch.era}er` : '', ch.iq ? ' · HoopIQ' : ''),
      h('button', { class: 'btn primary', onclick: acceptChallenge }, 'Challenge annehmen')),
    dailyCard(),
    roomPanel(era, iqBox),
    h('section', { class: 'panel' },
      h('h3', {}, 'Freies Spiel'),
      h('label', {}, 'Seed (gleicher Seed = gleiche Boards)', seedInput),
      h('label', {}, 'Ära-Modus', era),
      h('label', { class: 'check' }, iqBox, 'HoopIQ-Modus: Stats und Ratings sind beim Draft versteckt'),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { seedInput.value = Math.floor(Math.random() * 1e9); } }, 'Zufälliger Seed'),
        h('button', { class: 'btn primary', onclick: () => {
          Object.assign(app, { room: null, mode: 'free', rule: null, seed: Number(seedInput.value) || 1, decade: era.value ? Number(era.value) : null, hoopiq: iqBox.checked });
          startDraft();
        } }, 'Draft starten'))),
    h('label', {}, 'Dein Name', name),
    h('nav', { class: 'row links' },
      h('button', { class: 'btn ghost', onclick: () => go('stats') }, 'Statistik'),
      h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/franchises'; } }, 'Franchises'),
      h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/era'; } }, 'Ären')),
  );
}

register('start', startScreen);
