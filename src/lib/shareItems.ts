// Share candidates (SPEC §9): the real items a player may put on a card, derived
// server-side from their own rows — across every game they're enrolled in.
// The share sheet lists them; /api/shares re-derives them and only honors ids that
// exist here — a crafted request can't invent content.
import {
  addDays, computeStreaks, computeWeekResult, localDate, weekStart,
  type AchievementScope, type Completion, type LocalDate, type PillarId,
} from '../core';
import { STATUE_PIECES } from '../core/chisel';
import { HEAD_SITES } from '../sculpture/shards';
import { decryptJournal } from './journalCrypto';
import { loadEngineState, type EngineState } from './context';
import { loadGames } from './repos/games';
import {
  loadBooks, loadDecorations, loadEnrollments, loadJournalEntries, loadSculpture, loadWeekResults,
} from './repos/players';
import type { Db } from './repos/types';
import type { QuestLine, Rarity, ShareItem } from '../share/model';
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

/** Engine states for every game the player is actively enrolled in. */
export async function loadEnrolledStates(db: Db, userId: string): Promise<EngineState[]> {
  const [games, enrollments] = await Promise.all([loadGames(db), loadEnrollments(db, userId)]);
  const slugByUuid = new Map(games.map((g) => [g.id, g.slug]));
  const slugs = enrollments
    .filter((e) => e.state === 'active')
    .map((e) => slugByUuid.get(e.game_id))
    .filter((s): s is string => !!s);
  const states = await Promise.all(slugs.map((slug) => loadEngineState(db, userId, slug)));
  return states.filter((s): s is EngineState => s !== null);
}

