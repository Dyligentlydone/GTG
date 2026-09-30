# Gamify the Grind — Build Spec (Phase 0 foundation + Game 1)

This is the source of truth for building the first foundation of **Gamify the Grind**. It is written for a coding agent. Build exactly what is here, in milestone order. When something is ambiguous, choose the simplest option that keeps the rules below true, and write the decision in `DECISIONS.md`.

Product in one line: a platform where "games" are data. Players complete quests, earn XP, streaks and achievements, and (later) earn real money in paid games. **Game 1 (Self-Development)** is free and is the proof of concept. Every account also owns a marble **rock** that Game 1 slowly chisels into an ancient Greek statue with the player's face.

---

## 0. Ground rules

1. **Games are data, not code.** The engine runs any game from its config. Game 1 is config plus a few generic rule types. No `if (game === 'game1')` branches in the engine.
2. **Points and money never mix.** XP lives in `xp_events`. Money lives in a double-entry ledger. No cash moves in this phase; the ledger schema and primitives exist so nothing needs reshaping later.
3. **Append-only history.** `xp_events`, `ledger_entries`, `chisel_events`, `reputation_events` are never updated or deleted. Corrections are new rows.
4. **Balances and totals are computed** (sum of events), never stored as editable numbers. Caches are allowed if they can be rebuilt.
5. **Money is integer cents** with an explicit currency. Never floats.
6. **The core is pure.** Everything in `src/core`, `src/games`, `src/sculpture`, `src/share` has **zero runtime dependencies** (no npm packages, no Node-only APIs except in tests). It must run in Node, the browser and edge runtimes. All time is passed in (no `Date.now()` inside core logic — take a `now` parameter).
7. **Time zones are real.** Every player has an IANA time zone. Days and weeks are computed in the player's local time. Weeks start **Monday 00:00 local**.
8. **Privacy by default.** Journal text is private, never shared unless the player explicitly ticks it. Face photos are only used for the player's own statue.
9. **Out of scope for this phase:** real payouts, crypto/wallets, the Closer money game, Creator Studio, peer review, AI grading, native mobile. Do not build them. Leave the seams (interfaces, table names) described below.

---

## 1. Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (latest stable, App Router) + TypeScript (strict) + Tailwind CSS |
| DB / auth / storage | Supabase (Postgres, Auth with email magic link, Storage, Row Level Security) |
| Payments | Stripe Billing (subscription skeleton only in this phase) |
| Jobs | Vercel Cron hitting protected route handlers |
| Hosting | Vercel + Supabase |
| Tests | Core: `node:test` run through `tsx` (`tsx --test`). DB: SQL test scripts run against a real Postgres. |
| Fonts | Cinzel (headings, carved-stone look) + Inter (UI), via `next/font/google` |

### Build environment constraint (important)

The agent's environment **cannot download npm packages**. Available globally: `node` 22, `tsc` (TypeScript 6), `tsx`, `playwright` (+ Chromium), `sharp`, `react`, `react-dom`, and Postgres 16 binaries in `/usr/lib/postgresql/16/bin` (`initdb`, `pg_ctl`, `postgres`, `psql`).

Therefore:
- Milestones M1–M5 must be fully verified here: typecheck with `tsc -p tsconfig.core.json`, tests with `tsx --test`, DB tests with a throwaway local Postgres.
- M6 (Next.js app) is written against the documented public APIs of Next.js, `@supabase/ssr`, `@supabase/supabase-js` and `stripe`, but is compiled later on the owner's machine. Keep the app layer **thin**: pages and route handlers call core functions; no business rules in the app layer.
- Never run `npm install` here. List dependencies in `package.json` for the owner to install.

---

## 2. Repository layout

```
gamify-the-grind/
  SPEC.md                 this file
  DECISIONS.md            decisions the agent made where the spec was silent
  README.md               how to install, configure and run
  package.json
  tsconfig.json           Next.js app config
  tsconfig.core.json      strict config for the pure core (src/core, src/games, src/sculpture, src/share), excludes *.test.ts
  src/
    core/                 engine: types, rules, schedule, time, sunrise, xp, streaks, weekly scoring, chisel, achievements, ledger, events
    games/game1/          Game 1 config (pillars, quests, ramp, achievements, decorations) + scenario tests
    sculpture/            seeded RNG, rock generator, shards, reveal order, cracks, SVG renderer, statue provider interface
    share/                share scopes, card models, SVG card templates, X intent URL builder
    lib/                  app-side adapters: supabase clients, repositories, auth helpers (M6)
    app/                  Next.js routes (M6)
    components/           React components (M6)
  supabase/
    migrations/           ordered SQL migrations
    seed.sql              generated from src/games/game1 (never hand-edited)
    tests/                SQL test files
  scripts/
    test-db.sh            spins up a temporary Postgres, applies migrations + seed, runs supabase/tests/*.sql
    gen-seed.ts           writes supabase/seed.sql from the Game 1 config
    render-previews.ts    renders rock/sculpture/card SVGs to PNG in previews/ (uses global playwright or sharp)
  previews/               generated PNGs for review
```

