import { h, reducedMotion } from './dom.js';
import { app, go, render, register, team, fName, tName } from './state.js';
import { boardTeam, teamColors } from '../core/teams.js';
import { playerCard, emptySlot } from './cards.js';
import { goSummary } from './summary.js';
import { POSITIONS, DECADES, SIM, CHEM, PLAYOFFS } from '../core/config.js';
import { pick, skipTeam, skipEra, swapSlots, undoLastPick, isComplete } from '../core/draft.js';
import { effectiveRating } from '../core/positions.js';
import { simulateSeason } from '../core/sim.js';
import { COACHES } from '../core/coaches.js';
import { buildTeam } from '../core/team.js';
import { confetti } from './confetti.js';
import { rollInjury, applyInjury, tickInjury, recoverPlayer, standIn, replacementSkips, leftoverSkips, replacementSeed, BENCH_ID } from '../core/injuries.js';
import { createDraft } from '../core/draft.js';
import { constraintsFor } from '../core/rules.js';
import { qualifies, opponentFor, opponentBoards, simulateSeries } from '../core/playoffs.js';

let wheelTimer = null;

// ---------- draft ----------
function wheelText() {
  const c = app.draft.current;
  return { team: tName(boardTeam(c.players), c.franchise), era: `${c.decade}er` };
}

// Cycle random teams, slowing down, then land on the real board.
export function spinAnimation() {
  clearTimeout(wheelTimer);
  const codes = Object.keys(app.franchises);
  const finish = () => {
    app.spinning = false;
    app.deal = true; // cards deal in and the wheel thunks - only on this render
    render();
    app.deal = false;
  };
  if (reducedMotion()) return finish();
  app.spinning = true;
  render();
  const teamEl = document.querySelector('.wheel-team'), eraEl = document.querySelector('.wheel-era'), wheel = document.querySelector('.wheel');
  let tick = 0;
  const TICKS = 16;
  const step = () => {
    if (tick++ >= TICKS) return finish();
    const code = codes[Math.floor(Math.random() * codes.length)];
    if (teamEl) teamEl.textContent = fName(code);
    if (eraEl) eraEl.textContent = `${DECADES[Math.floor(Math.random() * DECADES.length)]}er`;
    if (wheel) wheel.style.setProperty('--wc', app.franchises[code]?.primary ?? '#444');
    for (const el of [teamEl, eraEl]) { el?.classList.remove('tick'); void el?.offsetWidth; el?.classList.add('tick'); }
    wheelTimer = setTimeout(step, 55 + tick * tick * 1.1); // 55ms -> ~340ms
  };
  step();
}

