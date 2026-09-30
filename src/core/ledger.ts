// Double-entry ledger primitives (SPEC §4.10). Money is integer cents with an explicit currency.
// No cash flows use this yet; it exists so nothing needs reshaping later.

export interface LedgerEntryInput { accountId: string; amountCents: number; currency: string; }

export interface PostTransactionInput {
  idempotencyKey: string;
  description?: string;
  entries: LedgerEntryInput[];
}

export interface LedgerEntry { transactionId: string; accountId: string; amountCents: number; currency: string; }

export interface LedgerTransaction {
  id: string;
  idempotencyKey: string;
  description: string;
  currency: string;
  entries: LedgerEntry[];
}

export class LedgerError extends Error {
  constructor(message: string) { super(message); this.name = 'LedgerError'; }
}

const CURRENCY_RE = /^[A-Z]{3}$/;

/** Validates and normalizes a transaction: ≥ 2 entries, integer cents, one currency, sum = 0. */
export function normalizeTransaction(input: PostTransactionInput): LedgerTransaction {
  const key = input.idempotencyKey?.trim();
  if (!key) throw new LedgerError('idempotencyKey is required');
  if (!Array.isArray(input.entries) || input.entries.length < 2) throw new LedgerError('A transaction needs at least 2 entries');
  const currencies = new Set(input.entries.map((e) => String(e.currency).toUpperCase()));
  if (currencies.size !== 1) throw new LedgerError('All entries must use a single currency');
  const currency = [...currencies][0]!;
  if (!CURRENCY_RE.test(currency)) throw new LedgerError(`Invalid currency: ${currency}`);
  const id = `txn:${key}`;
  let sum = 0;
  const entries = input.entries.map((e) => {
    if (!e.accountId) throw new LedgerError('Every entry needs an accountId');
    if (!Number.isSafeInteger(e.amountCents)) throw new LedgerError(`amountCents must be an integer, got ${e.amountCents}`);
    if (e.amountCents === 0) throw new LedgerError('Zero-amount entries are not allowed');
    sum += e.amountCents;
    return { transactionId: id, accountId: e.accountId, amountCents: e.amountCents, currency };
  });
  if (sum !== 0) throw new LedgerError(`Entries must sum to 0 (got ${sum})`);
  return { id, idempotencyKey: key, description: input.description ?? '', currency, entries };
}

function sameEntries(a: LedgerTransaction, b: LedgerTransaction): boolean {
  return a.currency === b.currency && a.entries.length === b.entries.length
    && a.entries.every((e, i) => e.accountId === b.entries[i]?.accountId && e.amountCents === b.entries[i]?.amountCents);
}

export interface LedgerState {
  readonly transactions: ReadonlyMap<string, LedgerTransaction>;
}

export function emptyLedger(): LedgerState {
  return { transactions: new Map() };
}

/**
 * Posts a transaction to an (immutable) ledger state. The same idempotency key twice returns the
 * original transaction without duplicating it; reusing a key with different entries is an error.
 */
export function postTransaction(
  ledger: LedgerState, input: PostTransactionInput,
): { ledger: LedgerState; transaction: LedgerTransaction; created: boolean } {
  const txn = normalizeTransaction(input);
  const existing = ledger.transactions.get(txn.idempotencyKey);
  if (existing) {
    if (!sameEntries(existing, txn)) throw new LedgerError(`Idempotency key reused with different entries: ${txn.idempotencyKey}`);
    return { ledger, transaction: existing, created: false };
  }
  const next = new Map(ledger.transactions);
  next.set(txn.idempotencyKey, txn);
  return { ledger: { transactions: next }, transaction: txn, created: true };
}

export function allEntries(ledger: LedgerState): LedgerEntry[] {
  return [...ledger.transactions.values()].flatMap((t) => t.entries);
}

/** Balance of an account = sum of its entries (integer cents). */
export function balanceOf(accountId: string, entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, e) => (e.accountId === accountId ? sum + e.amountCents : sum), 0);
}
