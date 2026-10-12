// Historical team names (Seattle SuperSonics, Washington Bullets ...). The game groups players by modern
// franchise; this only decides what is SHOWN. `teams` = { SEA: { name, franchise, primary?, secondary? } }.

// The team name that fits a board best: the one most of its players played for (ties: the best player's team).
export function boardTeam(players) {
  const count = new Map();
  for (const p of players) if (p.team) count.set(p.team, (count.get(p.team) ?? 0) + 1);
  if (!count.size) return null;
  const top = Math.max(...count.values());
  return [...players].sort((a, b) => b.rating - a.rating).find((p) => p.team && count.get(p.team) === top).team;
}

export const teamName = (teams, abbr, fallback) => teams?.[abbr]?.name ?? fallback;

// Colours of a team: the historical override if there is one, otherwise the franchise colours.
export function teamColors(teams, franchises, abbr, franchise) {
  const t = teams?.[abbr];
  const f = franchises[franchise] ?? { primary: '#444', secondary: '#888' };
  return { primary: t?.primary ?? f.primary, secondary: t?.secondary ?? f.secondary };
}
