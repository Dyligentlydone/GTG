import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { activeDays, countedCompletions, dueCount, proratedQuota, questWeekSchedule } from './schedule';
import { effectiveQuest, stageForWeek, unlockDate, weekIndexOf, isUnlockedOn } from './ramp';
import { completion, fixtureEnv, fixtureGame } from './testing/fixtureGame';
import { zonedTimeToUtc } from './time';
import type { EngineEnv, QuestDef } from './types';

const quest = (id: string): QuestDef => {
  const found = fixtureGame.quests.find((x) => x.id === `fx.${id}`);
  if (!found) throw new Error(id);
  return found;
};
const FULL = '2026-01-26'; // week 4 for a player who joined Monday 2026-01-05

describe('ramp stages', () => {
  const env = fixtureEnv();
  test('week index and stage', () => {
    assert.equal(weekIndexOf('2026-01-05', env.ctx), 1);
    assert.equal(weekIndexOf('2026-01-11', env.ctx), 1);
    assert.equal(weekIndexOf('2026-01-12', env.ctx), 2);
    assert.equal(stageForWeek(fixtureGame.ramp, 1).id, 'initiate');
    assert.equal(stageForWeek(fixtureGame.ramp, 3).id, 'adept');
    assert.equal(stageForWeek(fixtureGame.ramp, 4).id, 'full_protocol');
    assert.equal(stageForWeek(fixtureGame.ramp, 40).id, 'full_protocol');
  });
  test('unlock dates follow stages', () => {
    assert.equal(unlockDate(quest('read').unlock, env), '2026-01-05');
    assert.equal(unlockDate(quest('journal').unlock, env), '2026-01-12');
    assert.equal(unlockDate(quest('money').unlock, env), '2026-01-19');
    assert.equal(unlockDate(quest('play').unlock, env), '2026-01-26');
    assert.equal(isUnlockedOn(quest('play'), '2026-01-25', env), false);
  });
  test('stage overrides targets', () => {
    const initiate = stageForWeek(fixtureGame.ramp, 1);
    assert.deepEqual(effectiveQuest(quest('read'), initiate).proof, { type: 'reading', targetPages: 5 });
    assert.equal(effectiveQuest(quest('exercise'), initiate).perWeek, 2);
    assert.equal(effectiveQuest(quest('exercise'), stageForWeek(fixtureGame.ramp, 4)).perWeek, 4);
  });
  test('composite and level unlocks', () => {
    const e: EngineEnv = { ...env, ctx: { ...env.ctx, level: 5 } };
    assert.equal(unlockDate({ kind: 'min_level', level: 6 }, e), null);
    assert.equal(unlockDate({ kind: 'min_level', level: 5 }, e), '2026-01-05');
    assert.equal(unlockDate({ kind: 'min_level', level: 6 }, { ...e, levelReachedOn: () => '2026-02-01' }), '2026-02-01');
    assert.equal(unlockDate({ kind: 'all', rules: [{ kind: 'ramp_stage', atLeast: 'adept' }, { kind: 'always' }] }, e), '2026-01-19');
    assert.equal(unlockDate({ kind: 'any', rules: [{ kind: 'ramp_stage', atLeast: 'adept' }, { kind: 'min_level', level: 99 }] }, e), '2026-01-19');
    assert.equal(unlockDate({ kind: 'all', rules: [{ kind: 'always' }, { kind: 'min_level', level: 99 }] }, e), null);
  });
});

describe('due counts', () => {
  test('full protocol worked example sums to 42', () => {
    const env = fixtureEnv();
    const dues = fixtureGame.quests.map((q) => dueCount(q, FULL, env));
    assert.deepEqual(dues, [7, 4, 5, 7, 5, 5, 3, 3, 3]);
    assert.equal(dues.reduce((a, b) => a + b, 0), 42);
  });

  test('joining on a Wednesday prorates week 1 (5 active days)', () => {
    const env = fixtureEnv({ joinedAt: zonedTimeToUtc('2026-01-07', '20:00', 'America/Costa_Rica') });
    assert.deepEqual(activeDays(quest('read'), '2026-01-05', env), ['2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']);
    assert.equal(dueCount(quest('read'), '2026-01-05', env), 5);
    assert.equal(dueCount(quest('exercise'), '2026-01-05', env), 2); // ceil(2*5/7) = 2
    assert.equal(dueCount(quest('dawn'), '2026-01-05', env), 2);
    assert.equal(dueCount(quest('journal'), '2026-01-05', env), 0); // locked in week 1
    assert.equal(questWeekSchedule(quest('journal'), '2026-01-05', env).unlocked, false);
  });

  test('join date uses the player time zone', () => {
    // 2026-01-07T03:00Z is still Tuesday 21:00 in Costa Rica
    const env = fixtureEnv({ joinedAt: '2026-01-07T03:00:00Z' });
    assert.equal(dueCount(quest('read'), '2026-01-05', env), 6);
  });

  test('paused days shrink due counts', () => {
    const env = fixtureEnv({ pausedDates: ['2026-01-27', '2026-01-28', '2026-01-29'] });
    assert.equal(dueCount(quest('read'), FULL, env), 4);
    assert.equal(dueCount(quest('exercise'), FULL, env), 3); // ceil(4*4/7)=ceil(2.29)=3
    assert.equal(dueCount(quest('dawn'), FULL, env), 3);     // ceil(5*4/7)=ceil(2.86)=3
    assert.equal(dueCount(quest('connect'), FULL, env), 2);  // ceil(3*4/7)=ceil(1.71)=2
  });

  test('a fully paused week has zero due', () => {
    const env = fixtureEnv({ pausedDates: ['2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01'] });
    assert.equal(fixtureGame.quests.reduce((s, q) => s + dueCount(q, FULL, env), 0), 0);
  });

  test('prorated quota is integer ceil', () => {
    assert.equal(proratedQuota(5, 7), 5);
    assert.equal(proratedQuota(3, 1), 1);
    assert.equal(proratedQuota(3, 0), 0);
    assert.equal(proratedQuota(4, 5), 3);
  });

  test('week must start on Monday', () => {
    assert.throws(() => dueCount(quest('read'), '2026-01-27', fixtureEnv()), RangeError);
  });
});

describe('counted completions', () => {
  test('extra workouts never over-count', () => {
    const cs = ['2026-01-26', '2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30'].map((d) => completion('fx.exercise', d));
    assert.equal(countedCompletions(quest('exercise'), FULL, cs, 4), 4);
  });
  test('daily quest counts at most one per local date', () => {
    const cs = [completion('fx.read', '2026-01-26'), completion('fx.read', '2026-01-26'), completion('fx.read', '2026-01-27')];
    assert.equal(countedCompletions(quest('read'), FULL, cs, 7), 2);
  });
  test('completions outside the week or for other quests are ignored', () => {
    const cs = [completion('fx.read', '2026-01-25'), completion('fx.read', '2026-02-02'), completion('fx.journal', '2026-01-27')];
    assert.equal(countedCompletions(quest('read'), FULL, cs, 7), 0);
  });
});