`package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `typecheck:core` (`tsc -p tsconfig.core.json`), `test` (`tsx --test "src/**/*.test.ts"`), `test:db` (`bash scripts/test-db.sh`), `gen:seed`, `previews`.

---

## 3. Domain model (core types)

Put these in `src/core/types.ts` (split files if large). Names are normative.

```ts
type PillarId = 'mental' | 'physical' | 'emotional' | 'spiritual'
              | 'financial' | 'social' | 'environmental' | 'recreational';
type World = 'inner' | 'outer';

interface Pillar { id: PillarId; world: World; name: string; covers: string; }

type ProofType = 'checkbox' | 'text' | 'reading' | 'duration' | 'timer' | 'dawn' | 'journal' | 'photo_optional';

type ScheduleRule =
  | { kind: 'daily' }                       // due every active day
  | { kind: 'weekly_quota'; perWeek: number }; // due N times per Monday-week

type WindowRule =
  | { kind: 'anytime' }
  | { kind: 'before_sunrise'; fallbackLocalTime: string /* 'HH:MM' */; earliestLocalTime: string /* 'HH:MM' */ };

interface QuestDef {
  id: string;                 // e.g. 'g1.read'
  gameId: string;
  pillar: PillarId;
  title: string;              // player-facing, e.g. 'Read 10 pages a day from a self-development book'
  founding: boolean;          // true for the four founding habits (shown with ★)
  schedule: ScheduleRule;
  window: WindowRule;
  proof: ProofSpec;           // validation rules (see §5)
  xp: number;
  unlock: UnlockRule;         // see §4
}

type UnlockRule =
  | { kind: 'always' }
  | { kind: 'ramp_stage'; atLeast: RampStageId }
  | { kind: 'all'; rules: UnlockRule[] }
  | { kind: 'any'; rules: UnlockRule[] }
  | { kind: 'min_level'; level: number };

