# Gamify the Grind

A gamified self-development platform. Games are **data** run by a pure, zero-dependency
TypeScript engine — Game 1 is a self-development protocol: nine quests across eight
pillars, XP, streaks, achievements… and a marble rock that is slowly chiseled into a
statue of you. Face last.

```
src/core        Pure game engine — no npm deps, no Date.now (time is an input)
src/games       Game 1 config (data, not code) + simulator + seed generator
src/sculpture   Seeded marble sculpture: rock → 120 Voronoi shards → SVG render
src/share       Share cards: scopes, privacy filter, SVG templates, X intent
src/lib         App layer: Supabase clients, repos, orchestration, crypto
src/app         Next.js App Router: pages + route handlers
src/components  UI components (server + client)
supabase/       Migrations (schema, RLS, append-only triggers) + pg tests
scripts/        Seed generator, preview renderer, DB test runner
```

## Requirements

- Node 20+
- A Supabase project (hosted or local `supabase start`)
- Postgres for the DB tests

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **server only** |
| `JOURNAL_ENCRYPTION_KEY` | 32 bytes, base64 (`openssl rand -base64 32`) |
| `CRON_SECRET` | Bearer token for the chisel-day cron |
| `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |
| `STRIPE_*` | Optional — billing skeleton |

## Database

Apply the migrations (in order, they're numbered), then seed Game 1:

```bash
# hosted: paste each migration into the SQL editor, or link + push with the CLI
supabase db push

# generate and apply the Game 1 seed (games/quests/achievements rows)
npm run gen:seed           # writes supabase/seed.sql
```

Then in the Supabase dashboard create a **private** storage bucket named `faces`
(onboarding uploads face photos there).

Every signup automatically gets a sealed sculpture and a Game 1 enrollment
(migration `0009`).

## Develop

```bash
npm run dev          # http://localhost:3000
```

Sign in with an email magic link. The first login walks you through onboarding
(handle → time zone → face photo → archetype → the vision moment).

## Verify

```bash
npm run typecheck        # app + lib + share + sculpture
npm run typecheck:core   # pure core only (strictest settings)
npm test                 # core/share/sculpture unit tests
npm run test:db          # pg tests against a local Postgres
npm run previews         # renders sculpture + share card PNGs to previews/
npm run build            # production build
```

## Cron

`GET /api/cron/chisel-day` closes the just-ended Monday-week for every enrolled
player whose local time has passed it (hourly schedule is enough). Guard it with:

```
Authorization: Bearer $CRON_SECRET
```

On Vercel, add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/chisel-day", "schedule": "0 * * * *" }] }
```

## Architecture notes

- **Games are data.** The engine has no `if (game === 'g1')` — Game 1 is rows in
  `games`/`quests`/`achievements`, loaded into a `GameDef` at the edge.
- **Append-only history.** `xp_events`, `chisel_events`, `ledger_entries` can't be
  updated or deleted (triggers). Balances and totals are computed from events.
- **Service role is server-only.** Pages read through the user's session (RLS);
  route handlers use the service client for writes the player isn't granted.
- **Journal is encrypted at rest.** AES-256-GCM with `JOURNAL_ENCRYPTION_KEY`;
  decrypted only for the owner. Public shares strip journal items in SQL.
- **The sculpture is driven by one number:** `pieces_revealed` (0–120), advanced
  only by `chisel_events` inserts. The SVG renderer is a pure function of it.
