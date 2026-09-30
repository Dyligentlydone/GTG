import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPages, type Book } from './books';

test('finishing a book happens exactly once', () => {
  const book: Book = { id: 'b', userId: 'u', title: 'T', totalPages: 20, pagesRead: 0, finishedAt: null };
  const a = addPages(book, 10, '2026-01-01T10:00:00Z');
  assert.equal(a.finishedNow, false);
  const b = addPages(a.book, 10, '2026-01-02T10:00:00Z');
  assert.equal(b.finishedNow, true);
  assert.equal(b.book.finishedAt, '2026-01-02T10:00:00.000Z');
  const c = addPages(b.book, 10, '2026-01-03T10:00:00Z');
  assert.equal(c.finishedNow, false);
  assert.equal(c.book.finishedAt, '2026-01-02T10:00:00.000Z');
  assert.throws(() => addPages(book, -1, 0), RangeError);
});
