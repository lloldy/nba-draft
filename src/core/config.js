// Central place for every tunable number. Change balance here, nowhere else.

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

// Rating multiplier depending on how well a player fits the slot he is placed in.
export const POSITION_FIT = {
  primary: 1.0, // slot == main position
  secondary: 0.97, // slot is one of the alternative positions (-3%)
  off: 0.92, // anything else (-8%)
};

export const DEFAULT_SKIPS = { team: 1, era: 1 };
export const UNDO_PER_RUN = 1;
export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

// Spin odds: better and more famous boards (franchise + decade) come up more often.
// weight = exp((boardValue - average) / temperature); a LOWER temperature favours strong boards more,
// a very high one (e.g. 1e9) makes every board equally likely.
export const SPIN = {
  topN: 3, // boardValue looks at the N best players of a board
  fameWeight: 0.4, // how much their fans value (fame) counts next to the rating
  temperature: 25,
};

// Season simulation. Per game: P(win) = sigmoid((team - opponent) / scale).
export const SIM = {
  games: 82,
  oppMean: 88, // average opponent rating
  oppSpread: 6, // opponents range roughly oppMean +/- oppSpread
  scale: 8, // smaller = stronger teams win more reliably (steeper curve)
};

// Chemistry: five roles must each be covered by a DIFFERENT player who plays
// in a position that suits him (not an off-position slot).
export const CHEM = {
  roles: ['rim_protector', 'shooter', 'playmaker', 'rebounder', 'defender'],
  // index = number of covered roles
  levels: [
    { name: 'Keine Chemie', bonus: 0 },
    { name: 'Schwach', bonus: 0 },
    { name: 'Basis', bonus: 1 },
    { name: 'Gut', bonus: 2.5 },
    { name: 'Stark', bonus: 4 },
    { name: 'Perfect Team Chemistry', bonus: 6 },
  ],
  // thresholds used to derive archetype tags from stats (the data pipeline uses the same)
  tagRules: { rim_protector: 1.5, playmaker: 6, rebounder: 9, scorer: 22, defender: 1.5, shooter: 16 },
};

// Playoffs: 4 rounds, best of 7.
export const PLAYOFFS = {
  winsNeeded: 4,
  minWins: 41, // fewer regular-season wins = playoffs missed
  rounds: ['Runde 1', 'Conference Semis', 'Conference Finals', 'Finals'],
  oppBase: [89, 93, 97, 101], // opponent rating per round
  oppNoise: 3,
};

// Playoff injuries: before a round a random player may get hurt and sits out.
export const INJURY = {
  chance: [0.0375, 0.075, 0.0875, 0.0875], // probability per round (Runde 1 ... Finals); a quarter of the original odds
  durations: [1, 1, 2], // rounds missed; one is picked at random (so 1 is more likely)
  benchRating: 58, // the bench player who fills the slot until a replacement is spun (or if you decline the spin)
};
