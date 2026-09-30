import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerStats, emptyStats, evaluateAchievements, isRuleMet } from './achievements';
import { computeWeekResult } from './weekly';
import { questWeekSchedule } from './schedule';
import { completion, fixtureEnv, fixtureGame } from './testing/fixtureGame';
import { addDays, dateRange } from './time';
import type { AchievementDef, Completion } from './types';

const defs: AchievementDef[] = [
  { id: 'bookworm', name: 'Bookworm', scope: 'mental', hidden: false, rule: { kind: 'count_quantity', questId: 'fx.read', field: 'pages', atLeast: 100 } },
  { id: 'first_light', name: 'First Light', scope: 'physical', hidden: false, rule: { kind: 'count_completions', questId: 'fx.dawn', atLeast: 1 } },
  { id: 'early_riser', name: 'Early Riser', scope: 'physical', hidden: false, rule: { kind: 'count_in_week', questId: 'fx.dawn', atLeast: 5 } },
  { id: 'finisher', name: 'Finisher', scope: 'mental', hidden: false, rule: { kind: 'count_events', event: 'book_finished', atLeast: 1 }, decoration: 'laurel_leaf' },
  { id: 'unbroken', name: 'Unbroken', scope: 'emotional', hidden: false, rule: { kind: 'streak', questId: 'fx.journal', atLeast: 30 } },
  { id: 'iron_will', name: 'Iron Will', scope: 'physical', hidden: false, rule: { kind: 'weeks_in_a_row', condition: 'quest_on_target', questId: 'fx.exercise', weeks: 4 } },
  { id: 'master_inner', name: 'Master of the Inner World', scope: 'inner', hidden: false, rule: { kind: 'weeks_in_a_row', condition: 'world_on_target', world: 'inner', weeks: 4 } },
  { id: 'full_protocol', name: 'The Full Protocol', scope: 'all', hidden: false, rule: { kind: 'count_events', event: 'perfect_week', atLeast: 1 } },
  { id: 'comeback', name: 'Comeback', scope: 'all', hidden: true, rule: { kind: 'comeback', daysAway: 14 } },
  { id: 'night_owl', name: 'Night Owl Reformed', scope: 'physical', hidden: true, rule: { kind: 'after_misses', questId: 'fx.dawn', misses: 10 } },
];

describe('rules on a snapshot', () => {
  test('each rule type', () => {
    const s = emptyStats();
    assert.equal(evaluateAchievements(defs, s, []).length, 0);
    s.quantities['fx.read'] = { pages: 100 };
    s.completions['fx.dawn'] = 1;
    s.bestWeekCount['fx.dawn'] = 5;
    s.events.book_finished = 1;
    s.longestStreak['fx.journal'] = 30;
    s.questOnTargetRun['fx.exercise'] = 4;
    s.worldOnTargetRun.inner = 4;
    s.events.perfect_week = 1;
    s.longestAbsenceDays = 14;
    s.missesBeforeCompletion['fx.dawn'] = 10;
    assert.deepEqual(evaluateAchievements(defs, s, []).map((d) => d.id), defs.map((d) => d.id));
  });
  test('just below thresholds', () => {
    const s = emptyStats();
    s.quantities['fx.read'] = { pages: 99 };
    s.bestWeekCount['fx.dawn'] = 4;
    s.longestAbsenceDays = 13;
    s.missesBeforeCompletion['fx.dawn'] = 9;
    s.worldOnTargetRun.inner = 3;
    assert.deepEqual(evaluateAchievements(defs, s, []).map((d) => d.id), []);
    assert.equal(isRuleMet({ kind: 'weeks_in_a_row', condition: 'world_on_target', world: 'outer', weeks: 1 }, s), false);
  });
  test('unlocking is idempotent', () => {
    const s = emptyStats();
    s.completions['fx.dawn'] = 3;
    const first = evaluateAchievements(defs, s, []);
    assert.deepEqual(first.map((d) => d.id), ['first_light']);
    assert.deepEqual(evaluateAchievements(defs, s, first.map((d) => d.id)), []);
  });
});

