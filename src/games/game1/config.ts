// Game 1: Self-Development (SPEC §6). Pure data — the engine has no Game 1 branches.
import type { AchievementDef, GameDef, Pillar, QuestDef, RampStage } from '../../core/types';

export const GAME1_ID = 'g1';

export const game1Pillars: Pillar[] = [
  { id: 'mental', world: 'inner', name: 'Mental', covers: 'focus, learning new skills, controlling thoughts, a growth mindset.' },
  { id: 'physical', world: 'inner', name: 'Physical', covers: 'nutrition, exercise, consistent sleep, daily energy.' },
  { id: 'emotional', world: 'inner', name: 'Emotional', covers: 'emotional intelligence, processing feelings, responding rather than reacting.' },
  { id: 'spiritual', world: 'inner', name: 'Spiritual', covers: 'core values, sense of purpose, deeper meaning.' },
  { id: 'financial', world: 'outer', name: 'Financial', covers: 'managing, saving and investing money; career growth and stability.' },
  { id: 'social', world: 'outer', name: 'Social', covers: 'relationship quality, communication, boundaries.' },
  { id: 'environmental', world: 'outer', name: 'Environmental', covers: 'organized home and workspace, minimal digital clutter.' },
  { id: 'recreational', world: 'outer', name: 'Recreational', covers: 'hobbies, play, relaxation, breaks from work.' },
];

const ANYTIME = { kind: 'anytime' } as const;

export const game1Quests: QuestDef[] = [
  {
    id: 'g1.read', gameId: GAME1_ID, pillar: 'mental', founding: true,
    title: 'Read 10 pages a day from a self-development book',
    schedule: { kind: 'daily' }, window: ANYTIME,
    proof: { type: 'reading', targetPages: 10 }, xp: 20,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.exercise', gameId: GAME1_ID, pillar: 'physical', founding: true,
    title: 'Exercise 4 days a week',
    schedule: { kind: 'weekly_quota', perWeek: 4 }, window: ANYTIME,
    proof: { type: 'duration', minMinutes: 20 }, xp: 30,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.dawn', gameId: GAME1_ID, pillar: 'physical', founding: true,
    title: 'Wake up before the sun rises 5 days a week',
    schedule: { kind: 'weekly_quota', perWeek: 5 },
    window: { kind: 'before_sunrise', fallbackLocalTime: '06:00', earliestLocalTime: '03:00' },
    proof: { type: 'dawn' }, xp: 25,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.journal', gameId: GAME1_ID, pillar: 'emotional', founding: true,
    title: 'Journal once a day',
    schedule: { kind: 'daily' }, window: ANYTIME,
    proof: { type: 'journal', minWords: 50 }, xp: 15,
    unlock: { kind: 'ramp_stage', atLeast: 'apprentice' },
  },
  {
    id: 'g1.stillness', gameId: GAME1_ID, pillar: 'spiritual', founding: false,
    title: '5 minutes of stillness',
    schedule: { kind: 'weekly_quota', perWeek: 5 }, window: ANYTIME,
    proof: { type: 'timer', minSeconds: 300 }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'apprentice' },
  },
  {
    id: 'g1.money', gameId: GAME1_ID, pillar: 'financial', founding: false,
    title: 'Money minute',
    schedule: { kind: 'weekly_quota', perWeek: 5 }, window: ANYTIME,
    proof: { type: 'text', minChars: 3, maxChars: 200 }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'adept' },
  },
  {
    id: 'g1.connect', gameId: GAME1_ID, pillar: 'social', founding: false,
    title: 'One intentional connection',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'text', minChars: 3, maxChars: 200 }, xp: 15,
    unlock: { kind: 'ramp_stage', atLeast: 'adept' },
  },
  {
    id: 'g1.reset', gameId: GAME1_ID, pillar: 'environmental', founding: false,
    title: '10-minute space reset (physical or digital)',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'photo_optional' }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'full_protocol' },
  },
  {
    id: 'g1.play', gameId: GAME1_ID, pillar: 'recreational', founding: false,
    title: '30 minutes of play',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'duration', minMinutes: 30 }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'full_protocol' },
  },
];

// §6.3. Unlocks come from each quest's `unlock` rule; stages only override targets.
export const game1Ramp: RampStage[] = [
  {
    id: 'initiate', fromWeek: 1,
    overrides: {
      'g1.read': { targets: { targetPages: 5 } },
      'g1.exercise': { perWeek: 2 },
      'g1.dawn': { perWeek: 2 },
    },
  },
  {
    id: 'apprentice', fromWeek: 2,
    overrides: {
      'g1.read': { targets: { targetPages: 10 } },
      'g1.exercise': { perWeek: 3 },
      'g1.dawn': { perWeek: 3 },
      'g1.stillness': { perWeek: 3 },
    },
  },
  {
    id: 'adept', fromWeek: 3,
    overrides: {
      'g1.exercise': { perWeek: 4 },
      'g1.dawn': { perWeek: 4 },
      'g1.stillness': { perWeek: 5 },
      'g1.money': { perWeek: 3 },
      'g1.connect': { perWeek: 2 },
    },
  },
  { id: 'full_protocol', fromWeek: 4 },
];

const a = (def: AchievementDef): AchievementDef => def;

