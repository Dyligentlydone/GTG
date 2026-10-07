// /ledger — every check-in the player has ever made, newest first, grouped by
// day. Payloads render per proof type; journal bodies are decrypted server-side
// (owner-only page) and scans get signed thumbnails.
import Link from 'next/link';
import { requireViewer } from '../../lib/viewer';
import { loadBooks, loadJournalEntries } from '../../lib/repos/players';
import { decryptJournal } from '../../lib/journalCrypto';
import { PILLAR_SYMBOLS } from '../../sculpture/symbols';
import { TempleHeader } from '../../components/TempleHeader';
import { EmptyState } from '../../components/Bits';
import { LedgerShareButton } from '../../components/LedgerShareButton';
import type { CompletionRow, QuestRow } from '../../lib/repos/types';
import type { PillarId, QuestDef } from '../../core/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const metadata = { title: 'Ledger' };
export const dynamic = 'force-dynamic';

interface QuestMeta { key: string; title: string; pillar: PillarId; xp: number; proof: QuestDef['proof']; gameSlug: string; }
interface JournalBits { text?: string; scanUrl?: string; }

function PillarGlyph({ pillar }: { pillar: PillarId }) {
  return (
    <svg width="16" height="24" viewBox="-9 -15 18 30" aria-hidden="true" className="shrink-0">
      <path d={PILLAR_SYMBOLS[pillar]} fill="none" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);

/** The exact answers the player left, rendered per proof type. */
function EntryDetail({ meta, payload, bookTitle, journal }: {
  meta: QuestMeta; payload: Record<string, unknown>;
  bookTitle: (id: string) => string | undefined; journal?: JournalBits;
}) {
  const lines: string[] = [];
  switch (meta.proof.type) {
    case 'reading': {
      const pages = num(payload.pages), book = bookTitle(str(payload.bookId) ?? '');
      lines.push([pages ? `${pages} pages` : null, book ? `of ${book}` : null].filter(Boolean).join(' ') || 'Reading logged');
      const t = str(payload.takeaway);
      if (t) lines.push(`“${t}”`);
      break;
    }
    case 'duration': {
      lines.push(num(payload.minutes) ? `${payload.minutes} minutes` : 'Session logged');
      const a = str(payload.activity);
      if (a) lines.push(`“${a}”`);
      break;
    }
    case 'timer': {
      const s = num(payload.seconds);
      if (s) lines.push(`${Math.round(s / 60)} min of stillness`);
      const r = str(payload.reflection);
      if (r) lines.push(`“${r}”`);
      break;
    }
    case 'journal': {
      if (journal?.text) lines.push(journal.text);
      else if (journal?.scanUrl) lines.push('A scanned page.');
      else lines.push('Journal entry.');
      break;
    }
    case 'metrics': {
      for (const f of meta.proof.fields) {
        const v = payload[f.key];
        if (typeof v === 'number' && Number.isFinite(v)) lines.push(`${f.label}: ${f.prefix ?? ''}${v.toLocaleString()}`);
      }
      if (lines.length === 0) {
        const t = str(payload.text); // legacy money notes predate the metrics proof
        lines.push(t ? `“${t}”` : 'Logged.');
      }
      break;
    }
    case 'photo_optional': {
      const n = str(payload.note);
      if (n) lines.push(`“${n}”`);
      break;
    }
    case 'dawn': {
      const i = str(payload.intention);
      if (i) lines.push(`“${i}”`);
      break;
    }
    case 'text': {
      const t = str(payload.text);
      if (t) lines.push(`“${t}”`);
      break;
    }
    default:
      lines.push('Done.');
  }
  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((l, i) => (
        <p key={i} className={i === 0 && lines.length > 1 ? 'text-xs text-shadow' : 'whitespace-pre-wrap text-sm text-marble/90'}>
          {l}
        </p>
      ))}
      {journal?.scanUrl && (
        <a href={journal.scanUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={journal.scanUrl} alt="Scanned journal page" className="h-20 rounded border border-line object-cover hover:border-gold" />
        </a>
      )}
      {meta.proof.type === 'journal' && (
        <p className="text-[11px] text-shadow"><Link href="/journal" className="hover:text-marble">read it in Journal →</Link></p>
      )}
    </div>
  );
}

async function loadQuestMeta(supabase: SupabaseClient): Promise<Map<string, QuestMeta>> {
  const { data, error } = await supabase.from('quests').select('id, key, title, pillar, xp, proof, games!inner(slug)');
  if (error) throw error;
  const map = new Map<string, QuestMeta>();
  for (const r of data ?? []) {
    const g = r.games as { slug: string }[] | { slug: string };
    const slug = Array.isArray(g) ? g[0]?.slug : g.slug;
    if (!slug) continue;
    map.set(r.id as string, {
      key: r.key as string, title: r.title as string, pillar: r.pillar as PillarId,
      xp: r.xp as number, proof: r.proof as QuestDef['proof'], gameSlug: slug,
    });
  }
  return map;
}

