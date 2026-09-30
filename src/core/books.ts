// Books (SPEC §6.4): reading completions add pages; finishing a book is a "boss battle".
import type { Instant, InstantLike } from './types';
import { toInstant } from './time';

export interface Book {
  id: string;
  userId: string;
  title: string;
  totalPages: number;
  pagesRead: number;
  finishedAt: Instant | null;
}

/**
 * Adds pages to a book. `finishedNow` is true only on the completion that crosses
 * `totalPages` (a finished book never finishes again).
 */
export function addPages(book: Book, pages: number, at: InstantLike): { book: Book; finishedNow: boolean } {
  if (!Number.isInteger(pages) || pages < 0) throw new RangeError(`Invalid page count: ${pages}`);
  const pagesRead = book.pagesRead + pages;
  const finishedNow = book.finishedAt === null && pagesRead >= book.totalPages;
  return {
    book: { ...book, pagesRead, finishedAt: finishedNow ? toInstant(at) : book.finishedAt },
    finishedNow,
  };
}