type RampStageId = 'initiate' | 'apprentice' | 'adept' | 'full_protocol';
```

A `Completion` is one accepted check-in: `{ id, userId, questId, localDate /* YYYY-MM-DD in player tz */, completedAt /* ISO UTC */, payload, isRepair }`.

A `PlayerContext` carries everything rules need: `{ userId, timeZone, lat?, lon?, joinedAt, customWakeWindow?, pausedDates: string[], level }`.

---

## 4. Engine rules (M1)

### 4.1 Time utilities (`src/core/time.ts`)
- Pure functions using `Intl.DateTimeFormat` for IANA zones (no libraries):
  - `localDate(instant, tz) -> 'YYYY-MM-DD'`
  - `localTime(instant, tz) -> 'HH:MM'` (24h)
  - `weekStart(localDate) -> 'YYYY-MM-DD'` (the Monday on or before)
  - `addDays(localDate, n)`, `daysBetween(a, b)`
  - `zonedTimeToUtc(localDate, 'HH:MM', tz) -> instant` (must handle DST correctly)
- Tests must cover: America/Costa_Rica (no DST), America/New_York across both DST transitions, Asia/Kolkata (+05:30), Pacific/Auckland (week boundary on a date the US is still on Sunday).

### 4.2 Sunrise (`src/core/sunrise.ts`)
- Implement the NOAA solar calculation (no dependencies): `sunriseUtc(localDate, lat, lon) -> instant | null` (null for polar day/night).
- Accuracy target: within ±3 minutes of published sunrise. Tests: San José, Costa Rica (9.93, −84.08) on 2026-06-21 and 2026-12-21; New York (40.71, −74.01) on 2026-06-21 and 2026-12-21; Tromsø (69.65, 18.96) on 2026-06-21 (null / polar day). Put the expected values you used in the test with their source noted in a comment.

### 4.3 Dawn window (Physical: "Wake up before the sun rises")
`dawnWindow(localDate, ctx) -> { opensAt, closesAt }` (UTC instants):
- If the player set `customWakeWindow` (`{ start: 'HH:MM', end: 'HH:MM' }`, for night-shift workers) use it.
- Otherwise `closesAt = max(sunrise, fallbackLocalTime)` where `fallbackLocalTime = '06:00'`. If sunrise is null or location unknown, use the fallback.
- `opensAt = earliestLocalTime` (`'03:00'`) so a check-in at 11 p.m. the night before never counts.
- A dawn completion is valid only if `opensAt <= completedAt < closesAt`.

### 4.4 Schedule and due counts (`src/core/schedule.ts`)
For a quest, a player and a Monday-week, compute **due count**:
- Active days in the week = days in `[max(weekStart, joinDate), weekStart+6]` minus `pausedDates`, and not after the quest's unlock date.
- `daily`: due = number of active days.
- `weekly_quota`: due = `ceil(perWeek * activeDays / 7)`.
- The ramp stage (below) may override `perWeek` and a quest's numeric targets for that week.
- **Counted completions** for a quest in a week = `min(completions, due)` (extra workouts never over-count). A daily quest counts at most one completion per local date.

### 4.5 Ramp (stages) — first four weeks
Week index is 1 for the Monday-week containing `joinedAt`, 2 for the next, etc.
| Week | Stage | Unlocked pillars |
| --- | --- | --- |
| 1 | initiate | mental, physical |
| 2 | apprentice | + emotional, spiritual (Inner World complete) |
| 3 | adept | + financial, social (Outer World opens) |
| 4+ | full_protocol | + environmental, recreational (all eight) |

Per-stage targets are defined in the Game 1 config (§6). The engine only knows "stage N overrides quest targets".

### 4.6 XP and levels (`src/core/xp.ts`)
- Level 1 starts at 0 XP. XP needed to go from level L to L+1 = `round(100 * 1.15^(L-1))`.
- `levelFromXp(total) -> { level, xpIntoLevel, xpForNext }`. Test values at 0, 99, 100, 215, 10 000 XP.
- XP event sources: `quest`, `full_set`, `inner_balance`, `outer_balance`, `balanced_week`, `perfect_week`, `book_finished`, `achievement`, `share` (share XP = 5, max once per local day).

### 4.7 Streaks (`src/core/streaks.ts`)
- Streaks exist for each **daily** quest, plus a weekly **Perfect Week** streak.
- A day counts for a daily-quest streak if the quest was completed that local date, OR the date is paused, OR a freeze covered it, OR it was repaired.
- **Freezes:** 2 per calendar month (player local). A missed day automatically consumes a freeze if one is left.
- **Repair:** if a day is missed with no freeze left, completing the same quest **twice** on either of the next two local dates (the second completion has `isRepair: true`) restores it. Only one repair per missed day.
- Output: `{ current, longest, freezesLeftThisMonth, repairableDate? }`. A broken streak is reported with `longest` so the UI can show "Your best: N days".

### 4.8 Weekly scoring and Chisel Day (`src/core/weekly.ts`, `src/core/chisel.ts`)
At the close of each Monday-week (Sunday 24:00 local = next Monday 00:00 local), compute a `WeekResult`:
- `due` = sum of due counts over all unlocked quests; `done` = sum of counted completions.
- `completionPct = done / due` (0 if `due` is 0 → treat as a skipped week, 0 pieces, no penalty).
- `perfectWeek` = every unlocked quest has counted completions == due.
- `balancedWeek` = at least one completion in **every unlocked pillar** (only possible to earn once all eight are unlocked; before that, report false).
- `innerBalance` / `outerBalance` = at least one completion in each of that world's four pillars (only once all four are unlocked).
- **Chisel tiers** (pieces that fall on Chisel Day):

| completionPct | pieces |
| --- | --- |
| ≥ 0.75 | 5 |
| ≥ 0.50 and < 0.75 | 2 |
| ≥ 0.25 and < 0.50 | 1 |
| < 0.25 | 0 (cracks stay visible) |

- **Five pieces per week is the absolute maximum.** Nothing else removes pieces. A statue has **120 pieces**; `piecesRevealed` never exceeds 120.
- **Weekly bonuses (XP):** Full Set day +25 (every quest due that day done; computed per day), Inner Balance +50, Outer Balance +50, Balanced Week +100, Perfect Week +250.
- Worked check at full protocol: due = 7 read + 7 journal + 4 exercise + 5 dawn + 5 stillness + 5 money + 3 connect + 3 reset + 3 play = **42**. 32 done → 0.762 → 5 pieces. 31 → 2 pieces. 21 → 2. 20 → 1. 11 → 1. 10 → 0. Write these as tests.
- `closeWeek` must be **idempotent**: running it twice for the same user and week produces one result (keyed by `userId + weekStart`).

### 4.9 Achievements engine (`src/core/achievements.ts`)
Achievements are **data**: `{ id, name, pillar | 'inner' | 'outer' | 'all', hidden, rule: AchievementRule, decoration? }`. Rule types (generic, reusable by any game):
- `count_completions { questId, atLeast }`
- `count_quantity { questId, field, atLeast }` (e.g. total pages read)
- `count_events { event, atLeast }` (e.g. `book_finished`, `perfect_week`, `balanced_week`)
- `streak { questId, atLeast }`
- `weeks_in_a_row { condition: 'quest_on_target', questId, weeks }` and `{ condition: 'world_on_target', world, weeks }`
- `comeback { daysAway }`, `after_misses { questId, misses }` (hidden ones)
Evaluate incrementally from a player-stats snapshot; unlocking is idempotent.

### 4.10 Ledger primitives (`src/core/ledger.ts`)
- `postTransaction({ idempotencyKey, entries: { accountId, amountCents, currency }[] })` validates: ≥2 entries, integer cents, single currency, **sum = 0**. Returns the normalized transaction. Same idempotency key twice → same transaction, no duplicate.
- `balanceOf(accountId, entries)` = sum. No cash flows use this yet.

### 4.11 Event bus (`src/core/events.ts`)
Typed in-process bus: `quest.completed`, `day.closed`, `week.closed`, `achievement.unlocked`, `sculpture.chiseled`, `book.finished`, `share.created`. Handlers are registered by modules (progression, sculpture, notifications) so modules never call each other directly. Handlers must be idempotent.

---

## 5. Proof validation (`src/core/proof.ts`)
Each check-in payload is validated before it becomes a Completion. Return `{ ok: true } | { ok: false, reason }` with a player-friendly reason.

| Proof type | Rule |
| --- | --- |
| `reading` | `pages >= targetPages` (10, or 5 in the initiate stage), `bookId` set, **`takeaway` required: one line, 10–200 characters, no line breaks** |
| `duration` | `minutes >= minMinutes` (exercise 20, play 30), `activity` non-empty |
| `dawn` | valid only inside the dawn window (§4.3); `intention` one line, 3–140 chars |
| `journal` | `text` ≥ 50 words; stored encrypted at rest (app layer), never shared by default |
| `timer` | `seconds >= 300` OR `reflection` one line 3–200 chars (Spiritual) |
| `text` | one line, 3–200 chars (Social, Financial notes) |
| `photo_optional` | `note` 3–200 chars; optional before/after photo refs (Environmental) |

---

## 6. Game 1: Self-Development (M2)

`src/games/game1/config.ts` exports the game as data. Game id `g1`. Free for everyone.

### 6.1 Pillars (two worlds)
**🧘 The Inner World** — internal self-control, thoughts and health.
- **Mental:** focus, learning new skills, controlling thoughts, a growth mindset.
- **Physical:** nutrition, exercise, consistent sleep, daily energy.
- **Emotional:** emotional intelligence, processing feelings, responding rather than reacting.
- **Spiritual:** core values, sense of purpose, deeper meaning.

**🌍 The Outer World** — external lifestyle, environment and daily choices.
- **Financial:** managing, saving and investing money; career growth and stability.
- **Social:** relationship quality, communication, boundaries.
- **Environmental:** organized home and workspace, minimal digital clutter.
- **Recreational:** hobbies, play, relaxation, breaks from work.

### 6.2 Quests (full protocol). ★ = founding habit, wording exactly as written.
| id | Pillar | Title | Schedule | Proof | XP |
| --- | --- | --- | --- | --- | --- |
| g1.read | mental | ★ Read 10 pages a day from a self-development book | daily | reading (+ one-line takeaway) | 20 |
| g1.exercise | physical | ★ Exercise 4 days a week | weekly_quota 4 | duration ≥ 20 min | 30 |
| g1.dawn | physical | ★ Wake up before the sun rises 5 days a week | weekly_quota 5 | dawn | 25 |
| g1.journal | emotional | ★ Journal once a day | daily | journal ≥ 50 words | 15 |
| g1.stillness | spiritual | 5 minutes of stillness | weekly_quota 5 | timer | 10 |
| g1.money | financial | Money minute | weekly_quota 5 | text | 10 |
| g1.connect | social | One intentional connection | weekly_quota 3 | text | 15 |
| g1.reset | environmental | 10-minute space reset (physical or digital) | weekly_quota 3 | photo_optional | 10 |
| g1.play | recreational | 30 minutes of play | weekly_quota 3 | duration ≥ 30 min | 10 |

### 6.3 Ramp overrides
| Stage (week) | Unlocks | Target overrides |
| --- | --- | --- |
| initiate (1) | read, exercise, dawn | read targetPages 5; exercise perWeek 2; dawn perWeek 2 |
| apprentice (2) | + journal, stillness | read 10 pages; exercise 3; dawn 3; stillness 3 |
| adept (3) | + money, connect | exercise 4; dawn 4; stillness 5; money 3; connect 2 |
| full_protocol (4+) | + reset, play | all targets as in §6.2 |

### 6.4 Books
`books { id, userId, title, totalPages, pagesRead, finishedAt }`. Each `g1.read` completion adds its pages. When `pagesRead >= totalPages`, emit `book.finished` (boss battle): +150 XP, a laurel-leaf decoration, a share milestone.

### 6.5 Achievements (data)
| id | Name | Scope | Rule | Decoration |
| --- | --- | --- | --- | --- |
| bookworm | Bookworm | mental | 100 pages read | — |
| finisher | Finisher | mental | 1 book finished | laurel_leaf |
| the_library | The Library | mental | 12 books finished | — |
| first_light | First Light | physical | 1 dawn | — |
| early_riser | Early Riser | physical | 5 dawns in one week | — |
| dawn_patrol | Dawn Patrol | physical | 30 dawns | plinth_symbol_physical |
| iron_will | Iron Will | physical | exercise on target 4 weeks in a row | plinth_symbol_physical |
| unbroken | Unbroken | emotional | 30-day journal streak | plinth_symbol_emotional |
| inner_peace | Inner Peace | spiritual | 30 stillness sessions | plinth_symbol_spiritual |
| money_minded | Money Minded | financial | 30 money minutes | plinth_symbol_financial |
| connector | Connector | social | 25 connections | plinth_symbol_social |
| clean_slate | Clean Slate | environmental | 20 resets | plinth_symbol_environmental |
| well_played | Well Played | recreational | 20 play sessions | plinth_symbol_recreational |
| master_inner | Master of the Inner World | inner | all Inner World quests on target 4 weeks in a row | inner_ring |
| master_outer | Master of the Outer World | outer | all Outer World quests on target 4 weeks in a row | outer_ring |
| well_rounded | Well-Rounded | all | 1 Balanced Week | plinth_carving |
| full_protocol | The Full Protocol | all | 1 Perfect Week | gold_vein |
| unstoppable | Unstoppable | all | 12 Perfect Weeks | — |
| night_owl_reformed | Night Owl Reformed (hidden) | physical | a dawn after 10 missed dawn opportunities in a row | — |
| comeback | Comeback (hidden) | all | returning after 14+ days away | — |

Also: every Perfect Week adds a `gold_vein` decoration; every finished book adds a `laurel_leaf`; every Balanced Week adds `plinth_carving`. Decorations never remove pieces.

### 6.6 Game 1 scenario tests (required)
Simulate players day by day with the real config and assert outcomes:
1. New player joining on a Wednesday: week 1 due counts are prorated; only mental/physical unlocked.
2. Perfect player joining on a Monday, for 30 weeks: reaches 120 pieces exactly at week 24 and never exceeds 120; weekly pieces never exceed 5.
3. A player at ~80% for 10 weeks: 50 pieces.
4. A player who pauses 3 days (travel): due counts shrink, pct unaffected by the pause.
5. Dawn check-ins at 02:59, 05:30 and 06:30 local in San José on a day sunrise is ~05:15 → only 05:30 counts (because closesAt = max(05:15, 06:00) = 06:00; 02:59 is before opensAt).
6. Journal streak with a missed day covered by a freeze, then a second miss repaired by a double day.

---

## 7. Database (M3)

Postgres via Supabase. Migrations in `supabase/migrations/` numbered `0001_...sql`. Every table has `id uuid primary key default gen_random_uuid()` unless noted, `created_at timestamptz not null default now()`.

### 7.1 Tables
- `profiles` (id = auth user id, `handle` unique, `display_name`, `time_zone` not null default 'UTC', `lat`, `lon`, `custom_wake_start` time, `custom_wake_end` time, `joined_at`, `role` in ('player','creator','admin'), `avatar_path`, `face_photo_path`, `face_consent_at`, `status`)
- `plans`, `subscriptions` (`user_id`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_end`), `entitlements` (`plan_id`, `feature_key`, `limit_value`)
- `games` (`slug` unique, `title`, `type` in ('free','paid','earning'), `status`, `config jsonb`, `budget_account_id` nullable)
- `seasons` (`game_id`, `name`, `starts_on`, `ends_on`, `rules jsonb`)
- `quests` (`game_id`, `key` unique per game e.g. 'g1.read', `pillar`, `title`, `founding` bool, `schedule jsonb`, `window jsonb`, `proof jsonb`, `xp int`, `unlock jsonb`, `sort_order`)
- `enrollments` (`user_id`, `game_id`, unique pair, `state`, `started_at`)
- `paused_days` (`user_id`, `local_date`, `reason`) unique pair
- `books` (`user_id`, `title`, `total_pages`, `pages_read` default 0, `finished_at`)
- `completions` (`user_id`, `quest_id`, `local_date`, `completed_at`, `payload jsonb`, `is_repair` bool) — the accepted check-ins
- `takeaways` (`user_id`, `book_id`, `completion_id`, `text` check length 10–200)
- `journal_entries` (`user_id`, `completion_id`, `ciphertext bytea`, `nonce bytea`) — encrypted by the app; never readable by other users or by share rendering
- `xp_events` (`user_id`, `source_type`, `source_id`, `amount int`, `idempotency_key` unique) — append-only
- `streak_freezes` (`user_id`, `month` 'YYYY-MM', `used_on` date)
- `week_results` (`user_id`, `game_id`, `week_start` date, `due`, `done`, `completion_pct numeric(5,4)`, `perfect_week`, `balanced_week`, `inner_balance`, `outer_balance`, `pieces`, unique (`user_id`,`game_id`,`week_start`))
- `achievements` (`key` unique, `game_id`, `name`, `scope`, `hidden`, `rule jsonb`, `decoration`), `user_achievements` (`user_id`, `achievement_id`, `earned_at`, unique pair)
- `sculptures` (`user_id`, `archetype` in ('philosopher','athlete','warrior','orator'), `seed bigint`, `pieces_total` int default 120 check = 120, `pieces_revealed` int default 0 check between 0 and 120, `status` in ('sealed','carving','complete'), `final_image_path`, `rough_image_path`, `completed_at`) — **one active sculpture per user** (partial unique index where status <> 'complete')
- `chisel_events` (`sculpture_id`, `week_start`, `completion_pct`, `pieces` check 0..5, unique (`sculpture_id`,`week_start`)) — append-only
- `sculpture_decorations` (`sculpture_id`, `decoration_type`, `source_type`, `source_id`, `earned_at`)
- `shares` (`user_id`, `scope`, `item_refs jsonb`, `template`, `include_journal` bool default false, `public_slug` unique, `image_path`, `clicks` int, `signups` int, `deleted_at`)
- `referrals` (`referrer_id`, `referred_id` unique, `share_id`)
- `ledger_accounts` (`owner_type`, `owner_id`, `currency` char(3), `kind`), `ledger_transactions` (`idempotency_key` unique, `description`), `ledger_entries` (`transaction_id`, `account_id`, `amount_cents bigint`) — append-only
- `payouts`, `kyc_records`, `reputation_events`, `fraud_flags` — create the tables (Phase 2 seams) with the columns from the blueprint; no app code uses them yet.
- `events` (`user_id`, `name`, `properties jsonb`) — analytics