function attempt(fn, popSlot = null) {
  try {
    app.draft = fn(app.draft);
    app.selCard = null;
    app.msg = '';
    app.pop = popSlot; // slot card pops in on the next render only
    navigator.vibrate?.(15);
    if (isComplete(app.draft)) {
      app.deal = app.hoopiq; // reveal: the cards deal in with all stats visible
      go('lineup');
      app.deal = false; app.pop = null;
      return;
    }
    spinAnimation();
    app.pop = null;
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
    : h('div', { class: 'board' }, d.current.players.map((p, i) =>
        playerCard(p, app.franchises, {
          deal: app.deal ? i : null,
          hidden: app.hoopiq,
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
    h('section', { class: `wheel${app.spinning ? ' spin' : ''}${app.deal ? ' landed' : ''}`, style: { '--wc': teamColors(app.teams, app.franchises, boardTeam(d.current.players), d.current.franchise).primary }, 'aria-live': 'polite' },
      h('div', { class: 'wheel-label' }, 'Team und Ära'),
      h('div', { class: 'wheel-team' }, w.team),
      h('div', { class: 'wheel-era' }, w.era)),
    h('div', { class: 'row tools' },
      h('button', { class: 'btn small', disabled: d.skips.team <= 0 || app.spinning, onclick: () => attempt(skipTeam) }, `Team-Skip (${d.skips.team})`),
      h('button', { class: 'btn small', disabled: d.skips.era <= 0 || app.decade || app.spinning, onclick: () => attempt(skipEra) }, `Ära-Skip (${d.skips.era})`),
      h('button', { class: 'btn small', disabled: d.undosLeft <= 0 || !d.picks.length || app.spinning, onclick: () => attempt(undoLastPick) }, `Undo (${d.undosLeft})`),
    ),
    ruleBanner(),
    app.msg && h('p', { class: 'notice' }, app.msg),
    board,
    h('p', { class: 'hint' }, sel ? `${sel.name} gewählt – tippe einen freien Slot.` : app.hoopiq ? 'HoopIQ: Stats sind versteckt. Vertrau deinem Wissen! Gesetzte Spieler tauschst du per Tipp auf zwei Slots.' : 'Tippe einen Spieler, dann einen Slot. Gesetzte Spieler tauschst du per Tipp auf zwei Slots.'),
    slotsView({ onPickSlot: (slot) => attempt((s) => pick(s, app.selCard, slot), slot) }),
  );
}

function ruleBanner() {
  const r = app.rule;
  if (!r) return null;
  const fans = POSITIONS.reduce((s, slot) => s + (app.draft.slots[slot] ? app.data.byId.get(app.draft.slots[slot]).fans ?? 0 : 0), 0);
  return h('div', { class: 'rule-banner' }, h('b', {}, r.label), ` – ${r.desc}`,
    r.id === 'fans300' && !app.hoopiq && h('span', { class: `fans${fans >= 300 ? ' over' : ''}` }, `Fans ${fans}/300`));
}

function teamRatingChip() {
  if (app.hoopiq) return h('span', { class: 'chip accent' }, 'HoopIQ-Modus');
  const t = team();
  return h('span', { class: 'chip accent' }, `Team ${t.rating.toFixed(1)} · ${t.chem.name}`);
}

// Shared by the draft and lineup screens.
function slotsView({ onPickSlot }) {
  const d = app.draft;
  const selPlayer = app.selCard && app.data.byId.get(app.selCard);
  const concealed = app.hoopiq && app.screen === 'draft';
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
      ? playerCard(app.data.byId.get(id), app.franchises, { slot, hidden: concealed, deal: app.deal ? POSITIONS.indexOf(slot) : null, pop: app.pop === slot, selected: app.selSlot === slot, onClick: onTap })
      : emptySlot(slot, { onClick: onTap, active: !!selPlayer, preview: selPlayer && !concealed ? effectiveRating(selPlayer, slot) : null }));
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
    inPlayoffs && app.po?.injured && h('div', { class: 'injury-note hurt' }, `🚑 ${playerName(app.po.injured.playerId)} fehlt noch ${app.po.injured.roundsLeft === 1 ? '1 Runde' : `${app.po.injured.roundsLeft} Runden`}.`),
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
  app.run = null;
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
  if (perfect) setTimeout(() => confetti({ count: 260 }), 200);
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
    qualifies(s.wins) ? null : h('p', { class: 'notice' }, `Playoffs verpasst (mind. ${PLAYOFFS.minWins} Siege nötig).`),
    h('div', { class: 'row' },
      qualifies(s.wins)
        ? h('button', { class: 'btn primary', onclick: startPlayoffs }, 'Playoffs')
        : h('button', { class: 'btn primary', onclick: goSummary }, 'Zusammenfassung')),
  );
}

// ---------- playoffs ----------
function startPlayoffs() {
  app.po = { round: 0, results: [], live: null, over: null, injured: null, notes: [] };
  app.lineupBack = 'playoffs';
  checkInjury();
  go('playoffs');
}

const playerName = (id) => app.data.byId.get(id).name;

// Before a round: maybe somebody gets hurt. The replacement takes his slot automatically.
function checkInjury() {
  const po = app.po;
  if (po.injured) return;
  const inj = rollInjury({ seed: app.seed, round: po.round, slots: app.draft.slots });
  if (!inj) return;
  const { slots, slot } = applyInjury(app.draft.slots, inj.playerId);
  app.draft = { ...app.draft, slots };
  po.injured = { ...inj, slot, standInId: BENCH_ID };
  po.notes.push({ kind: 'hurt', text: `${playerName(inj.playerId)} (${slot}) verletzt sich und fällt ${inj.roundsLeft === 1 ? 'für 1 Runde' : `für ${inj.roundsLeft} Runden`} aus.` });
  startReplacement();
}

// The replacement spin: one board, your leftover skips (or one random bonus skip), pick one player.
function startReplacement() {
  const po = app.po;
  const { skips, bonus } = replacementSkips(app.draft.skips, { seed: app.seed, round: po.round, allowEra: !app.decade });
  const names = new Set([...Object.values(app.draft.slots), po.injured.playerId].filter((id) => id && id !== BENCH_ID).map((id) => app.data.byId.get(id).name));
  const base = constraintsFor(app.rule, app.decade);
  try {
    const draft = createDraft({
      seed: replacementSeed(app.seed, po.round),
      players: app.data.players,
      skips,
      constraints: { ...base, allowPlayer: (p) => !names.has(p.name) && (!base.allowPlayer || base.allowPlayer(p)) },
    });
    po.replace = { draft, bonus, selected: null };
  } catch {
    po.replace = null; // no suitable board: the bench player stays
  }
}

function openReplacement() {
  app.deal = true; // cards deal in once
  go('replace');
  app.deal = false;
}

function finishReplacement(playerId) {
  const po = app.po;
  const rep = po.replace;
  if (playerId) {
    app.draft = { ...app.draft, slots: standIn(app.draft.slots, playerId) };
    po.injured = { ...po.injured, standInId: playerId };
    po.notes.push({ kind: 'back', text: `${playerName(playerId)} springt als Ersatz ein, bis ${playerName(po.injured.playerId)} zurück ist.` });
  }
  app.draft = { ...app.draft, skips: leftoverSkips(app.draft.skips, rep.draft.skips) };
  po.replace = null;
  go('playoffs');
}

function replaceSkip(fn) {
  try {
    app.po.replace.draft = fn(app.po.replace.draft);
    app.po.replace.selected = null;
    app.msg = '';
  } catch (e) { app.msg = e.message; }
  app.deal = true; render(); app.deal = false;
}

function replaceScreen() {
  const po = app.po, rep = po.replace, d = rep.draft;
  const hurt = playerName(po.injured.playerId);
  const sel = rep.selected && d.current.players.find((p) => p.id === rep.selected);
  const c = d.current;
  return h('main', { class: 'screen replace' },
    h('h2', {}, `Ersatz für ${hurt}`),
    h('p', { class: 'lead' }, `Wähle einen Spieler von diesem Board. Er springt ein, bis ${hurt} zurück ist.`),
    h('section', { class: `wheel${app.deal ? ' landed' : ''}`, style: { '--wc': teamColors(app.teams, app.franchises, boardTeam(c.players), c.franchise).primary } },
      h('div', { class: 'wheel-label' }, 'Team und Ära'),
      h('div', { class: 'wheel-team' }, tName(boardTeam(c.players), c.franchise)),
      h('div', { class: 'wheel-era' }, `${c.decade}er`)),
    h('div', { class: 'row tools' },
      h('button', { class: 'btn small', disabled: d.skips.team <= 0, onclick: () => replaceSkip(skipTeam) }, `Team-Skip (${d.skips.team})`),
      h('button', { class: 'btn small', disabled: d.skips.era <= 0 || app.decade, onclick: () => replaceSkip(skipEra) }, `Ära-Skip (${d.skips.era})`)),
    rep.bonus && h('p', { class: 'hint' }, `Du hattest keinen Skip mehr übrig, deshalb gibt es einen Bonus: ${rep.bonus === 'team' ? 'ein Team-Skip' : 'ein Ära-Skip'}.`),
    app.msg && h('p', { class: 'notice' }, app.msg),
    h('div', { class: 'board' }, c.players.map((p, i) =>
      playerCard(p, app.franchises, {
        deal: app.deal ? i : null,
        hidden: app.hoopiq,
        selected: rep.selected === p.id,
        onClick: () => { rep.selected = rep.selected === p.id ? null : p.id; render(); },
      }))),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => finishReplacement(null) }, 'Ersatzspieler von der Bank'),
      h('button', { class: 'btn primary', disabled: !sel, onclick: () => finishReplacement(sel.id) }, sel ? `${sel.name} verpflichten` : 'Spieler wählen')),
  );
}