export async function loadShareCandidates(db: Db, userId: string, states?: EngineState[]): Promise<ShareCandidates> {
  const states_ = states ?? await loadEnrolledStates(db, userId);
  if (states_.length === 0) return {};
  const out: ShareCandidates = {};

  const sculpture = await loadSculpture(db, userId);
  const sculpturePieces = sculpture?.pieces_revealed ?? 0;
  const books = await loadBooks(db, userId);

  const level = states_[0]!.env.ctx.level;
  const timeZone = states_[0]!.env.ctx.timeZone;
  const today = localDate(new Date(), timeZone);

  // ---------- per-game candidates ----------
  const dayQuests: QuestLine[] = [];
  let allFullSet = true;
  let anyDueToday = false;
  const allCompletions: Completion[] = [];

  for (const s of states_) {
    const { env } = s;
    const questByKey = new Map(env.game.quests.map((q) => [q.id, q]));
    const week = weekStart(localDate(new Date(), env.ctx.timeZone));
    const gameToday = localDate(new Date(), env.ctx.timeZone);
    const weekResult = computeWeekResult(env, week, s.completions);

    // quest completions (recent first)
    const recent = [...s.completions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, MAX_PER_GROUP);
    for (const c of recent) {
      const q = questByKey.get(c.questId);
      if (!q) continue;
      push(out, 'quest', { type: 'quest', id: c.id, title: q.title, pillar: q.pillar, xp: q.xp, date: c.localDate });
      allCompletions.push(c);
    }

    // pillar lines for the custom set (summed across games)
    const pillarDone = new Map<PillarId, { done: number; due: number }>();
    for (const line of weekResult.quests) {
      const q = questByKey.get(line.questId);
      if (!q) continue;
      const cur = pillarDone.get(q.pillar) ?? { done: 0, due: 0 };
      cur.done += line.counted;
      cur.due += line.due;
      pillarDone.set(q.pillar, cur);
    }
    for (const [pillar, v] of pillarDone) {
      if (v.due > 0) push(out, 'custom_set', { type: 'pillar', id: `pillar:${env.game.id}:${pillar}`, pillar, done: v.done, due: v.due });
    }

    // today's board contribution + full-set flag
    const dueLines = weekResult.quests.filter((l) => l.due > 0);
    for (const l of dueLines) {
      const q = questByKey.get(l.questId);
      if (!q) continue;
      const active = s.completions.some((c) => c.questId === l.questId && c.localDate === gameToday);
      dayQuests.push({ title: q.title, pillar: q.pillar, ...(active ? { xp: q.xp } : {}) });
      anyDueToday = true;
    }
    if (dueLines.length > 0 && !weekResult.fullSetDays.includes(gameToday)) allFullSet = false;

    // week card for this game
    const weekRows = await loadWeekResults(db, userId, s.game.row.id);
    const lastWeek = weekRows[weekRows.length - 1];
    if (lastWeek) {
      const res = computeWeekResult(env, lastWeek.week_start, s.completions);
      const end = addDays(lastWeek.week_start, 6);
      const inWeek = s.completions.filter((c) => c.localDate >= lastWeek.week_start && c.localDate <= end);
      const pagesRead = inWeek.reduce((n, c) => n + (typeof c.payload.pages === 'number' ? c.payload.pages : 0), 0);
      const dawns = new Set(inWeek.filter((c) => questByKey.get(c.questId)?.proof.type === 'dawn').map((c) => c.localDate)).size;
      push(out, 'week', {
        type: 'week', id: `week:${env.game.id}:${lastWeek.week_start}`, weekStart: lastWeek.week_start,
        quests: res.quests.map((l) => {
          const q = questByKey.get(l.questId);
          return { title: q?.title ?? l.questId, pillar: q?.pillar ?? 'mental', done: l.counted, due: l.due };
        }),
        pagesRead, dawns, perfectWeek: res.perfectWeek,
        piecesChiseled: env.game.feedsSculpture ? res.pieces : 0,
        ...(sculpturePieces ? { piecesRevealed: sculpturePieces } : {}),
      });
    }

    // achievements (per game; card shows the honor, game-agnostic)
    const { data: earnedRows } = await db.from('user_achievements')
      .select('achievement_id, achievements(key, name, scope, hidden)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    const keySet = new Set(env.game.achievements.map((a) => a.id));
    for (const r of earnedRows ?? []) {
      const a = r.achievements as unknown as { key: string; name: string; scope: string; hidden: boolean } | null;
      if (!a || !keySet.has(a.key)) continue;
      push(out, 'achievement', {
        type: 'achievement', id: a.key, name: a.name,
        scope: a.scope as AchievementScope, rarity: rarityFor(a.scope, a.hidden),
      });
    }
  }

  // ---------- day card (merged across games) ----------
  if (anyDueToday) {
    const bestStreak = Math.max(0, ...states_.flatMap((s) =>
      Object.values(computeStreaks(s.env, s.completions, localDate(new Date(), s.env.ctx.timeZone)).streaks).map((st) => st.current)));
    push(out, 'day', {
      type: 'day', id: `day:${today}`, date: today, quests: dayQuests,
      fullSet: allFullSet, streak: bestStreak,
    });
  }

  // ---------- global candidates ----------
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
    push(out, 'custom_set', item);
  }

  // quest completions also feed the custom set
  for (const c of [...allCompletions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 6)) {
    const q = states_.flatMap((s) => s.env.game.quests).find((q2) => q2.id === c.questId);
    if (!q) continue;
    push(out, 'custom_set', { type: 'quest', id: c.id, title: q.title, pillar: q.pillar, xp: q.xp, date: c.localDate as LocalDate });
  }

  push(out, 'custom_set', { type: 'stat', id: 'stat:level', label: 'Level', value: String(level) });
  const pagesTotal = books.reduce((n, b) => n + b.pagesRead, 0);
  if (pagesTotal > 0) push(out, 'custom_set', { type: 'stat', id: 'stat:pages', label: 'Pages read', value: String(pagesTotal) });

  // journal candidates (decrypted for the preview; only shared if ticked + allowed)
  const journalRows = await loadJournalEntries(db, userId);
  const allCompletionIds = new Map<string, LocalDate>();
  for (const s of states_) for (const c of s.completions) allCompletionIds.set(c.id, c.localDate);
  for (const j of journalRows.slice(0, 4)) {
    if (!j.ciphertext || !j.nonce) continue; // scanned pages have no shareable text
    const d = allCompletionIds.get(j.completion_id);
    try {
      const text = await decryptJournal(j.ciphertext, j.nonce);
      push(out, 'custom_set', { type: 'journal', id: j.id, text, ...(d ? { date: d } : {}) }, true);
    } catch { /* unreadable entry — skip */ }
  }

  // ---------- milestones (sculpture-level, game-agnostic) ----------
  if (sculpture) {
    const decorations = (await loadDecorations(db, sculpture.id)).map((d) => d.type);
    const base = { seed: sculpture.seed, archetype: sculpture.archetype, decorations };
    const milestone = (kind: MilestoneKind, id: string, extra: Record<string, unknown> = {}) =>
      push(out, 'milestone', { type: 'milestone', id, kind, piecesRevealed: sculpture.pieces_revealed, ...base, ...extra } as ShareItem);

    for (const b of books.filter((b) => b.finishedAt)) {
      milestone('book_finished', `milestone:book_finished:${b.id}`, { bookTitle: b.title });
    }
    const weekRowsAll = (await Promise.all(states_.map((s) => loadWeekResults(db, userId, s.game.row.id)))).flat();
    const lastChisel = weekRowsAll.filter((w) => w.pieces > 0).sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    if (lastChisel) milestone('chisel_day', `milestone:chisel_day:${lastChisel.week_start}`, { piecesThisWeek: lastChisel.pieces });
    if (sculpture.pieces_revealed >= Math.ceil(STATUE_PIECES / 2)) milestone('sculpture_halfway', 'milestone:sculpture_halfway');
    if (sculpture.pieces_revealed >= FACE_REVEAL_AT) milestone('face_reveal', 'milestone:face_reveal');
    if (sculpture.status === 'complete') milestone('sculpture_complete', 'milestone:sculpture_complete');
  }

  return out;
}
