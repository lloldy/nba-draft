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
import { api, onlineEnabled, roomLink, playerId } from './online.js';
import { makeRoomCode, normalizeCode, ROOM_RE } from '../core/online.js';
import { assignConferences, ROOM_MAX } from '../core/mpPlayoffs.js';

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
  Object.assign(app, { room: null, roomCtx: null, mode: 'daily', seed: info.seed, rule: info.rule, decade: null, dailyDate: today, hoopiq: false });
  startDraft();
}

function acceptChallenge() {
  const c = app.challenge;
  Object.assign(app, { room: c.room ?? null, mode: 'challenge', seed: c.seed || Math.floor(Math.random() * 1e9) + 1, decade: c.era, rule: ruleById(c.rule), hoopiq: c.iq });
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

async function createRoom(era, iq, own, status) {
  if (!app.name.trim()) { status.textContent = 'Bitte zuerst deinen Namen eintragen.'; return; }
  status.textContent = 'Erstelle Raum…';
  const room = { code: makeRoomCode(), seed: own.checked ? 0 : Math.floor(Math.random() * 1e9) + 1, era: era.value ? Number(era.value) : null, iq: iq.checked, created_by: app.name.slice(0, 20), host_id: playerId() };
  try {
    await api.createRoom(room);
    await api.joinRoom({ room: room.code, player_id: playerId(), name: app.name.slice(0, 20) });
    try { await navigator.clipboard.writeText(roomLink(room.code)); } catch { /* the link is shown in the lobby */ }
    app.lobby = { code: room.code };
    go('lobby');
  } catch { status.textContent = 'Raum konnte nicht erstellt werden (offline?).'; }
}

// Join (or re-enter) a room and wait in its lobby.
export async function enterRoom(code, status = null) {
  const say = (t) => { if (status) status.textContent = t; else alert(t); };
  if (!app.name.trim()) { say('Bitte zuerst deinen Namen eintragen.'); return; }
  say('Suche Raum…');
  try {
    const room = await api.getRoom(code);
    if (!room || code === 'DAILY') { say('Diesen Raum gibt es nicht.'); return; }
    const me = playerId();
    let players = await api.roomPlayers(code);
    if (!players.some((p) => p.player_id === me)) {
      if (room.started) { say('Dieser Raum hat schon gestartet.'); return; }
      if (players.length >= ROOM_MAX) { say(`Der Raum ist voll (max. ${ROOM_MAX} Spieler).`); return; }
      await api.joinRoom({ room: code, player_id: me, name: app.name.slice(0, 20) }).catch(() => {});
      players = await api.roomPlayers(code);
      if (!players.some((p) => p.player_id === me)) { say(`Der Raum ist voll (max. ${ROOM_MAX} Spieler).`); return; }
    }
    app.lobby = { code };
    go('lobby');
  } catch { say('Raum nicht erreichbar (offline?).'); }
}

function beginRoom(room, players) {
  const confs = assignConferences(room.code, players.map((p) => p.player_id));
  const me = playerId();
  app.roomCtx = {
    code: room.code, myId: me, hostId: room.host_id, conf: confs[me],
    players: players.map((p) => ({ id: p.player_id, name: p.name, conf: confs[p.player_id] })),
  };
  Object.assign(app, { room: room.code, mode: 'challenge', seed: room.seed || Math.floor(Math.random() * 1e9) + 1, decade: room.era, rule: null, hoopiq: room.iq, challenge: null });
  startDraft();
}

function lobbyScreen() {
  const code = app.lobby.code;
  const link = roomLink(code);
  const list = h('ol', { class: 'board-list lobby' });
  const status = h('p', { class: 'hint' }, 'Lade…');
  const startBtn = h('button', { class: 'btn primary', disabled: true }, 'Spiel starten');
  const copyBtn = h('button', { class: 'btn', onclick: async () => {
    try { await navigator.clipboard.writeText(link); copyBtn.textContent = 'Link kopiert!'; } catch { prompt('Zum Kopieren:', link); }
  } }, 'Link kopieren');
  let timer = null, begun = false, hostId = null, count = 0;
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try { await api.startRoom(code); } catch { status.textContent = 'Start fehlgeschlagen, bitte nochmal.'; startBtn.disabled = false; return; }
    refresh();
  });
  async function refresh() {
    if (begun) return;
    if (timer && !list.isConnected) { clearInterval(timer); return; }
    try {
      const [room, players] = await Promise.all([api.getRoom(code), api.roomPlayers(code)]);
      if (!room) return;
      hostId = room.host_id; count = players.length;
      list.replaceChildren(...players.map((p) => h('li', {}, h('b', {}, p.player_id === room.host_id ? '👑' : '🏀'), h('span', {}, p.name), h('em', {}, p.player_id === playerId() ? 'du' : ''))));
      if (room.started) { begun = true; clearInterval(timer); beginRoom(room, players); return; }
      const isHost = hostId === playerId();
      startBtn.hidden = !isHost;
      startBtn.disabled = false;
      startBtn.textContent = `Spiel starten (${count} ${count === 1 ? 'Spieler' : 'Spieler'})`;
      status.textContent = isHost
        ? `Warte auf Mitspieler (${count}/${ROOM_MAX}). Starte, wenn alle da sind. Danach kann niemand mehr beitreten.`
        : `Warte, bis der Host das Spiel startet (${count}/${ROOM_MAX} Spieler).`;
    } catch { status.textContent = 'Verbindung zum Raum unterbrochen, versuche es weiter…'; }
  }
  refresh();
  timer = setInterval(refresh, 2000);
  return h('main', { class: 'screen start' },
    h('h2', {}, 'Lobby'),
    h('section', { class: 'panel challenge' },
      h('p', { class: 'hint' }, 'Raumcode für deine Freunde:'),
      h('p', { class: 'room-code' }, code),
      h('p', { class: 'hint' }, link),
      copyBtn),
    h('section', { class: 'panel' }, h('h3', {}, 'Spieler'), list, status),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => { begun = true; clearInterval(timer); app.lobby = null; go('start'); } }, 'Verlassen'),
      startBtn));
}
register('lobby', lobbyScreen);

