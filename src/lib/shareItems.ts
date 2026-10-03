// Share candidates (SPEC §9): the real items a player may put on a card, derived
// server-side from their own rows. The share sheet lists them; /api/shares re-derives
// them and only honors ids that exist here — a crafted request can't invent content.
import {
  addDays, computeStreaks, computeWeekResult, localDate, weekStart,
  type AchievementScope, type PillarId,
} from '../core';
import { STATUE_PIECES } from '../core/chisel';
import { HEAD_SITES } from '../sculpture/shards';
import { decryptJournal } from './journalCrypto';
import { loadEngineState, type EngineState } from './context';
import { loadDecorations, loadJournalEntries, loadSculpture, loadWeekResults } from './repos/players';
import type { Db } from './repos/types';
import type { Rarity, ShareItem } from '../share/model';
import type { MilestoneKind, ShareScope } from '../share/scopes';

export interface ShareCandidate {
  item: ShareItem;
  isJournal?: boolean;
}

export type ShareCandidates = Partial<Record<ShareScope, ShareCandidate[]>>;

const MAX_PER_GROUP = 12;
const FACE_REVEAL_AT = STATUE_PIECES - HEAD_SITES; // 110 — the head band is the last to fall

function rarityFor(scope: string, hidden: boolean): Rarity {
  if (hidden) return 'legendary';
  if (scope === 'all') return 'epic';
  if (scope === 'inner' || scope === 'outer') return 'rare';
  return 'uncommon';
}

function push(map: ShareCandidates, scope: ShareScope, item: ShareItem, isJournal = false) {
  const list = (map[scope] ??= []);
  if (list.length < MAX_PER_GROUP) list.push(isJournal ? { item, isJournal } : { item });
}

