import { COACHES } from '../core/coaches.js';
import { buildTeam } from '../core/team.js';

// All mutable UI state lives here. The core modules stay pure.
export const app = {
  data: null, // { players, byId, meta }
  franchises: {},
  teams: {}, // historical team names and colours by abbreviation
  screen: 'start',
  view: null, // browse pages: { kind: 'franchises' | 'franchise' | 'era', id }
  mode: 'free', // 'free' | 'daily' | 'challenge'
  hoopiq: false, // HoopIQ: stats hidden during the draft
  seed: 0,
  decade: null, // era mode: only this decade
  rule: null, // daily / challenge rule
  challenge: null, // parsed friend challenge { seed, era, rule, by, record }
  dailyDate: null,
  name: '',
  draft: null,
  selCard: null, // player id picked from the board
  selSlot: null, // slot picked for swapping
  spinning: false,
  msg: '',
  season: null,
  seasonTeam: null,
  coach: COACHES.at(-1), // chosen before the season
  po: null, // playoff state { round, results[], live, over }
  run: null, // finished run record (set when the summary is created)
  lineupBack: 'season', // where the lineup editor returns to
  timer: null,
};

const screens = {};
export const register = (name, fn) => { screens[name] = fn; };

export function render() {
  clearInterval(app.timer);
  document.getElementById('app').replaceChildren(screens[app.screen]());
  window.scrollTo(0, 0);
}

export function go(screen) {
  app.screen = screen;
  app.msg = '';
  render();
}

export const team = () => buildTeam({ slots: app.draft.slots, byId: app.data.byId, coach: app.coach });
export const fName = (code) => app.franchises[code]?.name ?? code;
export const tName = (abbr, franchise) => app.teams[abbr]?.name ?? fName(franchise);