function roomPanel(era, iqBox) {
  const own = h('input', { type: 'checkbox', id: 'own' });
  if (!onlineEnabled) return null;
  const code = h('input', { type: 'text', maxlength: 5, placeholder: 'Raumcode, z. B. K7M2Q', class: 'code' });
  const status = h('p', { class: 'hint' });
  return h('section', { class: 'panel challenge' },
    h('h3', {}, 'Mit Freunden spielen'),
    h('p', { class: 'hint' }, 'Bis zu 4 Spieler. Der Host startet, wenn alle in der Lobby sind. Standardmäßig draften alle dieselben Boards, mit dem Haken bekommt jeder eigene. In den Playoffs spielt ihr in zwei Conferences, die Finals sind Spieler gegen Spieler. Dein erster Versuch zählt für die Bestenliste. Ära und HoopIQ für einen neuen Raum nimmst du aus dem Freien Spiel unten.'),
    h('label', { class: 'check' }, own, 'Neuer Raum: Jeder bekommt andere Boards (eigene Spins)'),
    h('div', { class: 'row' },
      code,
      h('button', { class: 'btn primary', onclick: () => { const c = normalizeCode(code.value); if (!ROOM_RE.test(c)) { status.textContent = 'Der Code hat 5 Zeichen.'; return; } enterRoom(c, status); } }, 'Beitreten')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => createRoom(era, iqBox, own, status) }, 'Neuen Raum erstellen'),
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
      h('h3', {}, ch.room ? `Freunde-Raum ${ch.room}${ch.seed === 0 ? ' · eigene Boards' : ''}` : `${ch.by ?? 'Ein Freund'} fordert dich heraus`),
      h('p', { class: 'rule-line' }, ch.record ? `Rekord: ${ch.record.wins} Siege · ${PO_LABELS[ch.record.po]}` : 'Gleiche Boards, gleicher Seed.',
        ch.rule && ruleById(ch.rule) ? ` · Regel: ${ruleById(ch.rule).label}` : '', ch.era ? ` · Nur ${ch.era}er` : '', ch.iq ? ' · HoopIQ' : ''),
      ch.room
        ? h('button', { class: 'btn primary', onclick: () => enterRoom(ch.room) }, 'Raum beitreten')
        : h('button', { class: 'btn primary', onclick: acceptChallenge }, 'Challenge annehmen')),
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
          Object.assign(app, { room: null, roomCtx: null, mode: 'free', rule: null, seed: Number(seedInput.value) || 1, decade: era.value ? Number(era.value) : null, hoopiq: iqBox.checked });
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
