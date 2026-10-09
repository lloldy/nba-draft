import { h, reducedMotion } from './dom.js';
import { playerCard, emptySlot } from './cards.js';
import { POSITIONS, DECADES, SIM, CHEM, PLAYOFFS } from '../core/config.js';
import { createDraft, pick, skipTeam, skipEra, swapSlots, undoLastPick, isComplete } from '../core/draft.js';
import { effectiveRating } from '../core/positions.js';
import { simulateSeason } from '../core/sim.js';
import { COACHES } from '../core/coaches.js';
import { buildTeam } from '../core/team.js';
import { qualifies, opponentFor, simulateSeries } from '../core/playoffs.js';

// All mutable UI state lives here. The core modules stay pure.
export const app = {
  data: null, // { players, byId, meta }
  franchises: {},
  screen: 'start',
  seed: 0,
  decade: null, // era mode: only this decade
  draft: null,
  selCard: null, // player id picked from the board
  selSlot: null, // slot picked for swapping
  spinning: false,
  msg: '',
  season: null,
  coach: COACHES.at(-1), // chosen before the season
  po: null, // playoff state { round, results[], live, over }
  lineupBack: 'season', // where the lineup editor returns to
  timer: null,
};

const root = () => document.getElementById('app');
const fName = (code) => app.franchises[code]?.name ?? code;
let wheelTimer = null;

export function render() {
  clearInterval(app.timer);
  const screens = { start: startScreen, draft: draftScreen, lineup: lineupScreen, sim: simScreen, result: resultScreen, playoffs: playoffsScreen };
  root().replaceChildren(screens[app.screen]());
}

function go(screen) {
  app.screen = screen;
  app.msg = '';
  render();
}

const team = () => buildTeam({ slots: app.draft.slots, byId: app.data.byId, coach: app.coach });
const shareLink = () => `${location.origin}${location.pathname}#seed=${app.seed}${app.decade ? `&era=${app.decade}` : ''}`;

// ---------- start ----------
function startScreen() {
  const seedInput = h('input', { type: 'number', value: app.seed, id: 'seed', inputmode: 'numeric' });
  const era = h('select', { id: 'era' },
    h('option', { value: '' }, 'Alle Dekaden'),
    DECADES.map((d) => h('option', { value: d, selected: app.decade === d }, `Nur ${d}er`)));
  return h('main', { class: 'screen start' },
    h('h1', { class: 'logo' }, 'NBA ', h('span', {}, 'DRAFT')),
    h('p', { class: 'lead' }, 'Dreh das Rad, drafte fünf Spieler und simuliere 82 Spiele.'),
    app.data.meta.source.includes('SYNTHETIC') && h('p', { class: 'notice' }, 'Beispieldaten (erfundene Spieler) – echte Daten siehe DATA_SOURCES.md'),
    h('label', {}, 'Seed (gleicher Seed = gleiche Boards für alle)', seedInput),
    h('label', {}, 'Ära-Modus', era),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => { seedInput.value = Math.floor(Math.random() * 1e9); } }, 'Zufälliger Seed'),
      h('button', { class: 'btn primary', onclick: () => {
        app.seed = Number(seedInput.value) || 1;
        app.decade = era.value ? Number(era.value) : null;
        startDraft();
      } }, 'Draft starten')),
  );
}

export function startDraft() {
  app.draft = createDraft({
    seed: app.seed,
    players: app.data.players,
    constraints: app.decade ? { decades: [app.decade] } : {},
  });
  app.selCard = app.selSlot = null;
  app.po = null;
  app.lineupBack = 'season';
  go('draft');
  spinAnimation();
}

// ---------- draft ----------
function wheelText() {
  const c = app.draft.current;
  return { team: fName(c.franchise), era: `${c.decade}er` };
}

// Cycle random teams for a moment, then land on the real board.
function spinAnimation() {
  clearInterval(wheelTimer);
  const fr = Object.keys(app.franchises);
  const finish = () => { app.spinning = false; render(); };
  if (reducedMotion()) return finish();
  app.spinning = true;
  render();
  const team = document.querySelector('.wheel-team'), era = document.querySelector('.wheel-era');
  let ticks = 0;
  wheelTimer = setInterval(() => {
    ticks++;
    if (ticks > 14) { clearInterval(wheelTimer); finish(); return; }
    if (team) team.textContent = fName(fr[Math.floor(Math.random() * fr.length)]);
    if (era) era.textContent = `${DECADES[Math.floor(Math.random() * DECADES.length)]}er`;
  }, 70);
}

function attempt(fn) {
  try {
    app.draft = fn(app.draft);
    app.selCard = null;
    app.msg = '';
    if (isComplete(app.draft)) return go('lineup');
    spinAnimation();
  } catch (e) {
    app.msg = e.message;
    render();
  }
}