### 7.2 Integrity rules (enforced in SQL)
- Append-only tables (`xp_events`, `ledger_entries`, `chisel_events`, `reputation_events`): a trigger raises on UPDATE and DELETE.
- Ledger: a **deferred constraint trigger** checks that each transaction's entries sum to 0 at commit.
- `sculptures.pieces_revealed` may only increase and never exceed 120 (trigger).
- A trigger on `chisel_events` insert increments `sculptures.pieces_revealed` by `pieces` (capped at 120) and sets `status` ('carving' once > 0, 'complete' + `completed_at` at 120).
- **Rock at sign-up:** a trigger on `profiles` insert creates the player's sculpture with a random `seed` and status 'sealed', and enrolls them in Game 1. Every account has a rock from day one.

### 7.3 Row Level Security
- Enable RLS on every table.
- Players can read their own rows everywhere; insert only where the app writes on their behalf through server actions (use the service role for `xp_events`, `week_results`, `chisel_events`, `user_achievements`, ledger tables — players cannot insert these directly).
- `journal_entries`: owner only; **no policy grants any other user or the anon role access**.
- `shares`: owner full access; public (anon) can read a share row by `public_slug` only when `deleted_at is null`, via a `security definer` function `get_public_share(slug)` that returns only the rendered fields (never journal content unless `include_journal` is true).
- `games`, `quests`, `achievements`, `plans`: readable by everyone; writable by admins only (`profiles.role = 'admin'`).

