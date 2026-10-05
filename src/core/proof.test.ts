import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckIn, validateProof, wordCount } from './proof';
import type { ProofSpec } from './types';
import { fixtureEnv, fixtureGame } from './testing/fixtureGame';
import { zonedTimeToUtc } from './time';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const bad = (r: { ok: boolean }) => assert.equal(r.ok, false, JSON.stringify(r));
const good = (r: { ok: boolean }) => assert.equal(r.ok, true, JSON.stringify(r));

describe('reading', () => {
  const spec = { type: 'reading', targetPages: 10 } as const;
  const valid = { pages: 10, bookId: 'b1', takeaway: 'Small habits compound daily.' };
  test('valid', () => good(validateProof(spec, valid)));
  test('pages below target', () => {
    const r = validateProof(spec, { ...valid, pages: 9 });
    assert.deepEqual(r, { ok: false, reason: 'Read at least 10 pages (you logged 9).' });
  });
  test('book required', () => bad(validateProof(spec, { ...valid, bookId: '' })));
  test('takeaway required, 10–200 chars, one line', () => {
    bad(validateProof(spec, { ...valid, takeaway: undefined }));
    bad(validateProof(spec, { ...valid, takeaway: 'too short' })); // 9 chars
    good(validateProof(spec, { ...valid, takeaway: 'ten chars!' }));
    good(validateProof(spec, { ...valid, takeaway: 'x'.repeat(200) }));
    bad(validateProof(spec, { ...valid, takeaway: 'x'.repeat(201) }));
    bad(validateProof(spec, { ...valid, takeaway: 'first line\nsecond line' }));
  });
  test('non-numeric pages rejected', () => bad(validateProof(spec, { ...valid, pages: '10' })));
});

test('duration', () => {
  const spec = { type: 'duration', minMinutes: 20 } as const;
  good(validateProof(spec, { minutes: 20, activity: 'run' }));
  bad(validateProof(spec, { minutes: 19, activity: 'run' }));
  bad(validateProof(spec, { minutes: 45, activity: '  ' }));
});

test('journal needs ≥ 50 words or a scanned page', () => {
  const spec = { type: 'journal', minWords: 50 } as const;
  good(validateProof(spec, { text: words(50) }));
  bad(validateProof(spec, { text: words(49) }));
  good(validateProof(spec, { scanPath: '01234567-89ab-cdef-0123-456789abcdef/1700000000000.jpg' }));
  bad(validateProof(spec, { scanPath: '../escape.jpg' }));
  bad(validateProof(spec, { scanPath: 'not-a-path' }));
  assert.equal(wordCount('  one\ttwo\n three  '), 3);
});

test('timer: 300 seconds or a one-line reflection', () => {
  const spec = { type: 'timer', minSeconds: 300 } as const;
  good(validateProof(spec, { seconds: 300 }));
  bad(validateProof(spec, { seconds: 299 }));
  good(validateProof(spec, { seconds: 60, reflection: 'Calm.' }));
  bad(validateProof(spec, { reflection: 'ok' }));
  bad(validateProof(spec, { reflection: 'two\nlines' }));
});

test('text: one line 3–200 chars', () => {
  const spec = { type: 'text' } as const;
  good(validateProof(spec, { text: 'Called mom' }));
  bad(validateProof(spec, { text: 'hi' }));
  bad(validateProof(spec, { text: 'x'.repeat(201) }));
  bad(validateProof(spec, { text: 'a\r\nb c d' }));
  bad(validateProof(spec, {}));
});

test('photo_optional: note 3–200, photos optional string refs', () => {
  const spec = { type: 'photo_optional' } as const;
  good(validateProof(spec, { note: 'Cleared desk' }));
  good(validateProof(spec, { note: 'Cleared desk', photos: ['before.jpg', 'after.jpg'] }));
  bad(validateProof(spec, { note: 'ok' }));
  bad(validateProof(spec, { note: 'Cleared desk', photos: [42] }));
});

test('metrics: every field needs a finite, non-negative number (0 counts)', () => {
  const spec: ProofSpec = { type: 'metrics', fields: [{ key: 'netWorth', label: 'Net worth' }, { key: 'cashOnHand', label: 'Cash on hand' }] };
  good(validateProof(spec, { netWorth: 12500, cashOnHand: 0 }));
  bad(validateProof(spec, { netWorth: 12500 }));
  bad(validateProof(spec, { netWorth: -5, cashOnHand: 10 }));
  bad(validateProof(spec, { netWorth: '12500', cashOnHand: 10 }));
  bad(validateProof(spec, { netWorth: NaN, cashOnHand: 10 }));
});

test('dawn requires a window and a 3–140 char intention', () => {
  const window = { opensAt: '2026-01-01T09:00:00.000Z', closesAt: '2026-01-01T12:00:00.000Z', source: 'fallback', date: '2026-01-01' } as const;
  good(validateProof({ type: 'dawn' }, { intention: 'Focus' }, { dawnWindow: window }));
  bad(validateProof({ type: 'dawn' }, { intention: 'Focus' }, { dawnWindow: null }));
  bad(validateProof({ type: 'dawn' }, { intention: 'x'.repeat(141) }, { dawnWindow: window }));
});

describe('validateCheckIn applies stage targets and the dawn window', () => {
  const read = fixtureGame.quests.find((q) => q.id === 'fx.read')!;
  const dawn = fixtureGame.quests.find((q) => q.id === 'fx.dawn')!;
  const env = fixtureEnv({ lat: 9.93, lon: -84.08 });
  const tz = 'America/Costa_Rica';
  const payload = { pages: 5, bookId: 'b1', takeaway: 'Start small, stay steady.' };

  test('initiate stage needs 5 pages; later stages need 10', () => {
    good(validateCheckIn(read, payload, zonedTimeToUtc('2026-01-06', '20:00', tz), env));
    bad(validateCheckIn(read, payload, zonedTimeToUtc('2026-01-13', '20:00', tz), env));
  });

  test('San José dawn: 02:59 and 06:30 rejected, 05:30 accepted', () => {
    // Sunrise in San José on 2026-06-21 is ~05:17, so the window is 03:00–06:00.
    const p = { intention: 'Be kind' };
    bad(validateCheckIn(dawn, p, zonedTimeToUtc('2026-06-21', '02:59', tz), env));
    const r = validateCheckIn(dawn, p, zonedTimeToUtc('2026-06-21', '05:30', tz), env);
    assert.deepEqual(r, { ok: true, localDate: '2026-06-21' });
    bad(validateCheckIn(dawn, p, zonedTimeToUtc('2026-06-21', '06:30', tz), env));
  });
});
