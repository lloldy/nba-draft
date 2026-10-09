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