function draftScreen() {
  const d = app.draft;
  const filled = POSITIONS.filter((s) => d.slots[s]).length;
  const w = wheelText();
  const board = app.spinning
    ? h('div', { class: 'board spinning' }, 'Das Rad dreht…')
    : h('div', { class: 'board' }, d.current.players.map((p) =>
        playerCard(p, app.franchises, {
          selected: app.selCard === p.id,
          onClick: () => { app.selCard = app.selCard === p.id ? null : p.id; app.selSlot = null; render(); },
        })));
  const sel = app.selCard && d.current.players.find((p) => p.id === app.selCard);
  return h('main', { class: 'screen draft' },
    h('header', { class: 'bar' },
      h('span', { class: 'chip' }, `Pick ${Math.min(filled + 1, 5)}/5`),
      h('span', { class: 'chip dim' }, `Seed ${app.seed}`),
      teamRatingChip(),
    ),
    h('section', { class: `wheel${app.spinning ? ' spin' : ''}` },
      h('div', { class: 'wheel-team' }, w.team),
      h('div', { class: 'wheel-era' }, w.era)),
    h('div', { class: 'row tools' },
      h('button', { class: 'btn small', disabled: d.skips.team <= 0 || app.spinning, onclick: () => attempt(skipTeam) }, `Team-Skip (${d.skips.team})`),
      h('button', { class: 'btn small', disabled: d.skips.era <= 0 || app.decade || app.spinning, onclick: () => attempt(skipEra) }, `Ära-Skip (${d.skips.era})`),
      h('button', { class: 'btn small', disabled: d.undosLeft <= 0 || !d.picks.length || app.spinning, onclick: () => attempt(undoLastPick) }, `Undo (${d.undosLeft})`),
    ),
    app.msg && h('p', { class: 'notice' }, app.msg),
    board,
    h('p', { class: 'hint' }, sel ? `${sel.name} gewählt – tippe einen freien Slot.` : 'Tippe einen Spieler, dann einen Slot. Gesetzte Spieler tauschst du per Tipp auf zwei Slots.'),
    slotsView({ onPickSlot: (slot) => attempt((s) => pick(s, app.selCard, slot)) }),
  );
}

function teamRatingChip() {
  const t = team();
  return h('span', { class: 'chip accent' }, `Team ${t.rating.toFixed(1)} · ${t.chem.name}`);
}

// Shared by the draft and lineup screens.
function slotsView({ onPickSlot }) {
  const d = app.draft;
  const selPlayer = app.selCard && app.data.byId.get(app.selCard);
  return h('section', { class: 'slots' }, POSITIONS.map((slot) => {
    const id = d.slots[slot];
    const onTap = () => {
      if (!id && app.selCard && onPickSlot) return onPickSlot(slot);
      if (app.selSlot && app.selSlot !== slot) {
        app.draft = swapSlots(d, app.selSlot, slot);
        app.selSlot = null;
      } else if (id) {
        app.selSlot = app.selSlot === slot ? null : slot;
      }
      render();
    };
    const wrap = h('div', { class: 'slot' }, h('div', { class: 'slot-label' }, slot));
    wrap.append(id
      ? playerCard(app.data.byId.get(id), app.franchises, { slot, selected: app.selSlot === slot, onClick: onTap })
      : emptySlot(slot, { onClick: onTap, active: !!selPlayer, preview: selPlayer ? effectiveRating(selPlayer, slot) : null }));
    return wrap;
  }));
}

// ---------- lineup editor ----------
function chemPanel(t) {
  const roleNames = { rim_protector: 'Rim-Protector', shooter: 'Shooter', playmaker: 'Playmaker', rebounder: 'Rebounder', defender: 'Verteidiger' };
  return h('section', { class: `chem${t.chem.perfect ? ' perfect-chem' : ''}` },
    h('div', { class: 'chem-head' }, h('b', {}, t.chem.name), h('span', {}, `+${t.chem.bonus} Chemie`)),
    h('div', { class: 'chem-bar' }, CHEM.roles.map((r, i) => h('i', { class: i < t.chem.count ? 'on' : '' }))),
    h('ul', { class: 'roles' }, CHEM.roles.map((r) => {
      const slot = t.chem.roles[r];
      const p = slot && t.lineup.find((l) => l.slot === slot).player;
      return h('li', { class: slot ? 'ok' : 'no' }, h('span', {}, slot ? '✓' : '✗'), roleNames[r], h('em', {}, p ? `${p.name} (${slot})` : 'nicht besetzt'));
    })));
}

