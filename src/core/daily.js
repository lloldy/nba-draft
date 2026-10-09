// Daily challenge helpers. Pure: storage is handled by the UI layer.
import { hashString } from './seed.js';
import { dailyRule } from './rules.js';

export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);

export function prevDate(dateStr) {
  return utcDate(new Date(Date.parse(`${dateStr}T00:00:00Z`) - 86400000));
}

export function dailyInfo(dateStr) {
  return { date: dateStr, seed: hashString(dateStr), rule: dailyRule(dateStr) };
}

export const emptyDaily = () => ({ last: null, streak: 0, best: 0, attempts: {} });

export const hasPlayed = (daily, dateStr) => !!daily.attempts[dateStr];

// Mark the attempt as used as soon as the daily draft starts (one try per day).
export const startAttempt = (daily, dateStr) => ({ ...daily, attempts: { ...daily.attempts, [dateStr]: { done: false } } });

// Finish the attempt; the streak grows when you also played yesterday.
export function finishAttempt(daily, dateStr, result) {
  const streak = daily.last === prevDate(dateStr) ? daily.streak + 1 : 1;
  return {
    last: dateStr,
    streak,
    best: Math.max(daily.best, streak),
    attempts: { ...daily.attempts, [dateStr]: { done: true, ...result } },
  };
}

// Streak to show today: it is still alive if you last finished today or yesterday.
export function currentStreak(daily, today) {
  return daily.last === today || daily.last === prevDate(today) ? daily.streak : 0;
}
