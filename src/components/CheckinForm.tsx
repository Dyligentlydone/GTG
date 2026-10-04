'use client';

// Check-in form (SPEC §10.1 /quests/[key]): fields follow the quest's proof type;
// POSTs to /api/checkins. Validation mirrors src/core/proof.ts on the server.
import { useState } from 'react';
import type { ProofSpec } from '../core/types';

export interface CheckinBook { id: string; title: string; }

interface Props {
  gameSlug: string;
  questKey: string;
  proof: ProofSpec;
  /** For reading proofs: the player's books to pick from. */
  books?: CheckinBook[];
  /** For timer proofs: suggested minimum seconds. */
  minSeconds?: number;
}

interface ApiResult {
  ok: boolean;
  reason?: string;
  xpAwarded?: number;
  achievements?: string[];
  bookFinished?: string;
  levelUp?: { from: number; to: number };
}

export function CheckinForm({ gameSlug, questKey, proof, books = [], minSeconds }: Props) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const buildPayload = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === '') continue;
      if (['pages', 'minutes', 'seconds'].includes(k)) p[k] = Number(v);
      else p[k] = v;
    }
    return p;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameSlug, questKey, payload: buildPayload() }),
      });
      const data = (await res.json()) as ApiResult;
      setResult(data);
    } catch {
      setResult({ ok: false, reason: 'Network error — try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="card p-6">
        <p className="font-display text-2xl text-gold">Done. +{result.xpAwarded ?? 0} XP</p>
        {result.levelUp && <p className="mt-2 text-marble">Level up — you are now level {result.levelUp.to}.</p>}
        {result.bookFinished && <p className="mt-2 text-gold">Book finished: {result.bookFinished}. A laurel leaf is yours.</p>}
        {result.achievements && result.achievements.length > 0 && (
          <p className="mt-2 text-marble">Unlocked: {result.achievements.join(', ')}</p>
        )}
        <a href="/" className="btn btn-primary mt-6">Back to the board</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      {proof.type === 'reading' && (
        <>
          <div>
            <label className="label" htmlFor="bookId">Book</label>
            <select id="bookId" className="input" value={fields.bookId ?? ''} onChange={set('bookId')} required>
              <option value="">Pick a book…</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            {books.length === 0 && <p className="mt-1 text-xs text-shadow">No open book — <a className="text-gold underline" href="/books">add one first</a>.</p>}
          </div>
          <div>
            <label className="label" htmlFor="pages">Pages read (at least {proof.targetPages})</label>
            <input id="pages" className="input" type="number" min={0} value={fields.pages ?? ''} onChange={set('pages')} required />
          </div>
          <div>
            <label className="label" htmlFor="takeaway">One-line takeaway</label>
            <input id="takeaway" className="input" maxLength={200} value={fields.takeaway ?? ''} onChange={set('takeaway')} placeholder="The one thing you are keeping from today's pages" required />
          </div>
        </>
      )}
      {proof.type === 'duration' && (
        <>
          <div>
            <label className="label" htmlFor="minutes">Minutes (at least {proof.minMinutes})</label>
            <input id="minutes" className="input" type="number" min={0} value={fields.minutes ?? ''} onChange={set('minutes')} required />
          </div>
          <div>
            <label className="label" htmlFor="activity">What did you do?</label>
            <input id="activity" className="input" maxLength={200} value={fields.activity ?? ''} onChange={set('activity')} required />
          </div>
        </>
      )}
      {proof.type === 'dawn' && (
        <div>
          <label className="label" htmlFor="intention">Intention for the day</label>
          <input id="intention" className="input" maxLength={140} value={fields.intention ?? ''} onChange={set('intention')} placeholder="One line, before the sun is up" required />
        </div>
      )}
      {proof.type === 'journal' && (
        <div>
          <label className="label" htmlFor="text">Journal entry (at least {proof.minWords ?? 50} words; private & encrypted)</label>
          <textarea id="text" className="input min-h-40" value={fields.text ?? ''} onChange={set('text')} required />
        </div>
      )}
      {proof.type === 'timer' && (
        <>
          <div>
            <label className="label" htmlFor="seconds">Seconds of stillness (at least {minSeconds ?? 300})</label>
            <input id="seconds" className="input" type="number" min={0} value={fields.seconds ?? ''} onChange={set('seconds')} />
          </div>
          <p className="text-xs text-shadow">…or leave a one-line reflection instead.</p>
          <div>
            <label className="label" htmlFor="reflection">Reflection</label>
            <input id="reflection" className="input" maxLength={200} value={fields.reflection ?? ''} onChange={set('reflection')} />
          </div>
        </>
      )}
      {proof.type === 'text' && (
        <div>
          <label className="label" htmlFor="text">A short note</label>
          <input id="text" className="input" maxLength={200} value={fields.text ?? ''} onChange={set('text')} required />
        </div>
      )}
      {proof.type === 'photo_optional' && (
        <div>
          <label className="label" htmlFor="note">A short note about the reset</label>
          <input id="note" className="input" maxLength={200} value={fields.note ?? ''} onChange={set('note')} required />
        </div>
      )}
      {result && !result.ok && <p className="text-sm text-[#e88]">{result.reason}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Check in'}</button>
    </form>
  );
}
