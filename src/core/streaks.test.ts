import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, computeStreaks, perfectWeekStreak } from './streaks';
import { completion, fixtureEnv } from './testing/fixtureGame';
import { dateRange } from './time';
import type { Completion } from './types';
import type { WeekResult } from './weekly';

// Fixture player joined Monday 2026-01-05; fx.read is daily from day one, fx.journal from 2026-01-12.
const env = fixtureEnv();
const reads = (from: string, to: string, except: string[] = []) =>
  dateRange(from, to).filter((d) => !except.includes(d)).map((d) => completion('fx.read', d));
const repairDouble = (d: string): Completion[] => [completion('fx.read', d), completion('fx.read', d, { isRepair: true })];

describe('daily quest streaks', () => {
  test('consecutive days; today in progress never breaks', () => {
    const cs = reads('2026-01-05', '2026-01-10');
    assert.equal(computeStreak(env, 'fx.read', cs, '2026-01-10').current, 6);
    const r = computeStreak(env, 'fx.read', cs, '2026-01-11');
    assert.equal(r.current, 6);
    assert.equal(r.freezesLeftThisMonth, 2);
  });

  test('a missed day consumes a freeze automatically and the streak continues', () => {
    const cs = reads('2026-01-05', '2026-01-10', ['2026-01-08']);
    const out = computeStreaks(env, cs, '2026-01-10');
    assert.equal(out.streaks['fx.read']?.current, 6);
    assert.equal(out.freezesLeftThisMonth, 1);
    assert.deepEqual(out.freezesUsed, [{ date: '2026-01-08', month: '2026-01' }]);
  });

  test('two freezes per month; the third miss breaks unless repaired by a double day', () => {
    const misses = ['2026-01-08', '2026-01-11', '2026-01-14'];
    const base = reads('2026-01-05', '2026-01-16', misses);
    // No repair: broken on the 14th. On the 16th the 14th is still repairable (today is 14+2).
    const broken = computeStreak(env, 'fx.read', base, '2026-01-16');
    assert.equal(broken.current, 2);
    assert.equal(broken.longest, 9);
    assert.equal(broken.freezesLeftThisMonth, 0);
    assert.equal(broken.repairableDate, '2026-01-14');
    assert.equal(computeStreak(env, 'fx.read', base, '2026-01-17').repairableDate, undefined);

    // Double completion on the 15th (second one isRepair) restores the 14th.
    const repaired = [...base.filter((c) => c.localDate !== '2026-01-15'), ...repairDouble('2026-01-15')];
    const r = computeStreak(env, 'fx.read', repaired, '2026-01-16');
    assert.equal(r.current, 12);
    assert.equal(r.longest, 12);
    assert.equal(r.repairableDate, undefined);

    // Repair on the second day after also works (14 → 16).
    const late = [...base.filter((c) => c.localDate !== '2026-01-16'), ...repairDouble('2026-01-16')];
    assert.equal(computeStreak(env, 'fx.read', late, '2026-01-16').current, 12);
  });

  test('repair needs two completions; one flagged completion or a double three days later does not count', () => {
    const misses = ['2026-01-08', '2026-01-11', '2026-01-14'];
    const base = reads('2026-01-05', '2026-01-18', misses);
    const single = base.map((c) => (c.localDate === '2026-01-15' ? { ...c, isRepair: true } : c));
    assert.equal(computeStreak(env, 'fx.read', single, '2026-01-18').current, 4);
    const tooLate = [...base.filter((c) => c.localDate !== '2026-01-17'), ...repairDouble('2026-01-17')];
    assert.equal(computeStreak(env, 'fx.read', tooLate, '2026-01-18').current, 4);
  });

  test('one repair per missed day: a single double cannot restore two missed days', () => {
    const misses = ['2026-01-06', '2026-01-07', '2026-01-09', '2026-01-10'];
    // Jan 6 and 7 use the freezes (streak alive from the 5th). Jan 9 and 10 both missed.
    const cs = [...reads('2026-01-05', '2026-01-11', misses).filter((c) => c.localDate !== '2026-01-11'), ...repairDouble('2026-01-11')];
    const r = computeStreak(env, 'fx.read', cs, '2026-01-11');
    // The double on the 11th repairs the 9th; the 10th is still missed → broken, only the 11th counts.
    assert.equal(r.current, 1);
  });

  test('freezes reset each calendar month (player local)', () => {
    const misses = ['2026-01-26', '2026-01-28', '2026-02-02', '2026-02-04'];
    const cs = reads('2026-01-20', '2026-02-06', misses);
    const out = computeStreaks(env, cs, '2026-02-06');
    assert.equal(out.streaks['fx.read']?.current, 18);
    assert.equal(out.freezesLeftThisMonth, 0);
    assert.equal(out.freezesUsed.length, 4);
  });

  test('paused days extend a live streak but never start one; misses at 0 do not use freezes', () => {
    const e = fixtureEnv({ pausedDates: ['2026-01-05', '2026-01-08', '2026-01-09'] });
    const cs = reads('2026-01-06', '2026-01-10', ['2026-01-08', '2026-01-09']);
    const out = computeStreaks(e, cs, '2026-01-10');
    assert.equal(out.streaks['fx.read']?.current, 5); // 6,7 done + 8,9 paused + 10 done
    const out2 = computeStreaks(env, reads('2026-01-08', '2026-01-09'), '2026-01-09');
    assert.equal(out2.freezesLeftThisMonth, 2); // 5-7 missed before any streak existed
    assert.equal(out2.streaks['fx.read']?.current, 2);
  });

  test('one freeze covers every daily quest missed that date', () => {
    const both = (d: string) => [completion('fx.read', d), completion('fx.journal', d)];
    const cs = [...reads('2026-01-05', '2026-01-11'), ...both('2026-01-12'), ...both('2026-01-13'), ...both('2026-01-15')];
    const out = computeStreaks(env, cs, '2026-01-15');
    assert.equal(out.freezesUsed.length, 1);
    assert.equal(out.streaks['fx.read']?.current, 11);
    assert.equal(out.streaks['fx.journal']?.current, 4); // journal unlocked on the 12th
  });

  test('broken streak still reports longest', () => {
    const misses = ['2026-01-08', '2026-01-09', '2026-01-10'];
    const r = computeStreak(env, 'fx.read', reads('2026-01-05', '2026-01-20', misses), '2026-01-20');
    assert.equal(r.longest, 10); // 11..20
    const r2 = computeStreak(env, 'fx.read', reads('2026-01-05', '2026-01-12', ['2026-01-08', '2026-01-09', '2026-01-10']), '2026-01-20');
    assert.equal(r2.current, 0);
    assert.ok(r2.longest >= 4);
  });

  test('unknown quest throws', () => {
    assert.throws(() => computeStreak(env, 'fx.exercise', [], '2026-01-10'));
  });
});

describe('perfect week streak', () => {
  const wk = (weekStart: string, perfectWeek: boolean, skipped = false) => ({ weekStart, perfectWeek, skipped }) as WeekResult;
  test('consecutive perfect weeks; skipped weeks bridge; gaps break', () => {
    assert.deepEqual(perfectWeekStreak([wk('2026-01-05', true), wk('2026-01-12', true), wk('2026-01-19', false), wk('2026-01-26', true)]), { current: 1, longest: 2 });
    assert.deepEqual(perfectWeekStreak([wk('2026-01-05', true), wk('2026-01-12', false, true), wk('2026-01-19', true)]), { current: 2, longest: 2 });
    assert.deepEqual(perfectWeekStreak([wk('2026-01-05', true), wk('2026-01-19', true)]), { current: 1, longest: 1 });
    assert.deepEqual(perfectWeekStreak([]), { current: 0, longest: 0 });
  });
});
