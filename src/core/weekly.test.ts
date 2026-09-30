import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { closeWeek, computeWeekResult, isFullSetDay, memoryWeekResultStore, weekClosesAt } from './weekly';
import { applyChisel, chiselPieces, MAX_PIECES_PER_WEEK, STATUE_PIECES } from './chisel';
import { questWeekSchedule } from './schedule';
import { completion, fixtureEnv, fixtureGame } from './testing/fixtureGame';
import { addDays, zonedTimeToUtc } from './time';
import type { Completion, EngineEnv } from './types';

const FULL = '2026-01-26'; // week 4 → full protocol

/** Every due slot of a week, interleaved so taking a prefix spreads misses across quests. */
function slots(env: EngineEnv, week: string): Completion[] {
  const perQuest = fixtureGame.quests.map((q) => {
    const s = questWeekSchedule(q, week, env);
    return s.activeDays.slice(0, s.due).map((d) => completion(q.id, d));
  });
  const out: Completion[] = [];
  for (let i = 0; i < 7; i++) for (const list of perQuest) { const c = list[i]; if (c) out.push(c); }
  return out;
}

describe('chisel tiers', () => {
  test('worked example at full protocol (due = 42)', () => {
    const env = fixtureEnv();
    const all = slots(env, FULL);
    assert.equal(all.length, 42);
    const expected: Array<[number, number]> = [[42, 5], [32, 5], [31, 2], [21, 2], [20, 1], [11, 1], [10, 0], [0, 0]];
    for (const [done, pieces] of expected) {
      const r = computeWeekResult(env, FULL, all.slice(0, done));
      assert.equal(r.due, 42);
      assert.equal(r.done, done);
      assert.equal(r.pieces, pieces, `${done}/42 → ${pieces}`);
    }
    assert.equal(computeWeekResult(env, FULL, all.slice(0, 32)).completionPct.toFixed(3), '0.762');
  });

  test('tier boundaries are exact', () => {
    assert.equal(chiselPieces(3, 4), 5);
    assert.equal(chiselPieces(1, 2), 2);
    assert.equal(chiselPieces(1, 4), 1);
    assert.equal(chiselPieces(0, 4), 0);
    assert.equal(chiselPieces(0, 0), 0);
    assert.equal(chiselPieces(99, 4), 5); // over-reporting is capped
  });

  test('never more than 5 per week, never past 120', () => {
    assert.deepEqual(applyChisel(0, 5), { applied: 5, piecesRevealed: 5, complete: false });
    assert.equal(applyChisel(0, 9).applied, MAX_PIECES_PER_WEEK);
    assert.deepEqual(applyChisel(118, 5), { applied: 2, piecesRevealed: 120, complete: true });
    assert.deepEqual(applyChisel(120, 5), { applied: 0, piecesRevealed: 120, complete: true });
    assert.equal(applyChisel(-3, 1).piecesRevealed, 1);
    let revealed = 0;
    for (let w = 0; w < 30; w++) {
      const step = applyChisel(revealed, 5);
      assert.ok(step.applied <= 5);
      revealed = step.piecesRevealed;
      if (w === 23) assert.equal(revealed, STATUE_PIECES);
    }
    assert.equal(revealed, STATUE_PIECES);
  });
});