function coachPicker(editable) {
  const slots = app.draft.slots, byId = app.data.byId;
  if (!editable) {
    return h('p', { class: 'hint' }, `Coach: ${app.coach.name} (${app.coach.style}) · +${team().coachBonus}`);
  }
  return h('section', { class: 'coaches' }, COACHES.map((c) => {
    const bonus = buildTeam({ slots, byId, coach: c }).coachBonus;
    return h('button', { class: `coach${app.coach.id === c.id ? ' on' : ''}`, type: 'button', onclick: () => { app.coach = c; render(); } },
      h('b', {}, c.name), h('span', {}, c.style), h('em', {}, `+${bonus}`));
  }));
}

function strengthLine(t) {
  return h('div', { class: 'strength' },
    h('div', {}, h('small', {}, 'Rating'), h('b', {}, t.rating.toFixed(1))),
    h('div', {}, h('small', {}, 'Chemie'), h('b', {}, `+${t.chem.bonus}`)),
    h('div', {}, h('small', {}, 'Coach'), h('b', {}, `+${t.coachBonus}`)),
    h('div', { class: 'total' }, h('small', {}, 'Stärke'), h('b', {}, t.strength.toFixed(1))));
}

function lineupScreen() {
  const t = team();
  const inPlayoffs = app.lineupBack === 'playoffs';
  return h('main', { class: 'screen lineup' },
    h('h2', {}, inPlayoffs ? 'Lineup anpassen' : 'Lineup-Editor'),
    h('p', { class: 'lead' }, 'Tausche Spieler zwischen den Slots. Hauptposition 100 %, Nebenposition −3 %, falsche Position −8 % (und keine Chemie-Rolle).'),
    strengthLine(t),
    slotsView({}),
    chemPanel(t),
    h('h3', {}, inPlayoffs ? 'Coach' : 'Coach wählen'),
    coachPicker(!inPlayoffs),
    h('div', { class: 'row' },
      inPlayoffs
        ? h('button', { class: 'btn primary', onclick: () => go('playoffs') }, 'Zurück zu den Playoffs')
        : [h('button', { class: 'btn ghost', onclick: () => go('start') }, 'Abbrechen'),
           h('button', { class: 'btn primary', onclick: startSeason }, 'Saison starten')]),
  );
}

// ---------- season ----------
function startSeason() {
  app.season = simulateSeason({ seed: app.seed, rating: team().strength });
  app.seasonTeam = team();
  app.shown = 0;
  go('sim');
}

function simScreen() {
  const s = app.season;
  const rec = h('div', { class: 'record' });
  const ticker = h('ul', { class: 'ticker' });
  const bar = h('div', { class: 'bar-fill' });
  const paint = () => {
    const g = s.games[app.shown - 1];
    rec.textContent = g ? `${g.wins}–${g.losses}` : '0–0';
    bar.style.width = `${(app.shown / SIM.games) * 100}%`;
    ticker.replaceChildren(...s.games.slice(Math.max(0, app.shown - 8), app.shown).reverse().map((x) =>
      h('li', { class: x.win ? 'win' : 'loss' }, `Spiel ${x.n}`, h('span', {}, x.win ? 'W' : 'L'), h('em', {}, `vs. ${x.opp.toFixed(0)}`))));
  };
  const finish = () => { clearInterval(app.timer); go('result'); };
  if (reducedMotion()) app.shown = SIM.games;
  paint();
  if (app.shown >= SIM.games) setTimeout(finish, 0);
  else app.timer = setInterval(() => { app.shown++; paint(); if (app.shown >= SIM.games) { clearInterval(app.timer); setTimeout(finish, 700); } }, 60);
  return h('main', { class: 'screen sim' },
    h('h2', {}, 'Saison läuft'),
    rec, h('div', { class: 'bar-track' }, bar), ticker,
    h('button', { class: 'btn ghost', onclick: () => { app.shown = SIM.games; finish(); } }, 'Überspringen'),
  );
}

// ---------- result ----------
function resultScreen() {
  const s = app.season;
  const perfect = s.losses === 0;
  const copy = async (btn) => {
    try { await navigator.clipboard.writeText(shareLink()); btn.textContent = 'Link kopiert!'; } catch { btn.textContent = shareLink(); }
  };
  const shareBtn = h('button', { class: 'btn', onclick: () => copy(shareBtn) }, 'Seed-Link kopieren');
  return h('main', { class: 'screen result' },
    perfect && h('div', { class: 'perfect' }, '82–0 · PERFEKTE SAISON'),
    h('div', { class: 'record big' }, `${s.wins}–${s.losses}`),
    h('p', { class: 'lead' }, `Längste Siegesserie: ${s.streak} · Stärke ${app.seasonTeam.strength.toFixed(1)} (${app.seasonTeam.chem.name})`),
    h('section', { class: 'mini-lineup' }, POSITIONS.map((slot) => {
      const p = app.data.byId.get(app.draft.slots[slot]);
      return h('div', {}, h('b', {}, slot), ` ${p.name} `, h('em', {}, effectiveRating(p, slot).toFixed(0)));
    })),
    h('details', {}, h('summary', {}, 'Spiel-Log'),
      h('ol', { class: 'log' }, s.games.map((g) => h('li', { class: g.win ? 'win' : 'loss' }, `${g.win ? 'W' : 'L'} · Gegner ${g.opp.toFixed(0)} · ${g.wins}–${g.losses}`)))),
    h('div', { class: 'row' },
      shareBtn,
      qualifies(s.wins)
        ? h('button', { class: 'btn primary', onclick: startPlayoffs }, 'Playoffs')
        : h('p', { class: 'notice' }, `Playoffs verpasst (mind. ${PLAYOFFS.minWins} Siege nötig).`),
      h('button', { class: 'btn primary', onclick: () => { app.seed = Math.floor(Math.random() * 1e9); go('start'); } }, 'Neuer Run')),
  );
}

