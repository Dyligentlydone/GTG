// Posting to X (SPEC §9.2): the intent URL, the 280-char rule (every URL counts as 23),
// and a suggested post text per scope — short, at most one #GamifyTheGrind hashtag.
import { primaryItem, type ShareCardModel } from './model';

export const MAX_POST_LENGTH = 280;
/** X wraps every URL in t.co; a posted URL always costs 23 characters. */
export const POST_URL_WEIGHT = 23;
export const SHARE_HASHTAG = '#GamifyTheGrind';
export const X_INTENT_BASE = 'https://x.com/intent/post';

const URL_RE = /https?:\/\/\S+/g;
const codePoints = (s: string): number => [...s].length;

/** Weighted post length: code points, with every URL counting as POST_URL_WEIGHT. */
export function postLength(text: string): number {
  let n = 0;
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    n += codePoints(text.slice(last, m.index));
    n += POST_URL_WEIGHT;
    last = m.index + m[0].length;
  }
  return n + codePoints(text.slice(last));
}

/** Total weighted length of a post once `url` is attached (the URL costs 23). */
export function postLengthWithUrl(text: string, url?: string): number {
  return postLength(text) + (url ? POST_URL_WEIGHT : 0);
}

export function fitsPost(text: string, url?: string): boolean {
  return postLengthWithUrl(text, url) <= MAX_POST_LENGTH;
}

/**
 * Trims text so it fits the 280-char budget (reserving 23 for `url` when given).
 * Cuts at the last word boundary before the limit and appends '…'.
 */
export function fitPostText(text: string, url?: string): string {
  const budget = MAX_POST_LENGTH - (url ? POST_URL_WEIGHT : 0);
  if (postLength(text) <= budget) return text;
  const chars = [...text];
  // Binary search the longest code-point prefix that fits with the ellipsis.
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (postLength(chars.slice(0, mid).join('')) <= budget - 1) lo = mid;
    else hi = mid - 1;
  }
  let cut = chars.slice(0, lo).join('').trimEnd();
  const lastSpace = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
  if (lastSpace > 0 && cut.length - lastSpace < 24) cut = cut.slice(0, lastSpace).trimEnd();
  return `${cut}…`;
}

export interface XIntentInput { text: string; url?: string; }

/**
 * `https://x.com/intent/post?text=…&url=…` with correct encoding. Text is trimmed to
 * fit the 280-char rule (the attached `url` counts as 23) rather than producing a
 * post X would reject.
 */
export function xIntentUrl({ text, url }: XIntentInput): string {
  const params = new URLSearchParams({ text: fitPostText(text, url) });
  if (url) params.set('url', url);
  return `${X_INTENT_BASE}?${params.toString()}`;
}

function baseText(model: ShareCardModel): string {
  switch (model.scope) {
    case 'takeaway': {
      const t = primaryItem(model, 'takeaway');
      return t.bookTitle ? `"${t.text}" — ${t.bookTitle}` : `"${t.text}"`;
    }
    case 'quest': {
      const q = primaryItem(model, 'quest');
      return `Quest complete: ${q.title} (+${q.xp} XP)`;
    }
    case 'custom_set':
      return `${model.items.length === 1 ? 'A win' : `${model.items.length} wins`} on the Protocol this week.`;
    case 'day': {
      const d = primaryItem(model, 'day');
      const day = d.dayNumber ? `Day ${d.dayNumber}` : 'Today';
      return d.fullSet
        ? `${day}: full set — every quest on the board. ${d.streak > 1 ? `${d.streak}-day streak.` : ''}`.trim()
        : `${day}: ${d.quests.length} ${d.quests.length === 1 ? 'quest' : 'quests'} done.`;
    }
    case 'week': {
      const w = primaryItem(model, 'week');
      const due = w.quests.reduce((s, q) => s + q.due, 0);
      const done = w.quests.reduce((s, q) => s + Math.min(q.done, q.due), 0);
      const pct = due > 0 ? Math.round((done / due) * 100) : 0;
      if (w.perfectWeek) return `Perfect week — everything on target, ${w.piecesChiseled} more pieces off the statue.`;
      return `Week closed at ${pct}%. ${w.piecesChiseled > 0 ? `${w.piecesChiseled} more ${w.piecesChiseled === 1 ? 'piece' : 'pieces'} off the statue.` : 'The marble waits.'}`;
    }
    case 'achievement': {
      const a = primaryItem(model, 'achievement');
      return `Achievement unlocked: ${a.name}.`;
    }
    case 'milestone': {
      const m = primaryItem(model, 'milestone');
      switch (m.kind) {
        case 'book_finished': return `Finished reading ${m.bookTitle ? `"${m.bookTitle}"` : 'another book'}.`;
        case 'chisel_day': return `Chisel Day: ${m.piecesThisWeek ?? 0} pieces fell. ${m.piecesRevealed}/120 revealed.`;
        case 'sculpture_halfway': return `Halfway there — 60 of 120 pieces off the marble.`;
        case 'face_reveal': return `The face emerges from the marble.`;
        case 'sculpture_complete': return `120/120 — the statue stands complete.`;
      }
    }
  }
}

/**
 * A suggested post for the card: short, no hashtag spam, at most one #GamifyTheGrind.
 * Always fits the 280-char budget with room reserved for the share-page URL.
 */
export function suggestedPostText(model: ShareCardModel): string {
  const base = baseText(model);
  const tagged = `${base} ${SHARE_HASHTAG}`;
  if (postLength(tagged) <= MAX_POST_LENGTH - POST_URL_WEIGHT) return tagged;
  if (postLength(base) <= MAX_POST_LENGTH - POST_URL_WEIGHT) return base;
  return fitPostText(base, 'x');
}