// Between rounds: count the injury down, bring the player back, maybe a new injury.
function advanceInjuries() {
  const po = app.po;
  po.notes = [];
  const was = po.injured;
  const { injured, recovered } = tickInjury(po.injured);
  po.injured = injured;
  if (recovered) {
    app.draft = { ...app.draft, slots: recoverPlayer(app.draft.slots, was.playerId, was.standInId) };
    po.notes.push({ kind: 'back', text: `${playerName(was.playerId)} ist zurück und hat den Platz des Ersatzspielers übernommen.` });
  }
  checkInjury();
}

// Everybody is healthy again for the final summary.
export function healAll() {
  const po = app.po;
  if (!po?.injured) return;
  app.draft = { ...app.draft, slots: recoverPlayer(app.draft.slots, po.injured.playerId, po.injured.standInId) };
  po.injured = null;
  po.replace = null;
}

const codes = () => Object.keys(app.franchises);
let boardsCache = null;
const boards = () => (boardsCache ??= opponentBoards(app.data.players));
const oppFor = (round) => opponentFor({ seed: app.seed, round, franchiseCodes: codes(), boards: boards() });
const oppLabel = (o) => `${tName(o.team, o.franchise)}${o.decade ? ` ${o.decade}er` : ''}`;

function playRound() {
  const round = app.po.round;
  const opponent = oppFor(round);
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
  else { app.po.round++; advanceInjuries(); }
  render();
}

