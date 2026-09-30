// Dawn window (SPEC §4.3): "Wake up before the sun rises".
import type { Instant, InstantLike, LocalDate, PlayerContext, WindowRule } from './types';
import { addDays, localDate, parseLocalTime, toMs, zonedTimeToUtc } from './time';
import { sunriseUtc } from './sunrise';

export type BeforeSunriseRule = Extract<WindowRule, { kind: 'before_sunrise' }>;

export const DEFAULT_DAWN_RULE: BeforeSunriseRule = {
  kind: 'before_sunrise', fallbackLocalTime: '06:00', earliestLocalTime: '03:00',
};

export interface DawnWindow {
  opensAt: Instant;
  closesAt: Instant;
  /** What decided `closesAt`. */
  source: 'custom' | 'sunrise' | 'fallback';
  /** The local date this window belongs to (the completion's local date for counting). */
  date: LocalDate;
}

function minutesOf(time: string): number {
  const { hour, minute } = parseLocalTime(time);
  return hour * 60 + minute;
}

export function dawnWindow(date: LocalDate, ctx: PlayerContext, rule: BeforeSunriseRule = DEFAULT_DAWN_RULE): DawnWindow {
  const tz = ctx.timeZone;
  const custom = ctx.customWakeWindow;
  if (custom) {
    // A window whose end is not after its start crosses midnight (night-shift workers).
    const endDate = minutesOf(custom.end) <= minutesOf(custom.start) ? addDays(date, 1) : date;
    return {
      opensAt: zonedTimeToUtc(date, custom.start, tz),
      closesAt: zonedTimeToUtc(endDate, custom.end, tz),
      source: 'custom',
      date,
    };
  }
  const opensAt = zonedTimeToUtc(date, rule.earliestLocalTime, tz);
  const fallback = zonedTimeToUtc(date, rule.fallbackLocalTime, tz);
  const sunrise = ctx.lat !== undefined && ctx.lon !== undefined ? sunriseUtc(date, ctx.lat, ctx.lon) : null;
  const useSunrise = sunrise !== null && toMs(sunrise) > toMs(fallback);
  return { opensAt, closesAt: useSunrise ? sunrise : fallback, source: useSunrise ? 'sunrise' : 'fallback', date };
}

/** `opensAt <= completedAt < closesAt`. */
export function isInDawnWindow(completedAt: InstantLike, window: DawnWindow): boolean {
  const t = toMs(completedAt);
  return toMs(window.opensAt) <= t && t < toMs(window.closesAt);
}

/**
 * The dawn window containing `completedAt`, or null. Checks the window of the completion's
 * local date and of the previous date (a custom window may cross midnight).
 */
export function dawnWindowFor(completedAt: InstantLike, ctx: PlayerContext, rule: BeforeSunriseRule = DEFAULT_DAWN_RULE): DawnWindow | null {
  const today = localDate(completedAt, ctx.timeZone);
  for (const date of [today, addDays(today, -1)]) {
    const w = dawnWindow(date, ctx, rule);
    if (isInDawnWindow(completedAt, w)) return w;
  }
  return null;
}
