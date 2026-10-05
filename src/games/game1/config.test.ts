import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { game1 } from './config';
import { validateGameConfig } from '../../core/validate';
import { buildSeedSql, sqlText } from '../seedSql';
import type { GameDef } from '../../core/types';

const clone = (): GameDef => structuredClone(game1);
const errorsOf = (g: GameDef): string[] => {
  const r = validateGameConfig(g);
  return r.ok ? [] : r.errors;
};

describe('Game 1 config', () => {
  test('validates', () => {
    assert.deepEqual(validateGameConfig(game1), { ok: true });
  });

  test('eight pillars in two worlds, eight quests, founding titles verbatim', () => {
    assert.equal(game1.pillars.length, 8);
    assert.deepEqual(game1.pillars.filter((p) => p.world === 'inner').map((p) => p.id), ['mental', 'physical', 'emotional', 'spiritual']);
    assert.equal(game1.quests.length, 8);
    assert.deepEqual(game1.quests.filter((q) => q.founding).map((q) => q.title), [
      'Read 10 pages a day from a self-development book',
      'Exercise 4 days a week (20+ minutes)',
      'Journal once a day',
    ]);
    assert.ok(game1.quests.every((q) => !q.title.includes('★')));
    assert.ok(game1.quests.every((q) => q.description && q.why));
    assert.equal(new Set(game1.quests.map((q) => q.pillar)).size, 8);
    assert.equal(game1.achievements.length, 16);
    assert.deepEqual(game1.achievements.filter((a) => a.hidden).map((a) => a.id), ['comeback']);
  });

  test('broken configs fail', () => {
    const cases: Array<[string, (g: GameDef) => void, RegExp]> = [
      ['duplicate quest', (g) => { g.quests.push({ ...g.quests[0]! }); }, /duplicate quest id: g1.read/],
      ['unknown pillar', (g) => { g.quests[0]!.pillar = 'mental'; g.pillars = g.pillars.filter((p) => p.id !== 'mental'); }, /pillar mental is not in this game/],
      ['duplicate pillar', (g) => { g.pillars.push({ ...g.pillars[0]! }); }, /duplicate pillar id: mental/],
      ['override for unknown quest', (g) => { g.ramp[0]!.overrides = { 'g1.nope': { perWeek: 2 } }; }, /override for unknown quest g1.nope/],
      ['perWeek on a daily quest', (g) => { g.ramp[0]!.overrides = { 'g1.read': { perWeek: 2 } }; }, /perWeek override on non-quota quest g1.read/],
      ['unknown target', (g) => { g.ramp[0]!.overrides = { 'g1.exercise': { targets: { minMinutes: 10, bogus: 1 } } }; }, /no numeric target bogus/],
      ['achievement unknown quest', (g) => { g.achievements.push({ id: 'x', name: 'X', scope: 'all', hidden: false, rule: { kind: 'count_completions', questId: 'g1.ghost', atLeast: 1 } }); }, /unknown quest g1.ghost/],
      ['streak on quota quest', (g) => { g.achievements.push({ id: 'y', name: 'Y', scope: 'all', hidden: false, rule: { kind: 'streak', questId: 'g1.exercise', atLeast: 3 } }); }, /only for daily quests/],
      ['duplicate achievement', (g) => { g.achievements.push({ ...g.achievements[0]! }); }, /duplicate achievement id: bookworm/],
      ['ramp out of order', (g) => { g.ramp = [g.ramp[1]!, g.ramp[0]!]; }, /first ramp stage must start at week 1/],
      ['wrong gameId', (g) => { g.quests[1]!.gameId = 'g2'; }, /gameId g2 does not match g1/],
      ['bad quota', (g) => { g.quests[1]!.schedule = { kind: 'weekly_quota', perWeek: 9 }; }, /perWeek must be an integer 1..7/],
      ['books quest not reading', (g) => { g.books = { ...g.books!, questId: 'g1.exercise' }; }, /must use reading proof/],
      ['unreachable stage', (g) => { g.quests[0]!.unlock = { kind: 'ramp_stage', atLeast: 'full_protocol' }; g.ramp = g.ramp.filter((s) => s.id !== 'full_protocol'); }, /ramp never reaches stage full_protocol/],
    ];
    for (const [name, mutate, pattern] of cases) {
      const g = clone();
      mutate(g);
      const errors = errorsOf(g);
      assert.ok(errors.some((e) => pattern.test(e)), `${name}: ${JSON.stringify(errors)}`);
    }
  });
});

describe('seed SQL', () => {
  const sql = buildSeedSql([{ game: game1, type: 'free', status: 'active' }]);
  test('inserts plans, game, 8 quests and 16 achievements idempotently', () => {
    assert.equal((sql.match(/insert into public\.quests/g) ?? []).length, 8);
    assert.equal((sql.match(/insert into public\.achievements/g) ?? []).length, 16);
    assert.equal((sql.match(/insert into public\.games/g) ?? []).length, 1);
    assert.match(sql, /insert into public\.plans \(key, name, description\) values \('free'/);
    assert.match(sql, /values \('pro'/);
    const inserts = sql.split('\n').filter((l) => l.startsWith('insert'));
    assert.ok(inserts.every((l) => /on conflict \([^)]+\) do nothing;$/.test(l)));
    assert.ok(sql.includes("'Read 10 pages a day from a self-development book'"));
  });
  test('escapes quotes', () => {
    assert.equal(sqlText("it's"), "'it''s'");
  });
});