function playoffsScreen() {
  const po = app.po, t = team();
  const live = po.live;
  if (po.over === 'champion' && !po.celebrated) { po.celebrated = true; setTimeout(() => confetti({ count: 220 }), 200); }
  if (live) {
    const total = live.series.games.length;
    if (reducedMotion()) live.shown = total;
    if (live.shown >= total) app.timer = setTimeout(finishRound, live.shown === total && !reducedMotion() ? 900 : 0);
    else app.timer = setTimeout(() => { live.shown++; render(); }, 650);
  }
  const rounds = PLAYOFFS.rounds.map((name, i) => {
    const res = po.results.find((r) => r.round === i);
    const isLive = live && live.round === i;
    const opp = res?.opponent ?? (isLive ? live.opponent : oppFor(i));
    const shownGames = isLive ? live.series.games.slice(0, live.shown) : res?.series.games ?? [];
    const score = shownGames.length ? `${shownGames.at(-1).team}–${shownGames.at(-1).opp}` : '';
    const state = res ? (res.series.won ? 'won' : 'lost') : isLive ? 'live' : i === po.round && !po.over ? 'next' : 'pending';
    return h('li', { class: `round ${state}` },
      h('div', { class: 'round-name' }, name),
      h('div', { class: 'round-opp' }, `${oppLabel(opp)} · ${opp.rating}`),
      h('div', { class: 'round-games' }, shownGames.map((g) => h('i', { class: g.win ? 'w' : 'l' }, g.win ? 'W' : 'L'))),
      h('div', { class: 'round-score' }, score));
  });
  return h('main', { class: 'screen playoffs' },
    h('h2', {}, 'Playoffs'),
    po.over === 'champion' && h('div', { class: 'perfect' }, 'CHAMPION'),
    po.over === 'out' && h('div', { class: 'out' }, `Ausgeschieden: ${PLAYOFFS.rounds[po.results.at(-1).round]}`),
    h('p', { class: 'lead' }, `Dein Team: Stärke ${t.strength.toFixed(1)} (${t.chem.name})`),
    h('ol', { class: 'rounds' }, rounds),
    !po.over && !live && po.notes.map((n) => h('div', { class: `injury-note ${n.kind}` }, n.kind === 'hurt' ? '🚑 ' : '✅ ', n.text)),
    !po.over && !live && h('p', { class: 'hint' }, po.replace ? 'Spinne zuerst einen Ersatzspieler, dann geht es weiter.' : 'Zwischen den Runden darfst du dein Lineup umstellen. Chemie und Stärke werden neu berechnet.'),
    h('div', { class: 'row' },
      po.over
        ? [h('button', { class: 'btn ghost', onclick: () => go('result') }, 'Zur Saison'),
           h('button', { class: 'btn primary', onclick: goSummary }, 'Zusammenfassung')]
        : live
          ? h('button', { class: 'btn ghost', onclick: () => { clearTimeout(app.timer); live.shown = live.series.games.length; render(); } }, 'Überspringen')
          : po.replace
            ? h('button', { class: 'btn primary attention', onclick: openReplacement }, 'Ersatzspieler spinnen')
            : [h('button', { class: `btn${po.notes.some((n) => n.kind === 'hurt') ? ' attention' : ''}`, onclick: () => go('lineup') }, 'Lineup anpassen'),
               h('button', { class: 'btn primary', onclick: playRound }, `${PLAYOFFS.rounds[po.round]} spielen`)]),
  );
}

register('draft', draftScreen);
register('lineup', lineupScreen);
register('sim', simScreen);
register('result', resultScreen);
register('playoffs', playoffsScreen);
register('replace', replaceScreen);
