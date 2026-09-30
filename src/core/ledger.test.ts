import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allEntries, balanceOf, emptyLedger, LedgerError, postTransaction } from './ledger';

const transfer = (key: string, from: string, to: string, cents: number) => ({
  idempotencyKey: key,
  entries: [
    { accountId: from, amountCents: -cents, currency: 'usd' },
    { accountId: to, amountCents: cents, currency: 'USD' },
  ],
});

test('balanced transaction posts and balances are sums', () => {
  let l = emptyLedger();
  l = postTransaction(l, transfer('t1', 'budget', 'alice', 1500)).ledger;
  l = postTransaction(l, transfer('t2', 'alice', 'bob', 500)).ledger;
  const entries = allEntries(l);
  assert.equal(balanceOf('budget', entries), -1500);
  assert.equal(balanceOf('alice', entries), 1000);
  assert.equal(balanceOf('bob', entries), 500);
  assert.equal(entries.reduce((s, e) => s + e.amountCents, 0), 0);
  assert.equal(entries[0]?.currency, 'USD');
});

test('same idempotency key twice → same transaction, no duplicate', () => {
  const a = postTransaction(emptyLedger(), transfer('k', 'x', 'y', 100));
  const b = postTransaction(a.ledger, transfer('k', 'x', 'y', 100));
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.strictEqual(b.transaction, a.transaction);
  assert.equal(allEntries(b.ledger).length, 2);
  assert.throws(() => postTransaction(b.ledger, transfer('k', 'x', 'y', 101)), LedgerError);
});

test('validation: ≥ 2 entries, integer cents, single currency, sum = 0', () => {
  const l = emptyLedger();
  assert.throws(() => postTransaction(l, { idempotencyKey: 'a', entries: [{ accountId: 'x', amountCents: 0, currency: 'USD' }] }), /at least 2/);
  assert.throws(() => postTransaction(l, { idempotencyKey: 'b', entries: [
    { accountId: 'x', amountCents: -1.5, currency: 'USD' }, { accountId: 'y', amountCents: 1.5, currency: 'USD' }] }), /integer/);
  assert.throws(() => postTransaction(l, { idempotencyKey: 'c', entries: [
    { accountId: 'x', amountCents: -100, currency: 'USD' }, { accountId: 'y', amountCents: 100, currency: 'EUR' }] }), /single currency/);
  assert.throws(() => postTransaction(l, { idempotencyKey: 'd', entries: [
    { accountId: 'x', amountCents: -100, currency: 'USD' }, { accountId: 'y', amountCents: 99, currency: 'USD' }] }), /sum to 0/);
  assert.throws(() => postTransaction(l, { idempotencyKey: '', entries: [] }), /idempotencyKey/);
  assert.throws(() => postTransaction(l, { idempotencyKey: 'e', entries: [
    { accountId: 'x', amountCents: -1, currency: 'US' }, { accountId: 'y', amountCents: 1, currency: 'US' }] }), /currency/);
  assert.equal(l.transactions.size, 0);
});

test('multi-leg transaction', () => {
  const r = postTransaction(emptyLedger(), { idempotencyKey: 'm', entries: [
    { accountId: 'pool', amountCents: -1000, currency: 'USD' },
    { accountId: 'a', amountCents: 600, currency: 'USD' },
    { accountId: 'b', amountCents: 400, currency: 'USD' },
  ] });
  assert.equal(r.transaction.entries.length, 3);
});
