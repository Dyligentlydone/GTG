'use client';

// Check-in form (SPEC §10.1 /quests/[key]): fields follow the quest's proof type;
// POSTs to /api/checkins. Validation mirrors src/core/proof.ts on the server.
import { useState } from 'react';
import type { ProofSpec } from '../core/types';
import { createClient } from '../lib/supabase/client';

export interface CheckinBook { id: string; title: string; }

// "Document scan" look: grayscale + histogram stretch so the paper reads white
// and the ink reads dark, capped at ~1600px so uploads stay small.
async function enhanceScan(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  const lum = new Uint8Array(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    lum[j] = l;
    hist[l]++;
  }
  const total = lum.length;
  const lo = percentile(hist, total, 0.02);
  const hi = Math.max(percentile(hist, total, 0.9), lo + 1);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let v = ((lum[j] - lo) * 255) / (hi - lo);
    v = Math.max(0, Math.min(255, v));
    // Lift bright paper toward white; keep ink dark.
    if (v > 200) v = Math.min(255, v + (v - 200) * 0.8);
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('scan failed'))), 'image/jpeg', 0.9));
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  let acc = 0;
  const target = total * p;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

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
  const [journalMode, setJournalMode] = useState<'write' | 'scan'>('write');
  const [scan, setScan] = useState<{ blob: Blob; url: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onScanPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    try {
      const blob = await enhanceScan(file);
      setScan({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setResult({ ok: false, reason: 'That image could not be processed — try another photo.' });
    } finally {
      setScanning(false);
    }
  }

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
      const payload = buildPayload();
      if (proof.type === 'journal' && journalMode === 'scan') {
        if (!scan) { setResult({ ok: false, reason: 'Snap your page first.' }); return; }
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setResult({ ok: false, reason: 'Sign in again and retry.' }); return; }
        const path = `${user.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('journal-scans')
          .upload(path, scan.blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) { setResult({ ok: false, reason: 'The scan could not be uploaded — try again.' }); return; }
        payload.scanPath = path;
        delete payload.text;
      }
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameSlug, questKey, payload }),
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
        <a href={`/games/${gameSlug}`} className="btn btn-primary mt-6">Back to the board</a>
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
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['write', 'scan'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setJournalMode(m)}
                className={`btn flex-1 ${journalMode === m ? 'btn-primary' : ''}`}>
                {m === 'write' ? 'Write' : 'Scan a page'}
              </button>
            ))}
          </div>
          {journalMode === 'write' ? (
            <div>
              <label className="label" htmlFor="text">Journal entry (at least {proof.minWords ?? 50} words; private & encrypted)</label>
              <textarea id="text" className="input min-h-40" value={fields.text ?? ''} onChange={set('text')} required={journalMode === 'write'} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-shadow">
                Photograph a handwritten journal page — it is straightened into a document-style
                scan and kept private, just like a written entry.
              </p>
              {scan ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scan.url} alt="Scanned journal page" className="w-full rounded-md border border-white/10" />
                  <div className="flex gap-2">
                    <label className="btn flex-1 cursor-pointer text-center">
                      Retake
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onScanPicked} />
                    </label>
                  </div>
                </>
              ) : (
                <label className="btn btn-primary block cursor-pointer text-center">
                  {scanning ? 'Scanning…' : 'Scan page'}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onScanPicked} disabled={scanning} />
                </label>
              )}
            </div>
          )}
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
