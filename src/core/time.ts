// Time utilities (SPEC §4.1). Pure; IANA zones via Intl.DateTimeFormat only.
import type { Instant, InstantLike, LocalDate, LocalTime } from './types';

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMs(instant: InstantLike): number {
  const ms = typeof instant === 'number' ? instant
    : instant instanceof Date ? instant.getTime()
    : Date.parse(instant);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid instant: ${String(instant)}`);
  return ms;
}

export function toInstant(instant: InstantLike): Instant {
  return new Date(toMs(instant)).toISOString();
}

// ---------- local dates (calendar arithmetic, zone-free) ----------

export function isLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === value;
}

function dateToUtcMs(date: LocalDate): number {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

function utcMsToDate(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  return utcMsToDate(dateToUtcMs(date) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);
}

/** ISO day of week: 0 = Monday … 6 = Sunday. */
export function isoDayOfWeek(date: LocalDate): number {
  return (new Date(dateToUtcMs(date)).getUTCDay() + 6) % 7;
}

/** The Monday on or before `date`. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -isoDayOfWeek(date));
}

/** The seven dates Monday..Sunday of the week starting at `start` (must be a Monday). */
export function weekDates(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 'YYYY-MM' calendar month of a local date. */
export function monthOf(date: LocalDate): string {
  return date.slice(0, 7);
}

/** Inclusive range of dates from `from` to `to` (empty if from > to). */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = daysBetween(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate { return a >= b ? a : b; }
export function minDate(a: LocalDate, b: LocalDate): LocalDate { return a <= b ? a : b; }

// ---------- zone-aware conversions ----------

interface WallClock { year: number; month: number; day: number; hour: number; minute: number; second: number; }

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(ms: number, timeZone: string): WallClock {
  const out: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year ?? NaN, month: out.month ?? NaN, day: out.day ?? NaN,
    hour: (out.hour ?? NaN) % 24, minute: out.minute ?? NaN, second: out.second ?? NaN,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function localDate(instant: InstantLike, timeZone: string): LocalDate {
  const w = wallClock(toMs(instant), timeZone);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

export function localTime(instant: InstantLike, timeZone: string): LocalTime {
  const w = wallClock(toMs(instant), timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (e.g. -4h for EDT). */
export function tzOffsetMs(instant: InstantLike, timeZone: string): number {
  const ms = Math.floor(toMs(instant) / 1000) * 1000;
  const w = wallClock(ms, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - ms;
}

export function parseLocalTime(time: LocalTime): { hour: number; minute: number } {
  const m = TIME_RE.exec(time);
  if (!m) throw new RangeError(`Invalid local time: ${time}`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * Converts a local wall-clock time in `timeZone` to a UTC instant.
 * DST handling follows Temporal's 'compatible' disambiguation:
 * - a time repeated at fall-back resolves to the earlier (first) occurrence;
 * - a time skipped at spring-forward resolves forward by the gap (02:30 → 03:30 EDT).
 */
export function zonedTimeToUtc(date: LocalDate, time: LocalTime, timeZone: string): Instant {
  const { hour, minute } = parseLocalTime(time);
  const wallMs = dateToUtcMs(date) + (hour * 60 + minute) * 60_000;
  const before = tzOffsetMs(wallMs - DAY_MS, timeZone);
  const after = tzOffsetMs(wallMs + DAY_MS, timeZone);
  const valid = [...new Set([before, after])]
    .map((off) => wallMs - off)
    .filter((t) => tzOffsetMs(t, timeZone) === wallMs - t)
    .sort((a, b) => a - b);
  const chosen = valid[0] ?? wallMs - before; // gap: shift forward using the pre-transition offset
  return toInstant(chosen);
}

/** The instant a local date begins (00:00 local). */
export function startOfLocalDay(date: LocalDate, timeZone: string): Instant {
  return zonedTimeToUtc(date, '00:00', timeZone);
}