const dayLabel = (d: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${d}T12:00:00Z`));

/** One line of shareable detail for a post — mirrors EntryDetail, minus anything private. */
function shareDetail(meta: QuestMeta, payload: Record<string, unknown>, bookTitle: (id: string) => string | undefined): string {
  const q = (v: unknown) => (str(v) ? `“${str(v)}”` : null);
  switch (meta.proof.type) {
    case 'reading': {
      const book = str(payload.bookId) ? bookTitle(str(payload.bookId)!) : null;
      const bits = [num(payload.pages) ? `${payload.pages} pages` : null, book ? `of ${book}` : null].filter(Boolean);
      return [bits.join(' ') || null, q(payload.takeaway)].filter(Boolean).join(' — ');
    }
    case 'duration':
      return [num(payload.minutes) ? `${payload.minutes} minutes` : null, q(payload.activity)].filter(Boolean).join(' — ');
    case 'timer':
      return [num(payload.seconds) ? `${Math.round((payload.seconds as number) / 60)} min of stillness` : null, q(payload.reflection)].filter(Boolean).join(' — ');
    case 'metrics': {
      const parts = meta.proof.fields
        .map((f) => (typeof payload[f.key] === 'number' ? `${f.label}: ${f.prefix ?? ''}${(payload[f.key] as number).toLocaleString()}` : null))
        .filter(Boolean);
      return parts.length ? parts.join(' · ') : (q(payload.text) ?? '');
    }
    case 'photo_optional': return q(payload.note) ?? '';
    case 'dawn': return q(payload.intention) ?? '';
    case 'text': return q(payload.text) ?? '';
    default: return ''; // journal stays private unless the share sheet opts it in
  }
}

export default async function LedgerPage() {
  const { supabase, user, profile } = await requireViewer('/ledger');
  const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: profile.time_zone });

  const [completions, questMeta, books, journalRows, xpRows] = await Promise.all([
    supabase.from('completions').select('*').eq('user_id', user.id)
      .order('completed_at', { ascending: false }).limit(300),
    loadQuestMeta(supabase),
    loadBooks(supabase, user.id),
    loadJournalEntries(supabase, user.id),
    supabase.from('xp_events').select('source_id, amount').eq('user_id', user.id).eq('source_type', 'quest'),
  ]);
  if (completions.error) throw completions.error;
  if (xpRows.error) throw xpRows.error;

  const bookTitle = new Map(books.map((b) => [b.id, b.title]));
  const xpByCompletion = new Map<string, number>();
  for (const r of xpRows.data ?? []) xpByCompletion.set(r.source_id as string, r.amount as number);

  const journalByCompletion = new Map<string, JournalBits>();
  for (const j of journalRows) {
    try {
      if (j.scan_path) {
        const { data: signed } = await supabase.storage.from('journal-scans').createSignedUrl(j.scan_path, 3600);
        if (signed) journalByCompletion.set(j.completion_id, { scanUrl: signed.signedUrl });
      } else if (j.ciphertext && j.nonce) {
        journalByCompletion.set(j.completion_id, { text: await decryptJournal(j.ciphertext, j.nonce) });
      }
    } catch { /* undecryptable entry — the row still shows as a journal check-in */ }
  }

  const rows = (completions.data ?? []) as CompletionRow[];
  const gameSlugs = new Set<string>();
  for (const r of rows) {
    const m = questMeta.get(r.quest_id);
    if (m) gameSlugs.add(m.gameSlug);
  }
  const multiGame = gameSlugs.size > 1;

  const days: { date: string; entries: CompletionRow[] }[] = [];
  for (const r of rows) {
    const top = days[days.length - 1];
    if (top && top.date === r.local_date) top.entries.push(r);
    else days.push({ date: r.local_date, entries: [r] });
  }

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 font-display text-3xl text-marble">The Ledger</h1>
        <p className="mb-6 text-sm text-shadow">Everything you've checked in — what you wrote, when, and what it earned.</p>

        {days.length === 0 && <EmptyState title="No entries yet" hint="Check in on the board — every deed lands here." />}

        <div className="space-y-6">
          {days.map((day) => {
            const dayXp = day.entries.reduce((n, e) => n + (xpByCompletion.get(e.id) ?? 0), 0);
            return (
              <section key={day.date}>
                <div className="mb-2 flex items-baseline justify-between border-b border-line pb-1">
                  <h2 className="font-display text-sm tracking-[0.15em] text-gold">{dayLabel(day.date)}</h2>
                  <p className="text-xs text-shadow">{day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'} · +{dayXp} XP</p>
                </div>
                <div className="space-y-2">
                  {day.entries.map((e) => {
                    const meta = questMeta.get(e.quest_id);
                    const xp = xpByCompletion.get(e.id);
                    return (
                      <div key={e.id} className="card flex gap-3 p-3">
                        {meta && <div className="pt-0.5"><PillarGlyph pillar={meta.pillar} /></div>}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate font-display text-sm text-marble">
                              {meta?.title ?? 'Quest'}
                              {multiGame && meta && <span className="ml-2 text-[10px] uppercase tracking-wider text-shadow">{meta.gameSlug}</span>}
                              {e.is_repair && <span className="ml-2 text-[10px] uppercase tracking-wider text-shadow">repair</span>}
                            </p>
                            <div className="flex shrink-0 items-center gap-3">
                              <p className="text-xs text-shadow">
                                {timeFmt.format(new Date(e.completed_at))}
                                {xp ? <span className="ml-2 text-gold">+{xp} XP</span> : null}
                              </p>
                              <LedgerShareButton
                                completionId={e.id}
                                title={meta?.title ?? 'Quest'}
                                xp={xp ?? meta?.xp ?? 0}
                                detail={meta ? shareDetail(meta, e.payload ?? {}, (id) => bookTitle.get(id)) : ''}
                              />
                            </div>
                          </div>
                          {meta && (
                            <EntryDetail meta={meta} payload={e.payload ?? {}}
                              bookTitle={(id) => bookTitle.get(id)} journal={journalByCompletion.get(e.id)} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
