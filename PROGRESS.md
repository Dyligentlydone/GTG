# Build progress

Last updated: 2026-09-29. Source of truth: `SPEC.md`. Decisions: `DECISIONS.md`.

| Milestone | Status | Verified |
| --- | --- | --- |
| Spec (`SPEC.md`) | Done | — |
| M1 Core engine (`src/core`) | Done | `tsc -p tsconfig.core.json` clean, tests pass |
| M2 Game 1 config (`src/games`, `supabase/seed.sql`) | Done | 6 scenario tests pass |
| M3 Database (`supabase/migrations`, `supabase/tests`) | Done | `bash scripts/test-db.sh`: 7/7 pass on Postgres 16 |
| M4 Sculpture (`src/sculpture`, `previews/`) | Done | 127 tests pass; previews reviewed |
| M5 Share cards (`src/share`, `previews/cards/`) | Done | 144 tests pass; card previews for all 7 scopes in light + dark |
| M6 Next.js app layer (`src/app`, `src/lib`, `src/components`) | Done | `tsc --noEmit` clean, 144 tests pass, `next build` succeeds |
| M6 rework: multi-game app shell | Done | lobby `/home` + `/games/[slug]` area; enroll API; cron iterates all games; typecheck/build clean |
| Lobby experience pass | Done | 3D museum-stage hero (three.js port of the demo), live Chisel-Day replay, dust + grain, reveal/tilt/count-up layer; `/preview` dev mock |

## What's next

All six spec milestones are done. The remaining work is operational:

- Run the app end-to-end against a real Supabase project (migrations + `npm run gen:seed`, `faces` bucket, env vars — see README).
- The 3D photoreal statue pipeline below (per-player GLB behind the `StatueProvider` seam) replaces the SVG placeholder art when built.

## Checks (after `npm install`)

```
npm run typecheck        # whole app incl. src/app, src/lib
npm run typecheck:core   # tsc -p tsconfig.core.json
npm test                 # tsx --test "src/**/*.test.ts"
npm run test:db          # needs Postgres installed (PG_BIN or pg_config on PATH)
npm run previews         # renders previews/*.png
npm run build            # next build
```

## Notes for M6 (app layer)

- Keep routes thin: parse input → repository → core → persist → emit events (SPEC §10).
- Env vars in `.env.example` per §10.5; service-role client only in route handlers/cron.
- Journal encryption: AES-GCM with `JOURNAL_ENCRYPTION_KEY` (Web Crypto).
- `src/share` is the card seam: `buildShareCardModel` → `renderShareCardSvg` → PNG in `GET /api/share/[slug]/image`; `xIntentUrl`/`suggestedPostText` for the share sheet.

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

**Rules:**
- Classical accuracy: male statues default to heroic nude (like the Doryphoros, Discobolus, Apollo Belvedere); female statues default to mostly draped (chiton/peplos, like the Venus de Milo or Peplos Kore). Every player can switch to draped at creation.
- Nude statues are 18+ only.
- The face must be the account holder's own: a live selfie check at signup, matched against the uploaded photo, before generation runs.
- Share cards default to a bust / waist-up crop; the full statue is viewable in the app. X may mark full-figure posts as sensitive.
- Future native apps: app-store rules on nudity in user content may require draped as the default there.
- Generate once at signup; limited re-rolls. Compress GLBs (Draco, ~50k triangles) for phones. Keep `StatueProvider` as the seam; the SVG placeholder stays only as a fallback while generation runs.

## The Agora — walkable world prototype (/world)

The lobby vision made real: a first-person Greek courtyard you can walk.
React Three Fiber + Rapier physics (capsule body, gravity, sprint, jump),
PointerLockControls mouse-look, and sensor doorways that route into Next.js
pages — same session, no engine bridging.

- `src/components/world/` — AgoraWorld (canvas + HUD + veil), Player (Rapier
  FPS controller), Courtyard (plaza, colonnade, cypress ring, statue plinth),
  structures (parametric Temple/Column/Brazier, door sensors, glowing doors).
- `src/lib/three/materials.ts` + `statue.ts` — marble texture + the draped
  philosopher extracted from sculptureScene so both scenes share them.
- `/world` is public (middleware) — anonymous visitors can walk the agora.
- `/hall/[slug]` — placeholder interiors; three temples (Hall of
  Self-Development, Library, Gallery) sit around the plaza facing the statue.
- Lobby hero gains a "walk the agora →" link; lobby, auth, and routing are
  otherwise untouched. Chrome desktop target; WASD/Shift/Space/E.

Verified by real playtest: lock → walk → doorway prompt → E → route.
Typecheck clean, 144/144 tests pass.

## Agora-first routing restructure

- `/` is now the landing gate: the live agora orbits slowly behind the
  magic-link form (`LandingWorld` — no player, no doors; `LandingScreen`
  overlay with a lighter `landing-veil`). Signed-in users hitting `/` are
  redirected to `/world`.
- `/world` is now login-gated (removed from PUBLIC_PATHS) — the agora is
  the post-login hub. Auth callback, onboarding completion, and the
  logged-in `/login` bounce all default to `/world`.
- `/profile` — the former lobby (sculpture, enrolled games, rank, week
  stats) moved here; `/home` aliases to it.
- Header nav: Agora · Board · Profile · Books · Journal · Sculpture ·
  Honors · Share · Settings. Check-in "back to board" now targets
  `/games/[slug]`; world veil/HUD links point at `/profile`.
