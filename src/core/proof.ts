// Proof validation (SPEC §5). Every check-in payload is validated before it becomes a Completion.
import type { EngineEnv, InstantLike, ProofSpec, QuestDef } from './types';
import { effectiveQuest, stageForDate } from './ramp';
import { dawnWindowFor, DEFAULT_DAWN_RULE, type DawnWindow } from './dawn';
import { localDate } from './time';

export type ProofResult = { ok: true } | { ok: false; reason: string };

export const TAKEAWAY_MIN = 10;
export const TAKEAWAY_MAX = 200;
export const DEFAULT_TIMER_SECONDS = 300;
export const DEFAULT_JOURNAL_WORDS = 50;

const ok: ProofResult = { ok: true };
const fail = (reason: string): ProofResult => ({ ok: false, reason });

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === 'string' ? v : undefined;
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Character count in code points (so emoji count as one). */
export function charCount(s: string): number {
  return [...s].length;
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/u).filter(Boolean).length;
}

/** One line of `min..max` characters (after trimming), no line breaks. */
export function checkOneLine(value: string | undefined, label: string, min: number, max: number): ProofResult {
  if (value === undefined || value.trim() === '') return fail(`Please add ${label}.`);
  if (/[\r\n\u2028\u2029]/u.test(value)) return fail(`Keep ${label} to a single line.`);
  const n = charCount(value.trim());
  if (n < min) return fail(`${capitalize(label)} needs at least ${min} characters.`);
  if (n > max) return fail(`${capitalize(label)} can be at most ${max} characters (you have ${n}).`);
  return ok;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ProofOptions {
  /** Required for `dawn` proofs: the window the completion must fall inside. */
  dawnWindow?: DawnWindow | null;
}

/** Validates a payload against a (stage-effective) ProofSpec. */
export function validateProof(spec: ProofSpec, payload: Record<string, unknown>, opts: ProofOptions = {}): ProofResult {
  switch (spec.type) {
    case 'checkbox':
      return ok;
    case 'text':
      return checkOneLine(str(payload, 'text'), 'a short note', spec.minChars ?? 3, spec.maxChars ?? 200);
    case 'reading': {
      const pages = num(payload, 'pages');
      if (pages === undefined || !Number.isInteger(pages) || pages < 0) return fail('Enter how many pages you read.');
      if (pages < spec.targetPages) return fail(`Read at least ${spec.targetPages} pages (you logged ${pages}).`);
      const bookId = str(payload, 'bookId');
      if (!bookId || bookId.trim() === '') return fail('Pick the book you are reading.');
      return checkOneLine(str(payload, 'takeaway'), 'your one-line takeaway', TAKEAWAY_MIN, TAKEAWAY_MAX);
    }
    case 'duration': {
      const minutes = num(payload, 'minutes');
      if (minutes === undefined || minutes < 0) return fail('Enter how many minutes you spent.');
      if (minutes < spec.minMinutes) return fail(`Go for at least ${spec.minMinutes} minutes (you logged ${minutes}).`);
      const activity = str(payload, 'activity');
      if (!activity || activity.trim() === '') return fail('Say what you did.');
      return ok;
    }
    case 'dawn': {
      const w = opts.dawnWindow;
      if (!w) return fail('Too late (or too early) for this one — dawn check-ins count between 3:00 and sunrise (or 6:00).');
      return checkOneLine(str(payload, 'intention'), 'an intention for the day', 3, 140);
    }
    case 'journal': {
      // A scanned handwritten page counts too — ownership is verified server-side.
      const scanPath = str(payload, 'scanPath');
      if (scanPath !== undefined) {
        if (!/^[0-9a-f-]{36}\/[\w.-]+$/.test(scanPath)) return fail('The scanned page could not be found — retake it and try again.');
        return ok;
      }
      const text = str(payload, 'text') ?? '';
      const min = spec.minWords ?? DEFAULT_JOURNAL_WORDS;
      const words = wordCount(text);
      if (words < min) return fail(`Write at least ${min} words (you have ${words}), or scan a handwritten page.`);
      return ok;
    }
    case 'timer': {
      const minSeconds = spec.minSeconds ?? DEFAULT_TIMER_SECONDS;
      const seconds = num(payload, 'seconds');
      if (seconds !== undefined && seconds >= minSeconds) return ok;
      const reflection = str(payload, 'reflection');
      if (reflection !== undefined && reflection.trim() !== '') return checkOneLine(reflection, 'your reflection', 3, 200);
      return fail(`Sit for at least ${Math.ceil(minSeconds / 60)} minutes, or write a one-line reflection.`);
    }
    case 'photo_optional': {
      const note = checkOneLine(str(payload, 'note'), 'a short note', 3, 200);
      if (!note.ok) return note;
      const photos = payload.photos;
      if (photos !== undefined && (!Array.isArray(photos) || !photos.every((p) => typeof p === 'string' && p.length > 0))) {
        return fail('Photos could not be attached. Try again.');
      }
      return ok;
    }
    case 'metrics': {
      for (const f of spec.fields) {
        const v = num(payload, f.key);
        if (v === undefined || v < 0) return fail(`Enter a number for ${f.label.toLowerCase()} (0 counts).`);
      }
      return ok;
    }
  }
}

/**
 * Validates a check-in for a quest at `completedAt`: applies the week's ramp targets and,
 * for dawn quests, the player's dawn window. Returns the local date the completion belongs to.
 */
export function validateCheckIn(
  quest: QuestDef, payload: Record<string, unknown>, completedAt: InstantLike, env: EngineEnv,
): ProofResult & { localDate?: string } {
  const { ctx, game } = env;
  let date = localDate(completedAt, ctx.timeZone);
  let window: DawnWindow | null = null;
  if (quest.proof.type === 'dawn' || quest.window.kind === 'before_sunrise') {
    const rule = quest.window.kind === 'before_sunrise' ? quest.window : DEFAULT_DAWN_RULE;
    window = dawnWindowFor(completedAt, ctx, rule);
    if (!window) return fail('Too late (or too early) for this one — dawn check-ins count between 3:00 and sunrise (or 6:00).');
    date = window.date;
  }
  const spec = effectiveQuest(quest, stageForDate(game.ramp, date, ctx)).proof;
  const result = validateProof(spec, payload, { dawnWindow: window });
  return result.ok ? { ok: true, localDate: date } : result;
}
