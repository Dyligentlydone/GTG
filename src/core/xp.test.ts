import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, questXpEvent, shareXpEvent, totalXp, totalXpForLevel, xpEvent, xpToNextLevel } from './xp';

test('XP curve per level', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(xpToNextLevel), [100, 115, 132, 152, 175]);
  assert.throws(() => xpToNextLevel(0), RangeError);
});

test('levelFromXp at the spec test values', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, xpIntoLevel: 0, xpForNext: 100 });
  assert.deepEqual(levelFromXp(99), { level: 1, xpIntoLevel: 99, xpForNext: 100 });
  assert.deepEqual(levelFromXp(100), { level: 2, xpIntoLevel: 0, xpForNext: 115 });
  assert.deepEqual(levelFromXp(215), { level: 3, xpIntoLevel: 0, xpForNext: 132 });
  // Levels 1..19 need 8 822 XP in total (hand-summed rounded steps); level 20 needs 1 423.
  assert.deepEqual(levelFromXp(10_000), { level: 20, xpIntoLevel: 1178, xpForNext: 1423 });
  assert.equal(totalXpForLevel(20), 8822);
  assert.deepEqual(levelFromXp(-5), { level: 1, xpIntoLevel: 0, xpForNext: 100 });
});

test('totalXp dedupes by idempotency key', () => {
  const a = questXpEvent('u1', 'c1', 20);
  const events = [a, { ...a }, questXpEvent('u1', 'c2', 15)];
  assert.equal(totalXp(events), 35);
  assert.throws(() => xpEvent('u1', 'quest', 'c', 1.5, 'k'), RangeError);
});

test('share XP is +5 at most once per local day', () => {
  const first = shareXpEvent('u1', 's1', '2026-03-01', []);
  assert.ok(first);
  assert.equal(first.amount, 5);
  assert.equal(shareXpEvent('u1', 's2', '2026-03-01', [first]), null);
  assert.ok(shareXpEvent('u1', 's3', '2026-03-02', [first]));
});
