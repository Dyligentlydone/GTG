import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from './events';

test('typed delivery to registered handlers in order', async () => {
  const bus = createEventBus();
  const seen: string[] = [];
  bus.on('book.finished', 'progression', (e) => { seen.push(`xp:${e.payload.bookId}`); });
  bus.on('book.finished', 'sculpture', async (e) => { seen.push(`laurel:${e.payload.bookId}`); });
  bus.on('share.created', 'progression', () => { seen.push('share'); });
  const report = await bus.emit('book.finished', 'book.finished:b1', { userId: 'u1', bookId: 'b1', at: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(seen, ['xp:b1', 'laurel:b1']);
  assert.deepEqual(report.handled, ['progression', 'sculpture']);
});

test('redelivery of the same event id is skipped per handler', async () => {
  const bus = createEventBus();
  let count = 0;
  bus.on('day.closed', 'streaks', () => { count += 1; });
  const payload = { userId: 'u1', localDate: '2026-01-01' };
  await bus.emit('day.closed', 'd1', payload);
  const again = await bus.emit('day.closed', 'd1', payload);
  await bus.emit('day.closed', 'd2', payload);
  assert.equal(count, 2);
  assert.deepEqual(again.skipped, ['streaks']);
});

test('a failing handler does not block others and can be retried', async () => {
  const bus = createEventBus();
  let fail = true;
  let ok = 0;
  let retried = 0;
  bus.on('achievement.unlocked', 'flaky', () => { if (fail) throw new Error('boom'); retried += 1; });
  bus.on('achievement.unlocked', 'steady', () => { ok += 1; });
  const p = { userId: 'u1', achievementId: 'first_light', at: '2026-01-01T00:00:00.000Z' };
  const r1 = await bus.emit('achievement.unlocked', 'a1', p);
  assert.equal(r1.errors.length, 1);
  assert.equal(ok, 1);
  fail = false;
  const r2 = await bus.emit('achievement.unlocked', 'a1', p);
  assert.deepEqual(r2.handled, ['flaky']);
  assert.deepEqual(r2.skipped, ['steady']);
  assert.equal(retried, 1);
  assert.equal(ok, 1);
});

test('duplicate handler names are rejected; unsubscribe works', async () => {
  const bus = createEventBus();
  let n = 0;
  const off = bus.on('share.created', 'x', () => { n += 1; });
  assert.throws(() => bus.on('share.created', 'x', () => {}));
  off();
  await bus.emit('share.created', 's1', { userId: 'u', shareId: 's1', scope: 'day', localDate: '2026-01-01' });
  assert.equal(n, 0);
});
