// Deterministic, in-memory game simulator for scenario tests and previews. Drives one player day
// by day through the real engine: check-ins (with proof validation), pauses, week closes (Chisel
// Day), XP, streaks, books, achievements and decorations. Works for any GameDef.
import type {
  AchievementDef, Completion, EngineEnv, GameDef, InstantLike, LocalDate, LocalTime, PlayerContext, ProofSpec, QuestDef, WakeWindow, XpEvent,
} from '../core/types';
import { addDays, isoDayOfWeek, localDate, toInstant, weekStart, zonedTimeToUtc } from '../core/time';
import { effectiveQuest, stageForDate } from '../core/ramp';
import { questWeekSchedule } from '../core/schedule';
import { validateCheckIn, type ProofResult } from '../core/proof';
import { closeWeek, memoryWeekResultStore, weekClosesAt, type WeekResult } from '../core/weekly';
import { applyChisel } from '../core/chisel';
import { bookFinishedXpEvent, levelFromXp, questXpEvent, totalXp } from '../core/xp';
import { computeStreaks, type StreaksOutput } from '../core/streaks';
import { buildPlayerStats, evaluateAchievements } from '../core/achievements';
import { addPages, type Book } from '../core/books';

export interface SimOptions {
  game: GameDef;
  timeZone: string;
  joinedAt: InstantLike;
  userId?: string;
  lat?: number;
  lon?: number;
  customWakeWindow?: WakeWindow;
  /** Pages per auto-created book (a new book starts when one is finished). */
  bookPages?: number;
}

export interface Decoration { type: string; sourceType: 'event' | 'achievement'; sourceId: string; }
export interface ChiselRecord { weekStart: LocalDate; tierPieces: number; applied: number; piecesRevealed: number; }

const DEFAULT_TIMES: Partial<Record<ProofSpec['type'], LocalTime>> = { dawn: '05:00' };

export class GameSimulator {
  readonly game: GameDef;
  readonly ctx: PlayerContext;
  readonly completions: Completion[] = [];
  readonly xpEvents: XpEvent[] = [];
  readonly weekResults: WeekResult[] = [];
  readonly chisel: ChiselRecord[] = [];
  readonly decorations: Decoration[] = [];
  readonly earned: string[] = [];
  readonly books: Book[] = [];
  piecesRevealed = 0;
  private readonly store = memoryWeekResultStore();
  private readonly bookPages: number;
  private seq = 0;

  constructor(opts: SimOptions) {
    this.game = opts.game;
    this.ctx = {
      userId: opts.userId ?? 'player-1',
      timeZone: opts.timeZone,
      joinedAt: toInstant(opts.joinedAt),
      pausedDates: [],
      level: 1,
      ...(opts.lat !== undefined ? { lat: opts.lat } : {}),
      ...(opts.lon !== undefined ? { lon: opts.lon } : {}),
      ...(opts.customWakeWindow ? { customWakeWindow: opts.customWakeWindow } : {}),
    };
    this.bookPages = opts.bookPages ?? 200;
  }

  get env(): EngineEnv { return { game: this.game, ctx: this.ctx }; }
  get joinDate(): LocalDate { return localDate(this.ctx.joinedAt, this.ctx.timeZone); }
  get totalXp(): number { return totalXp(this.xpEvents); }
  get booksFinished(): number { return this.books.filter((b) => b.finishedAt !== null).length; }

  quest(id: string): QuestDef {
    const q = this.game.quests.find((x) => x.id === id);
    if (!q) throw new Error(`Unknown quest ${id}`);
    return q;
  }

  pause(...dates: LocalDate[]): void {
    for (const d of dates) if (!this.ctx.pausedDates.includes(d)) this.ctx.pausedDates.push(d);
  }

  /** A valid payload for the quest's effective proof on `date`. */
  defaultPayload(quest: QuestDef, date: LocalDate): Record<string, unknown> {
    const proof = effectiveQuest(quest, stageForDate(this.game.ramp, date, this.ctx)).proof;
    switch (proof.type) {
      case 'reading': return { pages: proof.targetPages, bookId: this.currentBook().id, takeaway: 'Small steps compound every day.' };
      case 'duration': return { minutes: proof.minMinutes, activity: 'Session' };
      case 'dawn': return { intention: 'Own the morning' };
      case 'journal': return { text: Array.from({ length: proof.minWords ?? 50 }, (_, i) => `word${i}`).join(' ') };
      case 'timer': return { seconds: proof.minSeconds ?? 300 };
      case 'text': return { text: 'Did it today' };
      case 'photo_optional': return { note: 'Cleared the desk' };
      case 'checkbox': return {};
    }
  }

  private currentBook(): Book {
    let book = this.books.find((b) => b.finishedAt === null);
    if (!book) {
      book = { id: `book-${this.books.length + 1}`, userId: this.ctx.userId, title: `Book ${this.books.length + 1}`, totalPages: this.bookPages, pagesRead: 0, finishedAt: null };
      this.books.push(book);
    }
    return book;
  }

