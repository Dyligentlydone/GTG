// Game config validation: a game is data, so the data must be checked before the engine runs it.
import type { AchievementRule, GameDef, QuestDef, UnlockRule, WindowRule } from './types';
import { RAMP_ORDER } from './ramp';

export type ConfigValidation = { ok: true } | { ok: false; errors: string[] };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PILLARS = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'];
const WORLDS = ['inner', 'outer'];
/** Numeric ProofSpec fields a ramp stage may override, per proof type. */
const NUMERIC_TARGETS: Record<string, string[]> = {
  reading: ['targetPages'], duration: ['minMinutes'], timer: ['minSeconds'], journal: ['minWords'], text: ['minChars', 'maxChars'],
};
const PROOF_TYPES = ['checkbox', 'text', 'reading', 'duration', 'timer', 'dawn', 'journal', 'photo_optional'];

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

export function validateGameConfig(game: GameDef): ConfigValidation {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  if (!game.id) err('game.id is required');
  if (!game.title) err('game.title is required');

  // Pillars
  for (const d of duplicates(game.pillars.map((p) => p.id))) err(`duplicate pillar id: ${d}`);
  for (const p of game.pillars) {
    if (!PILLARS.includes(p.id)) err(`unknown pillar id: ${p.id}`);
    if (!WORLDS.includes(p.world)) err(`pillar ${p.id}: unknown world ${p.world}`);
  }
  const pillarIds = new Set<string>(game.pillars.map((p) => p.id));

  // Ramp
  if (game.ramp.length === 0) err('ramp needs at least one stage');
  for (const d of duplicates(game.ramp.map((s) => s.id))) err(`duplicate ramp stage: ${d}`);
  game.ramp.forEach((s, i) => {
    if (!RAMP_ORDER.includes(s.id)) err(`unknown ramp stage: ${s.id}`);
    if (!isPosInt(s.fromWeek)) err(`ramp stage ${s.id}: fromWeek must be a positive integer`);
    const prev = game.ramp[i - 1];
    if (i === 0 && s.fromWeek !== 1) err(`first ramp stage must start at week 1`);
    if (prev && (s.fromWeek <= prev.fromWeek || RAMP_ORDER.indexOf(s.id) <= RAMP_ORDER.indexOf(prev.id))) {
      err(`ramp stage ${s.id} must come after ${prev.id} (in week and stage order)`);
    }
  });

  // Quests
  for (const d of duplicates(game.quests.map((q) => q.id))) err(`duplicate quest id: ${d}`);
  const quests = new Map<string, QuestDef>(game.quests.map((q) => [q.id, q]));
  const checkUnlock = (q: QuestDef, r: UnlockRule): void => {
    if (r.kind === 'ramp_stage' && !game.ramp.some((s) => RAMP_ORDER.indexOf(s.id) >= RAMP_ORDER.indexOf(r.atLeast))) {
      err(`quest ${q.id}: ramp never reaches stage ${r.atLeast}`);
    }
    if (r.kind === 'min_level' && !isPosInt(r.level)) err(`quest ${q.id}: min_level must be a positive integer`);
    if (r.kind === 'all' || r.kind === 'any') r.rules.forEach((x) => checkUnlock(q, x));
  };
  const checkWindow = (q: QuestDef, w: WindowRule): void => {
    if (w.kind === 'before_sunrise' && (!TIME_RE.test(w.fallbackLocalTime) || !TIME_RE.test(w.earliestLocalTime))) {
      err(`quest ${q.id}: window times must be HH:MM`);
    }
  };
  for (const q of game.quests) {
    if (q.gameId !== game.id) err(`quest ${q.id}: gameId ${q.gameId} does not match ${game.id}`);
    if (!pillarIds.has(q.pillar)) err(`quest ${q.id}: pillar ${q.pillar} is not in this game`);
    if (!q.title) err(`quest ${q.id}: title is required`);
    if (!Number.isInteger(q.xp) || q.xp < 0) err(`quest ${q.id}: xp must be a non-negative integer`);
    if (q.schedule.kind === 'weekly_quota' && !(isPosInt(q.schedule.perWeek) && q.schedule.perWeek <= 7)) {
      err(`quest ${q.id}: perWeek must be an integer 1..7`);
    }
    if (!PROOF_TYPES.includes(q.proof.type)) err(`quest ${q.id}: unknown proof type ${q.proof.type}`);
    if (q.proof.type === 'dawn' && q.window.kind !== 'before_sunrise') err(`quest ${q.id}: dawn proof needs a before_sunrise window`);
    checkUnlock(q, q.unlock);
    checkWindow(q, q.window);
  }

  // Overrides reference real quests and real targets
  for (const s of game.ramp) {
    for (const [questId, o] of Object.entries(s.overrides ?? {})) {
      const q = quests.get(questId);
      if (!q) { err(`ramp stage ${s.id}: override for unknown quest ${questId}`); continue; }
      if (o.perWeek !== undefined) {
        if (q.schedule.kind !== 'weekly_quota') err(`ramp stage ${s.id}: perWeek override on non-quota quest ${questId}`);
        if (!(isPosInt(o.perWeek) && o.perWeek <= 7)) err(`ramp stage ${s.id}: perWeek for ${questId} must be 1..7`);
      }
      for (const [k, v] of Object.entries(o.targets ?? {})) {
        if (!(NUMERIC_TARGETS[q.proof.type] ?? []).includes(k)) err(`ramp stage ${s.id}: ${questId} has no numeric target ${k}`);
        if (typeof v !== 'number' || v < 0) err(`ramp stage ${s.id}: target ${k} for ${questId} must be a non-negative number`);
      }
    }
  }

  // Achievements
  for (const d of duplicates(game.achievements.map((a) => a.id))) err(`duplicate achievement id: ${d}`);
  const needQuest = (aid: string, questId: string, mustBeDaily = false) => {
    const q = quests.get(questId);
    if (!q) err(`achievement ${aid}: unknown quest ${questId}`);
    else if (mustBeDaily && q.schedule.kind !== 'daily') err(`achievement ${aid}: streaks exist only for daily quests (${questId})`);
  };
  for (const a of game.achievements) {
    if (!(pillarIds.has(a.scope) || ['inner', 'outer', 'all'].includes(a.scope))) err(`achievement ${a.id}: unknown scope ${a.scope}`);
    const r: AchievementRule = a.rule;
    switch (r.kind) {
      case 'count_completions': case 'count_quantity': case 'count_in_week':
        needQuest(a.id, r.questId); if (!isPosInt(r.atLeast)) err(`achievement ${a.id}: atLeast must be a positive integer`); break;
      case 'streak':
        needQuest(a.id, r.questId, true); if (!isPosInt(r.atLeast)) err(`achievement ${a.id}: atLeast must be a positive integer`); break;
      case 'count_events':
        if (!r.event) err(`achievement ${a.id}: event is required`);
        if (!isPosInt(r.atLeast)) err(`achievement ${a.id}: atLeast must be a positive integer`); break;
      case 'weeks_in_a_row':
        if (r.condition === 'quest_on_target') needQuest(a.id, r.questId);
        else if (!WORLDS.includes(r.world)) err(`achievement ${a.id}: unknown world ${r.world}`);
        if (!isPosInt(r.weeks)) err(`achievement ${a.id}: weeks must be a positive integer`); break;
      case 'comeback':
        if (!isPosInt(r.daysAway)) err(`achievement ${a.id}: daysAway must be a positive integer`); break;
      case 'after_misses':
        needQuest(a.id, r.questId); if (!isPosInt(r.misses)) err(`achievement ${a.id}: misses must be a positive integer`); break;
    }
  }

  if (game.books) {
    const q = quests.get(game.books.questId);
    if (!q) err(`books: unknown quest ${game.books.questId}`);
    else if (q.proof.type !== 'reading') err(`books: quest ${q.id} must use reading proof`);
    if (!Number.isInteger(game.books.finishedXp) || game.books.finishedXp < 0) err('books: finishedXp must be a non-negative integer');
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