export async function loadShareCandidates(db: Db, userId: string, state?: EngineState | null): Promise<ShareCandidates> {
  const s = state ?? await loadEngineState(db, userId);
  if (!s) return {};
  const { env } = s;
  const today = localDate(new Date(), env.ctx.timeZone);
  const week = weekStart(today);
  const out: ShareCandidates = {};

  const questByKey = new Map(env.game.quests.map((q) => [q.id, q]));
  const sculpture = await loadSculpture(db, userId);
  const sculpturePieces = sculpture?.pieces_revealed ?? 0;

  // --- takeaways (recent first) ---
  const { data: takeawayRows } = await db.from('takeaways')
    .select('id, text, book_id, books(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_GROUP);
  const takeaways: ShareCandidate[] = [];
  for (const t of takeawayRows ?? []) {
    const bookTitle = (t.books as unknown as { title: string } | null)?.title ?? undefined;
    const item: ShareItem = {
      type: 'takeaway', id: t.id as string, text: t.text as string,
      ...(bookTitle ? { bookTitle } : {}), pillar: 'mental',
    };
    takeaways.push({ item });
    push(out, 'takeaway', item);
  }

  // --- quest completions (recent first) ---
  const recent = [...s.completions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, MAX_PER_GROUP);
  for (const c of recent) {
    const q = questByKey.get(c.questId);
    if (!q) continue;
    const item: ShareItem = {
      type: 'quest', id: c.id, title: q.title, pillar: q.pillar, xp: q.xp, date: c.localDate,
    };
    push(out, 'quest', item);
  }

  // --- custom set candidates: quests + pillar lines + stats + takeaways + journals ---
  const weekResult = computeWeekResult(env, week, s.completions);
  const pillarDone = new Map<PillarId, { done: number; due: number }>();
  for (const line of weekResult.quests) {
    const q = questByKey.get(line.questId);
    if (!q) continue;
    const cur = pillarDone.get(q.pillar) ?? { done: 0, due: 0 };
    cur.done += line.counted;
    cur.due += line.due;
    pillarDone.set(q.pillar, cur);
  }
  const custom: ShareCandidate[] = [];
  for (const c of recent) {
    const q = questByKey.get(c.questId);
    if (q) custom.push({ item: { type: 'quest', id: c.id, title: q.title, pillar: q.pillar, xp: q.xp, date: c.localDate } });
  }
  for (const [pillar, v] of pillarDone) {
    if (v.due > 0) custom.push({ item: { type: 'pillar', id: `pillar:${pillar}`, pillar, done: v.done, due: v.due } });
  }
  custom.push({ item: { type: 'stat', id: 'stat:level', label: 'Level', value: String(env.ctx.level) } });
  const pagesTotal = s.books.reduce((n, b) => n + b.pagesRead, 0);
  if (pagesTotal > 0) custom.push({ item: { type: 'stat', id: 'stat:pages', label: 'Pages read', value: String(pagesTotal) } });
  for (const t of takeaways.slice(0, 4)) custom.push(t);

  // --- journal candidates (decrypted for the preview; only shared if ticked + allowed) ---
  const journalRows = await loadJournalEntries(db, userId);
  const completionById = new Map(s.completions.map((c) => [c.id, c]));
  for (const j of journalRows.slice(0, 4)) {
    const c = completionById.get(j.completion_id);
    try {
      const text = await decryptJournal(j.ciphertext, j.nonce);
      const item: ShareItem = {
        type: 'journal', id: j.id, text,
        ...(c?.localDate ? { date: c.localDate } : {}),
      };
      custom.push({ item, isJournal: true });
    } catch { /* unreadable entry — skip */ }
  }
  out.custom_set = custom.slice(0, MAX_PER_GROUP * 2);

  // --- day card: today's board ---
  const todayLines = env.game.quests
    .filter((q) => weekResult.quests.some((l) => l.questId === q.id && l.due > 0))
    .map((q) => ({
      title: q.title, pillar: q.pillar,
      ...(s.completions.some((c) => c.questId === q.id && c.localDate === today) ? { xp: q.xp } : {}),
    }));
  if (todayLines.length > 0) {
    const { streaks } = computeStreaks(env, s.completions, today);
    const bestStreak = Math.max(0, ...Object.values(streaks).map((s2) => s2.current));
    const item: ShareItem = {
      type: 'day', id: `day:${today}`, date: today,
      quests: todayLines,
      fullSet: weekResult.fullSetDays.includes(today),
      streak: bestStreak,
    };
    push(out, 'day', item);
  }

  // --- week card: most recent closed week ---
  const weekRows = await loadWeekResults(db, userId, s.game.row.id);
  const lastWeek = weekRows[weekRows.length - 1];
  if (lastWeek) {
    const res = computeWeekResult(env, lastWeek.week_start, s.completions);
    const end = addDays(lastWeek.week_start, 6);
    const inWeek = s.completions.filter((c) => c.localDate >= lastWeek.week_start && c.localDate <= end);
    const pagesRead = inWeek.reduce((n, c) => n + (typeof c.payload.pages === 'number' ? c.payload.pages : 0), 0);
    const dawns = new Set(inWeek.filter((c) => questByKey.get(c.questId)?.proof.type === 'dawn').map((c) => c.localDate)).size;
    const item: ShareItem = {
      type: 'week', id: `week:${lastWeek.week_start}`, weekStart: lastWeek.week_start,
      quests: res.quests.map((l) => {
        const q = questByKey.get(l.questId);
        return { title: q?.title ?? l.questId, pillar: q?.pillar ?? 'mental', done: l.counted, due: l.due };
      }),
      pagesRead, dawns, perfectWeek: res.perfectWeek,
      piecesChiseled: res.pieces,
      ...(sculpturePieces ? { piecesRevealed: sculpturePieces } : {}),
    };
    push(out, 'week', item);
  }

  // --- achievement cards ---
  const { data: earnedRows } = await db.from('user_achievements')
    .select('achievement_id, achievements(key, name, scope, hidden)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  for (const r of earnedRows ?? []) {
    const a = r.achievements as unknown as { key: string; name: string; scope: string; hidden: boolean } | null;
    if (!a) continue;
    const item: ShareItem = {
      type: 'achievement', id: a.key, name: a.name,
      scope: a.scope as AchievementScope,
      rarity: rarityFor(a.scope, a.hidden),
    };
    push(out, 'achievement', item);
  }

  // --- milestone cards (need the sculpture) ---
  if (sculpture) {
    const decorations = (await loadDecorations(db, sculpture.id)).map((d) => d.type);
    const base = { seed: sculpture.seed, archetype: sculpture.archetype, decorations };
    const milestone = (kind: MilestoneKind, id: string, extra: Record<string, unknown> = {}) =>
      push(out, 'milestone', { type: 'milestone', id, kind, piecesRevealed: sculpture.pieces_revealed, ...base, ...extra } as ShareItem);

    for (const b of s.books.filter((b) => b.finishedAt)) {
      milestone('book_finished', `milestone:book_finished:${b.id}`, { bookTitle: b.title });
    }
    const lastChisel = weekRows.filter((w) => w.pieces > 0).at(-1);
    if (lastChisel) milestone('chisel_day', `milestone:chisel_day:${lastChisel.week_start}`, { piecesThisWeek: lastChisel.pieces });
    if (sculpture.pieces_revealed >= Math.ceil(STATUE_PIECES / 2)) milestone('sculpture_halfway', 'milestone:sculpture_halfway');
    if (sculpture.pieces_revealed >= FACE_REVEAL_AT) milestone('face_reveal', 'milestone:face_reveal');
    if (sculpture.status === 'complete') milestone('sculpture_complete', 'milestone:sculpture_complete');
  }

  return out;
}

/** All candidates flattened, for id lookups in /api/shares. */
export function candidateItems(candidates: ShareCandidates, scope: ShareScope): ShareItem[] {
  return (candidates[scope] ?? []).map((c) => c.item);
}