### 7.4 DB tests (`supabase/tests/*.sql`, run by `scripts/test-db.sh`)
`test-db.sh` creates a temp data dir with `initdb`, starts Postgres on a free port with `pg_ctl`, creates a stub `auth` schema (`auth.users` table and `auth.uid()` reading `current_setting('request.jwt.claim.sub', true)`), creates roles `anon`, `authenticated`, `service_role`, applies migrations in order, applies `seed.sql`, runs every test file with `psql -v ON_ERROR_STOP=1`, then stops and removes the cluster. Tests use `DO $$ ... $$` blocks that `RAISE EXCEPTION` on failure. Required tests:
1. Inserting a profile creates exactly one sealed sculpture (120 pieces, 0 revealed) and a Game 1 enrollment.
2. A chisel event of 5 raises pieces_revealed to 5; a 6th piece in one event is rejected; totals cap at 120 and status becomes 'complete'.
3. A duplicate chisel event for the same week is rejected.
4. UPDATE/DELETE on `xp_events` fails.
5. An unbalanced ledger transaction fails at commit; a balanced one succeeds.
6. RLS: user A cannot read user B's completions or journal entries; anon can read a public share only through `get_public_share`.
7. Seed: 8 pillars' quests exist for Game 1 with the exact founding titles.

---

