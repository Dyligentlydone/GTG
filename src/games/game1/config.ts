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
    description: 'Ten pages of a self-development book, every day. Log the page count against a book on your shelf and keep a one-line takeaway.',
    why: 'Ten pages a day compounds into a dozen books a year — small daily cuts, not heroic binges. Every finished book is a boss kill: +150 XP and a laurel leaf carved on your statue.',
    schedule: { kind: 'daily' }, window: ANYTIME,
    proof: { type: 'reading', targetPages: 10 }, xp: 20,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.exercise', gameId: GAME1_ID, pillar: 'physical', founding: true,
    title: 'Exercise 4 days a week (20+ minutes)',
    description: 'Any 20+ minutes of real movement — lift, run, swim, sport, a hard walk — four days a week. Log what you did and for how long.',
    why: 'The body is the statue\'s scaffolding: energy, mood and focus all ride on it. Four weeks on-target carves the Iron Will honor.',
    schedule: { kind: 'weekly_quota', perWeek: 4 }, window: ANYTIME,
    proof: { type: 'duration', minMinutes: 20 }, xp: 30,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.journal', gameId: GAME1_ID, pillar: 'emotional', founding: true,
    title: 'Journal once a day',
    description: 'Write at least 50 words about the day — or scan a handwritten page straight from your notebook. Entries are encrypted at rest; only you can read them.',
    why: 'Putting the day into words turns noise into signal — you respond to your life instead of reacting to it. A 30-day streak carves Unbroken.',
    schedule: { kind: 'daily' }, window: ANYTIME,
    proof: { type: 'journal', minWords: 50 }, xp: 15,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.stillness', gameId: GAME1_ID, pillar: 'spiritual', founding: false,
    title: '5 minutes of stillness',
    description: 'Five minutes of stillness — meditation, prayer, gratitude — or one line on what matters most today.',
    why: 'The pause between feeling and response is a muscle. Five quiet minutes a day trains the part of you that chooses.',
    schedule: { kind: 'weekly_quota', perWeek: 5 }, window: ANYTIME,
    proof: { type: 'timer', minSeconds: 300 }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.money', gameId: GAME1_ID, pillar: 'financial', founding: false,
    title: 'Money minute',
    description: 'Twice a week, update the four numbers that tell the truth about your money: what came in, what you are worth, what you could touch today, and what your life costs per month.',
    why: 'What you measure becomes visible. What becomes visible can be managed.',
    schedule: { kind: 'weekly_quota', perWeek: 2 }, window: ANYTIME,
    proof: {
      type: 'metrics',
      fields: [
        { key: 'weeklyIncome', label: 'Total weekly income', prefix: '$', hint: 'Everything that came in this week — paychecks, side gigs, anything.' },
        { key: 'netWorth', label: 'Net worth', prefix: '$', hint: 'Everything you own minus everything you owe.' },
        { key: 'cashOnHand', label: 'Cash on hand', prefix: '$', hint: 'How much cash could I access today?' },
        { key: 'monthlyBurn', label: 'Monthly burn', prefix: '$', hint: 'How much does it cost me to maintain my current life for one month?' },
      ],
    }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.connect', gameId: GAME1_ID, pillar: 'social', founding: false,
    title: 'One intentional connection',
    description: 'One deliberate act of connection — a call, a message, a meet-up, an act of kindness, or a boundary held.',
    why: 'No one carves alone. Relationships are the load-bearing walls of a good life, and they only hold if you show up on purpose.',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'text', minChars: 3, maxChars: 200 }, xp: 15,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.reset', gameId: GAME1_ID, pillar: 'environmental', founding: false,
    title: '10-minute space reset (physical or digital)',
    description: 'Ten minutes decluttering a space — a room, a desk, an inbox, your phone. Before/after photo optional.',
    why: 'Your space is your mind\'s outer layer. Ten minutes of clearing resets both — and a clean slate compounds.',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'photo_optional' }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
  {
    id: 'g1.play', gameId: GAME1_ID, pillar: 'recreational', founding: false,
    title: '30 minutes of play',
    description: 'Thirty minutes of genuine play — a hobby, a game for fun, sport, time outdoors, or a screen-free break.',
    why: 'Rest is part of the protocol, not a cheat code. A grind with no play is just erosion — play is what makes the rest sustainable.',
    schedule: { kind: 'weekly_quota', perWeek: 3 }, window: ANYTIME,
    proof: { type: 'duration', minMinutes: 30 }, xp: 10,
    unlock: { kind: 'ramp_stage', atLeast: 'initiate' },
  },
];

// §6.3. Unlocks come from each quest's `unlock` rule; stages only override targets.
// All quests currently unlock at initiate — stages remain for future pacing.
export const game1Ramp: RampStage[] = [
  { id: 'initiate', fromWeek: 1 },
  { id: 'apprentice', fromWeek: 2 },
  { id: 'adept', fromWeek: 3 },
  { id: 'full_protocol', fromWeek: 4 },
];

const a = (def: AchievementDef): AchievementDef => def;

export const game1Achievements: AchievementDef[] = [
  a({ id: 'bookworm', name: 'Bookworm', scope: 'mental', hidden: false, rule: { kind: 'count_quantity', questId: 'g1.read', field: 'pages', atLeast: 100 } }),
  a({ id: 'finisher', name: 'Finisher', scope: 'mental', hidden: false, rule: { kind: 'count_events', event: 'book_finished', atLeast: 1 }, decoration: 'laurel_leaf' }),
  a({ id: 'the_library', name: 'The Library', scope: 'mental', hidden: false, rule: { kind: 'count_events', event: 'book_finished', atLeast: 12 } }),
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