describe('week result', () => {
  test('perfect full-protocol week earns every weekly bonus', () => {
    const env = fixtureEnv();
    const r = computeWeekResult(env, FULL, slots(env, FULL));
    assert.equal(r.stage, 'full_protocol');
    assert.equal(r.weekIndex, 4);
    assert.equal(r.perfectWeek, true);
    assert.equal(r.balancedWeek, true);
    assert.equal(r.innerBalance, true);
    assert.equal(r.outerBalance, true);
    assert.equal(r.pieces, 5);
    const bySource = (s: string) => r.bonusXp.filter((e) => e.sourceType === s);
    assert.equal(bySource('perfect_week')[0]?.amount, 250);
    assert.equal(bySource('balanced_week')[0]?.amount, 100);
    assert.equal(bySource('inner_balance')[0]?.amount, 50);
    assert.equal(bySource('outer_balance')[0]?.amount, 50);
    assert.ok(r.fullSetDays.length > 0);
    assert.ok(bySource('full_set').every((e) => e.amount === 25));
  });

  test('extra completions never over-count and do not make a week perfect', () => {
    const env = fixtureEnv();
    const extra = Array.from({ length: 10 }, (_, i) => completion('fx.exercise', addDays(FULL, i % 7)));
    const r = computeWeekResult(env, FULL, extra);
    assert.equal(r.done, 4);
    assert.equal(r.perfectWeek, false);
    assert.equal(r.quests.find((l) => l.questId === 'fx.exercise')?.completions, 10);
  });

  test('balanced week needs a completion in every pillar; one miss breaks perfect but not balance', () => {
    const env = fixtureEnv();
    const all = slots(env, FULL);
    const r = computeWeekResult(env, FULL, all.slice(0, 40));
    assert.equal(r.perfectWeek, false);
    assert.equal(r.balancedWeek, true);
    const noPlay = all.filter((c) => c.questId !== 'fx.play');
    const r2 = computeWeekResult(env, FULL, noPlay);
    assert.equal(r2.balancedWeek, false);
    assert.equal(r2.outerBalance, false);
    assert.equal(r2.innerBalance, true);
  });

  test('before all pillars unlock: balancedWeek false; inner balance possible from week 2', () => {
    const env = fixtureEnv();
    const w1 = computeWeekResult(env, '2026-01-05', slots(env, '2026-01-05'));
    assert.equal(w1.stage, 'initiate');
    assert.deepEqual(w1.quests.map((l) => l.pillar).sort(), ['mental', 'physical', 'physical']);
    assert.equal(w1.perfectWeek, true);
    assert.equal(w1.balancedWeek, false);
    assert.equal(w1.innerBalance, false);
    const w2 = computeWeekResult(env, '2026-01-12', slots(env, '2026-01-12'));
    assert.equal(w2.innerBalance, true);
    assert.equal(w2.outerBalance, false);
    assert.equal(w2.balancedWeek, false);
    const w3 = computeWeekResult(env, '2026-01-19', slots(env, '2026-01-19'));
    assert.equal(w3.outerBalance, false); // environmental/recreational still locked
  });

  test('prorated first week for a Wednesday joiner', () => {
    const env = fixtureEnv({ joinedAt: zonedTimeToUtc('2026-01-07', '10:00', 'America/Costa_Rica') });
    const r = computeWeekResult(env, '2026-01-05', []);
    assert.equal(r.due, 5 + 2 + 2); // read 5 days; exercise ceil(2*5/7)=2; dawn 2
    assert.equal(r.pieces, 0);
    assert.equal(r.skipped, false);
  });

  test('paused days shrink due; percentage unaffected', () => {
    const paused = ['2026-01-27', '2026-01-28', '2026-01-29'];
    const env = fixtureEnv({ pausedDates: paused });
    const r = computeWeekResult(env, FULL, slots(env, FULL));
    assert.ok(r.due < 42);
    assert.equal(r.completionPct, 1);
    assert.equal(r.pieces, 5);
  });

  test('zero due is a skipped week: 0 pieces, no penalty, not perfect', () => {
    const env = fixtureEnv({ pausedDates: Array.from({ length: 7 }, (_, i) => addDays(FULL, i)) });
    const r = computeWeekResult(env, FULL, []);
    assert.equal(r.skipped, true);
    assert.equal(r.completionPct, 0);
    assert.equal(r.pieces, 0);
    assert.equal(r.perfectWeek, false);
    assert.deepEqual(r.bonusXp, []);
  });

  test('Full Set day: all daily quests + every weekly quest whose quota is still open', () => {
    const env = fixtureEnv();
    const day = '2026-01-26';
    const everything = fixtureGame.quests.map((q) => completion(q.id, day));
    assert.equal(isFullSetDay(day, env, everything), true);
    assert.equal(isFullSetDay(day, env, everything.filter((c) => c.questId !== 'fx.play')), false);
    // Once play's weekly quota (3) is met earlier in the week, it is no longer due that day.
    const later = '2026-01-30';
    const early = ['2026-01-26', '2026-01-27', '2026-01-28'].map((d) => completion('fx.play', d));
    const onLater = fixtureGame.quests.filter((q) => q.id !== 'fx.play').map((q) => completion(q.id, later));
    assert.equal(isFullSetDay(later, env, [...early, ...onLater]), true);
    // Paused day is never a Full Set day.
    const paused = fixtureEnv({ pausedDates: [day] });
    assert.equal(isFullSetDay(day, paused, everything), false);
  });
});

describe('closeWeek', () => {
  test('idempotent per user + week', () => {
    const env = fixtureEnv();
    const store = memoryWeekResultStore();
    const now = '2026-02-02T12:00:00Z';
    const cs = slots(env, FULL);
    const first = closeWeek({ env, weekStart: FULL, completions: cs, now }, store);
    const second = closeWeek({ env, weekStart: FULL, completions: [...cs, completion('fx.read', FULL)], now }, store);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.strictEqual(second.result, first.result);
    assert.equal(store.size(), 1);
    const other = closeWeek({ env: fixtureEnv({ userId: 'u2' }), weekStart: FULL, completions: [], now }, store);
    assert.equal(other.created, true);
    assert.equal(store.size(), 2);
  });

  test('refuses to close a week before Monday 00:00 local', () => {
    const env = fixtureEnv();
    const closes = weekClosesAt(FULL, env.ctx.timeZone);
    assert.equal(closes, '2026-02-02T06:00:00.000Z');
    const store = memoryWeekResultStore();
    assert.throws(() => closeWeek({ env, weekStart: FULL, completions: [], now: '2026-02-02T05:59:59Z' }, store), RangeError);
    assert.equal(closeWeek({ env, weekStart: FULL, completions: [], now: closes }, store).created, true);
  });

  test('Auckland week closes while the US is still on Sunday', () => {
    const closes = weekClosesAt('2026-09-28', 'Pacific/Auckland');
    assert.equal(closes, '2026-10-04T11:00:00.000Z'); // Sun 07:00 in New York
  });

  test('only the player\'s own completions count', () => {
    const env = fixtureEnv();
    const r = computeWeekResult(env, FULL, slots(env, FULL).map((c) => ({ ...c, userId: 'someone-else' })));
    assert.equal(r.done, 0);
  });
});