## 8. The Sculpture (M4)

### 8.1 Concept
Every account gets a fully set-up block of marble at sign-up. **Only Game 1 chisels it.** Money games and creator games never add pieces. Each qualifying week reveals up to 5 of 120 pieces, bottom-up, **face last**. At best a statue takes 24 weeks; most players take about a year. That is intended.

### 8.2 Generation (`src/sculpture/`), all deterministic from `seed`
- `rng.ts`: a small seeded PRNG (e.g. mulberry32) — never `Math.random`.
- `rock.ts`: rock silhouette = a closed polygon around the statue area with noise-perturbed radius (irregular, chunky, taller than wide), plus 6–12 generated surface cracks. Same seed → identical rock; different seeds → visibly different shapes.
- `shards.ts`: split the rock area into **exactly 120** irregular shards (Voronoi cells from seeded, jittered points clipped to the silhouette; implement the geometry yourself — half-plane clipping of a bounding polygon is fine for 120 cells).
- `revealOrder.ts`: order shards **bottom-up** by centroid y (with small seeded jitter), but force the **head region** (top ~15% of the statue bounding box) to be the **last** shards. Output a permutation of 0..119.
- `cracks.ts`: for a given week in progress, the next 5 shards in the reveal order are "on deck"; `crackIntensity = min(1, weekProgressPct / 0.75)` controls how many crack lines are drawn across those on-deck shards. Cracks never remove pieces.
- `render.ts`: `renderSculptureSvg({ seed, piecesRevealed, weekProgressPct, finalImageHref?, roughImageHref?, decorations })` returns an SVG string. Layers: final image (or placeholder statue) → rough-cut image (or placeholder) visible where revealed shards are "rough" → rock shards covering unrevealed areas. Revealed shards show the statue; unrevealed ones show textured marble rock. Decorations render as simple overlays (laurel leaves on the crown, gold veins, plinth carvings/symbols, inner/outer rings).
- Placeholder statue: a tasteful generic classical bust/figure silhouette in SVG (marble white, subtle shading) used until AI images exist.
- Brand palette: marble `#F4F1EA`, stone `#B9B4AA`, shadow `#6E6A63`, gold `#C9A227`, ink `#1B1B1F`.

