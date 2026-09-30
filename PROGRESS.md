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

## M4 revision: move the sculpture to 3D (decided 2026-09-29)

The owner rejected the hand-drawn SVG statue look. Keep all M4 logic (120 pieces, bottom-up reveal, face last, cracks on deck, tiers, decorations); replace the art.

**Target style:** `docs/statue-style-reference.jpg` — photoreal classical Greek white marble, dramatic museum spotlight, dark plinth, dark background.

**Per-player generation at account creation (background job):**
1. Face photo (with consent) from onboarding.
2. Seeded pick from a pose library inspired by the classics (spear-bearer, discus thrower, orator, philosopher, draped contrapposto) plus seeded variation (build, hair, drapery, plinth). Unique per player, one shared style.
3. Image model with face reference → front view of the player's statue in a locked style prompt.
4. Image-to-3D model → textured GLB. Add a face-detail pass for likeness.
5. Wrap in a procedural 3D marble rock; fracture into exactly 120 pieces (3D Voronoi) using the existing reveal order (head last). Store GLB + fracture data in Supabase Storage.

**Viewer:** three.js / react-three-fiber, rotatable, spotlight lighting; on Chisel Day pieces crack and fall with simple physics. Share cards use a 2D render of the 3D scene.

**Rules:** every figure is draped (chiton/himation) or in heroic armor — no nude figures (app stores and X sharing). Generate once at signup; limited re-rolls. Compress GLBs (Draco, ~50k triangles) for phones. Keep `StatueProvider` as the seam; the SVG placeholder stays only as a fallback while generation runs.
