# Build progress

Last updated: 2026-09-29. Source of truth: `SPEC.md`. Decisions: `DECISIONS.md`.

| Milestone | Status | Verified |
| --- | --- | --- |
| Spec (`SPEC.md`) | Done | — |
| M1 Core engine (`src/core`) | Done | `tsc -p tsconfig.core.json` clean, tests pass |
| M2 Game 1 config (`src/games`, `supabase/seed.sql`) | Done | 6 scenario tests pass |
| M3 Database (`supabase/migrations`, `supabase/tests`) | Done | `bash scripts/test-db.sh`: 7/7 pass on Postgres 16 |
| M4 Sculpture (`src/sculpture`, `previews/`) | Done | 127 tests pass; previews reviewed |
| M5 Share cards (`src/share`) | **Next** | — |
| M6 Next.js app layer (`src/app`, `src/lib`, `src/components`) | Not started | — |

## How to resume

Open this folder in Claude Code and say:

> Read SPEC.md, DECISIONS.md and PROGRESS.md. Build milestone M5 (SPEC §9), then M6 (SPEC §10). Verify each milestone before moving on and update PROGRESS.md.

## Checks (after `npm install`)

```
npm run typecheck:core   # tsc -p tsconfig.core.json
npm test                 # tsx --test "src/**/*.test.ts"
npm run test:db          # needs Postgres installed (PG_BIN or pg_config on PATH)
npm run previews         # renders previews/*.png
```

## Notes for M5 (share cards)

- Scopes: takeaway, quest, custom_set, day, week, achievement, milestone (book_finished, chisel_day, sculpture_halfway, face_reveal, sculpture_complete).
- Journal text is excluded unless the player explicitly ticks it.
- X intent URL: `https://x.com/intent/post?text=...&url=...`; 280 chars with every URL counted as 23.
- SVG cards 1200×630, light and dark, marble + Greek key border + Cinzel headings + gold #C9A227; reuse pillar symbols from `src/sculpture`.