### 8.3 Statue provider interface (`src/sculpture/statueProvider.ts`)
```ts
interface StatueProvider {
  generate(input: { facePhotoUrl: string | null; archetype: Archetype; name: string; seed: number }):
    Promise<{ finalImageUrl: string; roughImageUrl: string }>;
}
```
Ship `PlaceholderStatueProvider` (returns the SVG placeholders). The real provider (an image model with face reference) plugs in later. Limit re-rolls: 1 free, more with Pro (entitlement `statue_rerolls`).

### 8.4 Previews (required for review)
`scripts/render-previews.ts` writes PNGs to `previews/`: seeds 1, 2, 3 at 0 pieces; seed 1 at 0, 30, 60, 90, 115, 120 pieces; seed 1 at 60 pieces with 50% week progress (visible cracks on deck); seed 1 complete with decorations.

### 8.5 Tests
Determinism; exactly 120 shards; shards cover the rock (sum of areas within 2% of rock area); reveal order is a permutation; the last 10 revealed shards are all in the head region; on-deck shards are the next 5; `piecesRevealed` clamps to 0..120.

---

## 9. Sharing (M5)

Every win can become a branded card the player posts to X, choosing exactly what goes on it.

### 9.1 Scopes (`src/share/scopes.ts`)
| scope | card shows |
| --- | --- |
| `takeaway` | the one-line takeaway, book title, day number |
| `quest` | one completed quest with pillar and XP |
| `custom_set` | any pillars/items the player ticks |
| `day` | all quests done today + Full Set badge + streak |
| `week` | weekly recap: pips per quest, pages read, dawns, Perfect Week status, pieces chiseled |
| `achievement` | badge name, pillar, rarity |
| `milestone` | `book_finished`, `chisel_day`, `sculpture_halfway` (60), `face_reveal` (first head shard), `sculpture_complete` |

### 9.2 Rules
- Build a `ShareCardModel` from selected item refs; the builder **drops journal text unless `includeJournal === true`**, and even then only the text explicitly ticked.
- Takeaways pass a small offensive-word filter (a short local word list) before a public card is generated; failing returns a reason.
- `xIntentUrl({ text, url })` → `https://x.com/intent/post?text=...&url=...` with correct encoding; text ≤ 280 chars including the URL (X counts every URL as 23 chars).
- Suggested post text per scope (short, no hashtag spam; max one hashtag `#GamifyTheGrind`).
- Share XP: +5, max once per local day.
- Referral rewards are XP/badges/Pro days, **never cash per sign-up**.