// ---------- playoffs ----------
function startPlayoffs() {
  app.po = { round: 0, results: [], live: null, over: null };
  app.lineupBack = 'playoffs';
  go('playoffs');
}

const codes = () => Object.keys(app.franchises);

function playRound() {
  const round = app.po.round;
  const opponent = opponentFor({ seed: app.seed, round, franchiseCodes: codes() });
  const series = simulateSeries({ seed: app.seed, round, strength: team().strength, opponent });
  app.po.live = { round, opponent, series, shown: 0 };
  render();
}

function finishRound() {
  const { round, opponent, series } = app.po.live;
  app.po.results.push({ round, opponent, series });
  app.po.live = null;
  if (!series.won) app.po.over = 'out';
  else if (round === PLAYOFFS.rounds.length - 1) app.po.over = 'champion';
  else app.po.round++;
  render();
}

function playoffsScreen() {
  const po = app.po, t = team();
  const live = po.live;
  if (live) {
    const total = live.series.games.length;
    if (reducedMotion()) live.shown = total;
    if (live.shown >= total) app.timer = setTimeout(finishRound, live.shown === total && !reducedMotion() ? 900 : 0);
    else app.timer = setTimeout(() => { live.shown++; render(); }, 650);
  }
  const rounds = PLAYOFFS.rounds.map((name, i) => {
    const res = po.results.find((r) => r.round === i);
    const isLive = live && live.round === i;
    const opp = res?.opponent ?? (isLive ? live.opponent : opponentFor({ seed: app.seed, round: i, franchiseCodes: codes() }));
    const shownGames = isLive ? live.series.games.slice(0, live.shown) : res?.series.games ?? [];
    const score = shownGames.length ? `${shownGames.at(-1).team}–${shownGames.at(-1).opp}` : '';
    const state = res ? (res.series.won ? 'won' : 'lost') : isLive ? 'live' : i === po.round && !po.over ? 'next' : 'pending';
    return h('li', { class: `round ${state}` },
      h('div', { class: 'round-name' }, name),
      h('div', { class: 'round-opp' }, `${app.franchises[opp.franchise]?.name ?? opp.franchise} · ${opp.rating}`),
      h('div', { class: 'round-games' }, shownGames.map((g) => h('i', { class: g.win ? 'w' : 'l' }, g.win ? 'W' : 'L'))),
      h('div', { class: 'round-score' }, score));
  });
  return h('main', { class: 'screen playoffs' },
    h('h2', {}, 'Playoffs'),
    po.over === 'champion' && h('div', { class: 'perfect' }, 'CHAMPION'),
    po.over === 'out' && h('div', { class: 'out' }, `Ausgeschieden: ${PLAYOFFS.rounds[po.results.at(-1).round]}`),
    h('p', { class: 'lead' }, `Dein Team: Stärke ${t.strength.toFixed(1)} (${t.chem.name})`),
    h('ol', { class: 'rounds' }, rounds),
    !po.over && !live && h('p', { class: 'hint' }, 'Zwischen den Runden darfst du dein Lineup umstellen. Chemie und Stärke werden neu berechnet.'),
    h('div', { class: 'row' },
      po.over
        ? [h('button', { class: 'btn ghost', onclick: () => go('result') }, 'Zur Saison'),
           h('button', { class: 'btn primary', onclick: () => { app.seed = Math.floor(Math.random() * 1e9); go('start'); } }, 'Neuer Run')]
        : live
          ? h('button', { class: 'btn ghost', onclick: () => { clearTimeout(app.timer); live.shown = live.series.games.length; render(); } }, 'Überspringen')
          : [h('button', { class: 'btn', onclick: () => go('lineup') }, 'Lineup anpassen'),
             h('button', { class: 'btn primary', onclick: playRound }, `${PLAYOFFS.rounds[po.round]} spielen`)]),
  );
}