describe('buildPlayerStats from history', () => {
  const env = fixtureEnv({ lat: 9.93, lon: -84.08 });

  test('quantities, counts, best week, repair doubles excluded', () => {
    const cs: Completion[] = [
      ...dateRange('2026-01-05', '2026-01-14').map((d) => completion('fx.read', d, { payload: { pages: 10, bookId: 'b' } })),
      completion('fx.read', '2026-01-14', { payload: { pages: 10 }, isRepair: true }),
      ...dateRange('2026-01-12', '2026-01-16').map((d) => completion('fx.dawn', d)),
    ];
    const s = buildPlayerStats({ env, completions: cs, today: '2026-01-20' });
    assert.equal(s.quantities['fx.read']?.pages, 100);
    assert.equal(s.completions['fx.read'], 10);
    assert.equal(s.bestWeekCount['fx.dawn'], 5);
    const ids = evaluateAchievements(defs, s, []).map((d) => d.id);
    assert.deepEqual(ids, ['bookworm', 'first_light', 'early_riser']);
  });

  test('weeks in a row from closed week results', () => {
    const weeks = [0, 1, 2, 3, 4].map((i) => addDays('2026-01-05', 7 * i));
    const cs = weeks.flatMap((w) => fixtureGame.quests.flatMap((q) => {
      const s = questWeekSchedule(q, w, env);
      return s.activeDays.slice(0, s.due).map((d) => completion(q.id, d));
    }));
    const results = weeks.map((w) => computeWeekResult(env, w, cs));
    const s = buildPlayerStats({ env, completions: cs, weekResults: results, today: '2026-02-08', eventCounts: { book_finished: 1 } });
    assert.equal(s.questOnTargetRun['fx.exercise'], 5);
    assert.equal(s.worldOnTargetRun.inner, 4); // weeks 2..5 (week 1 had only mental/physical)
    assert.equal(s.worldOnTargetRun.outer, 2); // weeks 4..5 (all four outer pillars)
    assert.equal(s.events.perfect_week, 5);
    assert.equal(s.events.balanced_week, 2);
    assert.equal(s.events.book_finished, 1);
    const ids = evaluateAchievements(defs, s, []).map((d) => d.id);
    assert.ok(ids.includes('iron_will') && ids.includes('master_inner') && ids.includes('full_protocol') && ids.includes('finisher'));

    // Missing exercise in week 3 breaks the run.
    const broken = cs.filter((c) => !(c.questId === 'fx.exercise' && c.localDate >= '2026-01-19' && c.localDate <= '2026-01-25'));
    const r2 = weeks.map((w) => computeWeekResult(env, w, broken));
    assert.equal(buildPlayerStats({ env, completions: broken, weekResults: r2, today: '2026-02-08' }).questOnTargetRun['fx.exercise'], 2);
  });

  test('comeback and after-misses (hidden)', () => {
    const cs = [
      completion('fx.read', '2026-01-05'),
      completion('fx.read', '2026-01-20'), // 14 days away (6..19)
      completion('fx.dawn', '2026-01-16'), // 11 missed dawn days (5..15) before it
    ];
    const s = buildPlayerStats({ env, completions: cs, today: '2026-01-21' });
    assert.equal(s.longestAbsenceDays, 10); // any activity: 5 → 16 → 20
    const s2 = buildPlayerStats({ env, completions: cs.filter((c) => c.questId === 'fx.read'), today: '2026-01-21' });
    assert.equal(s2.longestAbsenceDays, 14);
    assert.equal(s.missesBeforeCompletion['fx.dawn'], 11);
    const paused = fixtureEnv({ pausedDates: ['2026-01-06', '2026-01-07'] });
    assert.equal(buildPlayerStats({ env: paused, completions: cs, today: '2026-01-21' }).missesBeforeCompletion['fx.dawn'], 9);
  });
});