export const game1Achievements: AchievementDef[] = [
  a({ id: 'bookworm', name: 'Bookworm', scope: 'mental', hidden: false, rule: { kind: 'count_quantity', questId: 'g1.read', field: 'pages', atLeast: 100 } }),
  a({ id: 'finisher', name: 'Finisher', scope: 'mental', hidden: false, rule: { kind: 'count_events', event: 'book_finished', atLeast: 1 }, decoration: 'laurel_leaf' }),
  a({ id: 'the_library', name: 'The Library', scope: 'mental', hidden: false, rule: { kind: 'count_events', event: 'book_finished', atLeast: 12 } }),
  a({ id: 'first_light', name: 'First Light', scope: 'physical', hidden: false, rule: { kind: 'count_completions', questId: 'g1.dawn', atLeast: 1 } }),
  a({ id: 'early_riser', name: 'Early Riser', scope: 'physical', hidden: false, rule: { kind: 'count_in_week', questId: 'g1.dawn', atLeast: 5 } }),
  a({ id: 'dawn_patrol', name: 'Dawn Patrol', scope: 'physical', hidden: false, rule: { kind: 'count_completions', questId: 'g1.dawn', atLeast: 30 }, decoration: 'plinth_symbol_physical' }),
  a({ id: 'iron_will', name: 'Iron Will', scope: 'physical', hidden: false, rule: { kind: 'weeks_in_a_row', condition: 'quest_on_target', questId: 'g1.exercise', weeks: 4 }, decoration: 'plinth_symbol_physical' }),
  a({ id: 'unbroken', name: 'Unbroken', scope: 'emotional', hidden: false, rule: { kind: 'streak', questId: 'g1.journal', atLeast: 30 }, decoration: 'plinth_symbol_emotional' }),
  a({ id: 'inner_peace', name: 'Inner Peace', scope: 'spiritual', hidden: false, rule: { kind: 'count_completions', questId: 'g1.stillness', atLeast: 30 }, decoration: 'plinth_symbol_spiritual' }),
  a({ id: 'money_minded', name: 'Money Minded', scope: 'financial', hidden: false, rule: { kind: 'count_completions', questId: 'g1.money', atLeast: 30 }, decoration: 'plinth_symbol_financial' }),
  a({ id: 'connector', name: 'Connector', scope: 'social', hidden: false, rule: { kind: 'count_completions', questId: 'g1.connect', atLeast: 25 }, decoration: 'plinth_symbol_social' }),
  a({ id: 'clean_slate', name: 'Clean Slate', scope: 'environmental', hidden: false, rule: { kind: 'count_completions', questId: 'g1.reset', atLeast: 20 }, decoration: 'plinth_symbol_environmental' }),
  a({ id: 'well_played', name: 'Well Played', scope: 'recreational', hidden: false, rule: { kind: 'count_completions', questId: 'g1.play', atLeast: 20 }, decoration: 'plinth_symbol_recreational' }),
  a({ id: 'master_inner', name: 'Master of the Inner World', scope: 'inner', hidden: false, rule: { kind: 'weeks_in_a_row', condition: 'world_on_target', world: 'inner', weeks: 4 }, decoration: 'inner_ring' }),
  a({ id: 'master_outer', name: 'Master of the Outer World', scope: 'outer', hidden: false, rule: { kind: 'weeks_in_a_row', condition: 'world_on_target', world: 'outer', weeks: 4 }, decoration: 'outer_ring' }),
  a({ id: 'well_rounded', name: 'Well-Rounded', scope: 'all', hidden: false, rule: { kind: 'count_events', event: 'balanced_week', atLeast: 1 }, decoration: 'plinth_carving' }),
  a({ id: 'full_protocol', name: 'The Full Protocol', scope: 'all', hidden: false, rule: { kind: 'count_events', event: 'perfect_week', atLeast: 1 }, decoration: 'gold_vein' }),
  a({ id: 'unstoppable', name: 'Unstoppable', scope: 'all', hidden: false, rule: { kind: 'count_events', event: 'perfect_week', atLeast: 12 } }),
  a({ id: 'night_owl_reformed', name: 'Night Owl Reformed', scope: 'physical', hidden: true, rule: { kind: 'after_misses', questId: 'g1.dawn', misses: 10 } }),
  a({ id: 'comeback', name: 'Comeback', scope: 'all', hidden: true, rule: { kind: 'comeback', daysAway: 14 } }),
];

export const game1: GameDef = {
  id: GAME1_ID,
  title: 'Self-Development',
  worlds: {
    inner: { name: 'The Inner World', description: 'internal self-control, thoughts and health.' },
    outer: { name: 'The Outer World', description: 'external lifestyle, environment and daily choices.' },
  },
  pillars: game1Pillars,
  quests: game1Quests,
  ramp: game1Ramp,
  achievements: game1Achievements,
  bonusXp: { fullSet: 25, innerBalance: 50, outerBalance: 50, balancedWeek: 100, perfectWeek: 250 },
  books: { questId: 'g1.read', pagesField: 'pages', bookIdField: 'bookId', finishedXp: 150 },
  eventDecorations: { perfect_week: 'gold_vein', book_finished: 'laurel_leaf', balanced_week: 'plinth_carving' },
  feedsSculpture: true,
};

export default game1;
