// Test-only fixture game (not exported from the barrel). Mirrors the shape of Game 1 so engine
// tests can exercise real numbers without depending on src/games (built in M2).
import type { Completion, EngineEnv, GameDef, PillarId, PlayerContext, QuestDef, ScheduleRule, UnlockRule, ProofSpec, WindowRule } from '../types';
import { zonedTimeToUtc } from '../time';

const anytime: WindowRule = { kind: 'anytime' };
const stage = (atLeast: 'initiate' | 'apprentice' | 'adept' | 'full_protocol'): UnlockRule => ({ kind: 'ramp_stage', atLeast });

function q(id: string, pillar: PillarId, schedule: ScheduleRule, proof: ProofSpec, xp: number, unlock: UnlockRule, window: WindowRule = anytime): QuestDef {
  return { id, gameId: 'fx', pillar, title: id, founding: false, schedule, window, proof, xp, unlock };
}

export const fixtureGame: GameDef = {
  id: 'fx',
  title: 'Fixture',
  pillars: [
    { id: 'mental', world: 'inner', name: 'Mental', covers: '' },
    { id: 'physical', world: 'inner', name: 'Physical', covers: '' },
    { id: 'emotional', world: 'inner', name: 'Emotional', covers: '' },
    { id: 'spiritual', world: 'inner', name: 'Spiritual', covers: '' },
    { id: 'financial', world: 'outer', name: 'Financial', covers: '' },
    { id: 'social', world: 'outer', name: 'Social', covers: '' },
    { id: 'environmental', world: 'outer', name: 'Environmental', covers: '' },
    { id: 'recreational', world: 'outer', name: 'Recreational', covers: '' },
  ],
  quests: [
    q('fx.read', 'mental', { kind: 'daily' }, { type: 'reading', targetPages: 10 }, 20, stage('initiate')),
    q('fx.exercise', 'physical', { kind: 'weekly_quota', perWeek: 4 }, { type: 'duration', minMinutes: 20 }, 30, stage('initiate')),
    q('fx.dawn', 'physical', { kind: 'weekly_quota', perWeek: 5 }, { type: 'dawn' }, 25, stage('initiate'),
      { kind: 'before_sunrise', fallbackLocalTime: '06:00', earliestLocalTime: '03:00' }),
    q('fx.journal', 'emotional', { kind: 'daily' }, { type: 'journal', minWords: 50 }, 15, stage('apprentice')),
    q('fx.stillness', 'spiritual', { kind: 'weekly_quota', perWeek: 5 }, { type: 'timer', minSeconds: 300 }, 10, stage('apprentice')),
    q('fx.money', 'financial', { kind: 'weekly_quota', perWeek: 5 }, { type: 'text' }, 10, stage('adept')),
    q('fx.connect', 'social', { kind: 'weekly_quota', perWeek: 3 }, { type: 'text' }, 15, stage('adept')),
    q('fx.reset', 'environmental', { kind: 'weekly_quota', perWeek: 3 }, { type: 'photo_optional' }, 10, stage('full_protocol')),
    q('fx.play', 'recreational', { kind: 'weekly_quota', perWeek: 3 }, { type: 'duration', minMinutes: 30 }, 10, stage('full_protocol')),
  ],
  ramp: [
    { id: 'initiate', fromWeek: 1, overrides: { 'fx.read': { targets: { targetPages: 5 } }, 'fx.exercise': { perWeek: 2 }, 'fx.dawn': { perWeek: 2 } } },
    { id: 'apprentice', fromWeek: 2, overrides: { 'fx.exercise': { perWeek: 3 }, 'fx.dawn': { perWeek: 3 }, 'fx.stillness': { perWeek: 3 } } },
    { id: 'adept', fromWeek: 3, overrides: { 'fx.exercise': { perWeek: 4 }, 'fx.dawn': { perWeek: 4 }, 'fx.money': { perWeek: 3 }, 'fx.connect': { perWeek: 2 } } },
    { id: 'full_protocol', fromWeek: 4 },
  ],
  achievements: [],
};

/** Joined Monday 2026-01-05 09:00 Costa Rica → full protocol from week 4 (2026-01-26). */
export function fixtureCtx(overrides: Partial<PlayerContext> = {}): PlayerContext {
  return {
    userId: 'u1',
    timeZone: 'America/Costa_Rica',
    joinedAt: zonedTimeToUtc('2026-01-05', '09:00', 'America/Costa_Rica'),
    pausedDates: [],
    level: 1,
    ...overrides,
  };
}

export function fixtureEnv(ctx: Partial<PlayerContext> = {}, game: GameDef = fixtureGame): EngineEnv {
  return { game, ctx: fixtureCtx(ctx) };
}

let seq = 0;
export function completion(questId: string, localDate: string, extra: Partial<Completion> = {}): Completion {
  seq += 1;
  return {
    id: `c${seq}`,
    userId: 'u1',
    questId,
    localDate,
    completedAt: zonedTimeToUtc(localDate, '08:00', 'America/Costa_Rica'),
    payload: {},
    isRepair: false,
    ...extra,
  };
}