  /** Check in at a local date/time. Returns the proof result; accepted check-ins become Completions. */
  checkIn(questId: string, date: LocalDate, opts: { time?: LocalTime; payload?: Record<string, unknown>; isRepair?: boolean } = {}): ProofResult {
    const quest = this.quest(questId);
    const time = opts.time ?? DEFAULT_TIMES[quest.proof.type] ?? '08:00';
    const completedAt = zonedTimeToUtc(date, time, this.ctx.timeZone);
    const payload = opts.payload ?? this.defaultPayload(quest, date);
    const result = validateCheckIn(quest, payload, completedAt, this.env);
    if (!result.ok) return result;
    this.seq += 1;
    const c: Completion = {
      id: `${this.ctx.userId}-c${this.seq}`, userId: this.ctx.userId, questId, localDate: result.localDate ?? date,
      completedAt, payload, isRepair: opts.isRepair ?? false,
    };
    this.completions.push(c);
    if (!c.isRepair) this.xpEvents.push(questXpEvent(this.ctx.userId, c.id, quest.xp));
    this.applyBookPages(c);
    return { ok: true };
  }

  private applyBookPages(c: Completion): void {
    const rule = this.game.books;
    if (!rule || rule.questId !== c.questId || c.isRepair) return;
    const pages = c.payload[rule.pagesField];
    const bookId = c.payload[rule.bookIdField];
    const i = this.books.findIndex((b) => b.id === bookId);
    if (typeof pages !== 'number' || i < 0) return;
    const { book, finishedNow } = addPages(this.books[i]!, pages, c.completedAt);
    this.books[i] = book;
    if (finishedNow) {
      this.xpEvents.push(bookFinishedXpEvent(this.ctx.userId, book.id, rule.finishedXp));
      this.addEventDecoration('book_finished', book.id);
    }
  }

  private addEventDecoration(event: 'perfect_week' | 'balanced_week' | 'book_finished', sourceId: string): void {
    const type = this.game.eventDecorations?.[event];
    if (type) this.decorations.push({ type, sourceType: 'event', sourceId: `${event}:${sourceId}` });
  }

  /** Quests a "perfect" player does on `date`: every daily quest, and quota quests with quota still open. */
  dueOn(date: LocalDate): QuestDef[] {
    const week = weekStart(date);
    return this.game.quests.filter((q) => {
      const s = questWeekSchedule(q, week, this.env);
      if (!s.activeDays.includes(date)) return false;
      if (q.schedule.kind === 'daily') return true;
      const done = this.completions.filter((c) => c.questId === q.id && !c.isRepair && c.localDate >= week && c.localDate < date).length;
      return done < s.due;
    });
  }

  /** Every due slot of a week (questId, date), interleaved day by day. */
  weekSlots(week: LocalDate): Array<{ questId: string; date: LocalDate }> {
    const perQuest = this.game.quests.map((q) => {
      const s = questWeekSchedule(q, week, this.env);
      return s.activeDays.slice(0, s.due).map((date) => ({ questId: q.id, date }));
    });
    const out: Array<{ questId: string; date: LocalDate }> = [];
    for (let i = 0; i < 7; i++) for (const list of perQuest) { const x = list[i]; if (x) out.push(x); }
    return out;
  }

  /** Close a Monday-week (Chisel Day). Idempotent. */
  closeWeek(week: LocalDate): WeekResult {
    const now = weekClosesAt(week, this.ctx.timeZone);
    const { result, created } = closeWeek({ env: this.env, weekStart: week, completions: this.completions, now }, this.store);
    if (!created) return result;
    this.weekResults.push(result);
    this.xpEvents.push(...result.bonusXp);
    const step = applyChisel(this.piecesRevealed, result.pieces);
    this.piecesRevealed = step.piecesRevealed;
    this.chisel.push({ weekStart: week, tierPieces: result.pieces, applied: step.applied, piecesRevealed: step.piecesRevealed });
    if (result.perfectWeek) this.addEventDecoration('perfect_week', week);
    if (result.balancedWeek) this.addEventDecoration('balanced_week', week);
    this.evaluate(addDays(week, 6));
    return result;
  }

  streaks(today: LocalDate): StreaksOutput {
    return computeStreaks(this.env, this.completions, today);
  }

  /** Evaluates achievements as of `today`; returns newly unlocked ones. */
  evaluate(today: LocalDate): AchievementDef[] {
    const streaks = this.streaks(today).streaks;
    const longestStreaks = Object.fromEntries(Object.values(streaks).map((s) => [s.questId, s.longest]));
    const stats = buildPlayerStats({
      env: this.env, completions: this.completions, weekResults: this.weekResults, today,
      eventCounts: { book_finished: this.booksFinished }, longestStreaks,
    });
    const fresh = evaluateAchievements(this.game.achievements, stats, this.earned);
    const eventTypes = new Set(Object.values(this.game.eventDecorations ?? {}));
    for (const a of fresh) {
      this.earned.push(a.id);
      // An achievement whose decoration is also a per-event decoration is already covered by that event.
      if (a.decoration && !eventTypes.has(a.decoration)) this.decorations.push({ type: a.decoration, sourceType: 'achievement', sourceId: a.id });
    }
    this.ctx.level = levelFromXp(this.totalXp).level;
    return fresh;
  }

  /**
   * Runs dates `from..to` inclusive: `plan(date)` performs the day's check-ins; achievements are
   * evaluated at the end of each day and the week is closed after each Sunday.
   */
  run(from: LocalDate, to: LocalDate, plan: (date: LocalDate, sim: GameSimulator) => void): void {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      plan(d, this);
      this.evaluate(d);
      if (isoDayOfWeek(d) === 6) this.closeWeek(weekStart(d));
    }
  }

  /** Plan: do everything due each day. */
  static perfectDay(date: LocalDate, sim: GameSimulator): void {
    for (const q of sim.dueOn(date)) sim.checkIn(q.id, date);
  }
}