### 9.3 Card templates (`src/share/cards.ts`)
SVG, 1200×630. Greek-meets-gaming look: marble background, Greek key (meander) border, Cinzel-style serif headings (use `font-family="Cinzel, Georgia, serif"`), gold accents, the pillar name and a small emblem, the app wordmark "GAMIFY THE GRIND", the player's handle. Two variants: `light` and `dark`. Previews for every scope rendered into `previews/cards/`.

---

## 10. App layer (M6) — written here, compiled on the owner's Mac

Keep every route thin: parse input → load context via repository → call core → persist → emit events.

### 10.1 Pages
| Route | Purpose |
| --- | --- |
| `/` | landing: the rock-to-statue promise, sign-up CTA |
| `/login` | email magic link (Supabase Auth) |
| `/onboarding` | handle, display name, time zone (auto-detected, editable), location (optional, for sunrise), face photo upload + consent checkbox, archetype pick; then the "vision" moment (finished statue shown, then sealed in the rock) |
| `/home` | character sheet: level, XP bar, **wellness wheel** (8 axes, Inner half / Outer half), the rock, today's quests, weekly quota pips, streaks, Chisel Day countdown |
| `/quests/[key]` | check-in form for that quest (validation from core) |
| `/books` | current book, progress, add a book |
| `/journal` | private journal list (owner only) |
| `/sculpture` | full-screen rock/statue with decorations; Pantheon of completed statues |
| `/achievements` | earned + locked (hidden ones show "???") |
| `/share/new` | share sheet: checkboxes per item, live preview, template light/dark, editable post text, Share to X / download / copy link |
| `/s/[slug]` | public share page with the card as its link-preview image and a "Start your own Protocol" CTA carrying the referral code |
| `/admin` | admin only: list/edit games, quests, achievements (forms writing config jsonb) |
| `/settings` | time zone, location, wake window, pause days (sick/travel), delete face photo, delete account |

### 10.2 Route handlers
- `POST /api/checkins` — validate proof via core, insert completion (+ takeaway / encrypted journal / book pages), emit `quest.completed` → XP event, streak update, achievement evaluation, book finish.
- `GET /api/cron/chisel-day` — protected by `CRON_SECRET`; runs hourly; for every player whose local time just passed Monday 00:00, close the previous week via core (`closeWeek`), insert `week_results`, `chisel_events`, bonus XP, decorations. Idempotent.
- `GET /api/share/[slug]/image` — renders the card SVG to PNG (Next.js `ImageResponse` or return SVG with correct content type) for link previews.
- `POST /api/stripe/webhook` — verifies signature, updates `subscriptions` and entitlements. Pro plan only; no checkout UI polish needed yet.

### 10.3 Supabase wiring
`src/lib/supabase/server.ts`, `client.ts`, `middleware.ts` using `@supabase/ssr`. Repositories in `src/lib/repos/*` map DB rows ↔ core types. Service-role client used only in route handlers and cron, never shipped to the browser. Journal encryption: AES-GCM with a key from `JOURNAL_ENCRYPTION_KEY` (Web Crypto).

### 10.4 Brand
Marble and gold with modern gaming glow. Pillars drawn as Greek columns on the temple header (lit when a pillar hits its weekly target). Ranks: Mortal (1–9), Hero (10–24), Demigod (25–49), Olympian (50+). Laurel wreaths frame achievements. Chisel strike + falling stone animation on Chisel Day (CSS/SVG animation; sound optional, off by default).

### 10.5 Environment variables (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `JOURNAL_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_APP_URL`.

---

## 11. Milestones and "done when"

| # | Milestone | Done when |
| --- | --- | --- |
| M1 | Core engine (§3–5) | `tsc -p tsconfig.core.json` clean; `tsx --test` passes; tests cover every rule with the worked numbers in §4.8 |
| M2 | Game 1 config (§6) | config validates; scenario tests §6.6 pass; `scripts/gen-seed.ts` generates `supabase/seed.sql` |
| M3 | Database (§7) | `bash scripts/test-db.sh` passes all §7.4 tests against real Postgres 16 |
| M4 | Sculpture (§8) | tests §8.5 pass; previews rendered and look like a rock turning into a statue, face last |
| M5 | Sharing (§9) | tests pass (journal exclusion, 280-char rule, URL encoding); card previews for every scope rendered |
| M6 | App layer (§10) | all routes/pages written; imports resolve to real files; `README.md` explains install, Supabase setup, env vars, running, deploying; owner compiles with `npm install && npm run build` |

After each milestone: commit with a clear message, and append anything non-obvious to `DECISIONS.md`.

---

## 12. What comes after this spec (do not build now)
Phase 1 beta features (leagues, guilds, accountability partners, notifications, AI takeaway questions, health-app sync), Phase 2 (Closer money game, payouts, trust tiers, Solana USDC rail), Phase 3 (Creator Studio, Robinhood Chain rail). The tables and interfaces above are the seams for them.
