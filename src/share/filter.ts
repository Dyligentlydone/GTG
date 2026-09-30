// A small local offensive-word filter for text that goes on a public card (SPEC §9.2).
// Whole words only (so "Scunthorpe" or "assessment" pass), case-insensitive, with common
// letter-for-symbol swaps and simple suffixes (s, es, ed, er, ers, ing, y) caught.

const BLOCKED = [
  'fuck', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt', 'asshole', 'arsehole', 'bastard',
  'dick', 'dickhead', 'cock', 'pussy', 'twat', 'wanker', 'prick', 'whore', 'slut', 'fag', 'faggot',
  'nigger', 'nigga', 'retard', 'spic', 'kike', 'chink', 'tranny',
];

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't' };

const PATTERN = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${BLOCKED.join('|')})(?:s|es|ed|er|ers|ing|y)?(?=$|[^\\p{L}\\p{N}])`, 'iu');

export type FilterResult = { ok: true } | { ok: false; reason: string };

export const FILTER_REASON = 'That wording can’t go on a public card. Try rephrasing your takeaway in your own clean words.';

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[01!34@5$7]/g, (c) => SWAPS[c] ?? c)
    // "f.u.c.k" / "s h i t": collapse single letters separated by dots, dashes or spaces.
    .replace(/\b(?:\p{L}[\s.\-_]){2,}\p{L}\b/gu, (m) => m.replace(/[\s.\-_]/g, ''));
}

/** Checks text for the public card; returns a player-friendly reason when it fails. */
export function checkPublicText(text: string): FilterResult {
  const candidates = [text.toLowerCase(), normalize(text)];
  // f*ck, sh*t: try each vowel behind a masking star.
  if (text.includes('*')) for (const v of 'aeiou') candidates.push(normalize(text.replace(/(\p{L})\*+(\p{L})/gu, `$1${v}$2`)));
  if (candidates.some((c) => PATTERN.test(c))) return { ok: false, reason: FILTER_REASON };
  return { ok: true };
}

export const checkTakeaway = checkPublicText;
