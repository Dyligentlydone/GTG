# Gamify the Grind — dev notes

## Local Supabase (Docker via OrbStack)

- `supabase start` / `supabase stop` — full local stack (Postgres, GoTrue, PostgREST,
  Realtime, Storage, Mailpit). Migrations + `supabase/seed.sql` apply automatically.
- `supabase db reset` — wipe + re-migrate + re-seed.
- API: `http://127.0.0.1:54321` · Studio: `http://127.0.0.1:54323` ·
  Mailpit (all auth emails): `http://127.0.0.1:54324`
- `.env.local` holds the local publishable/secret keys + `JOURNAL_ENCRYPTION_KEY`,
  `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` — never commit it (gitignored).
- Login is magic-link only: `/login` → enter email → click the link in Mailpit.
  Confirmations are disabled locally so sign-in is instant.
- `docker` CLI lives at `~/.orbstack/bin/docker` (symlinked into `/opt/homebrew/bin`).
  `supabase` CLI also lives in `/opt/homebrew/bin` (installed manually — brew was
  blocked by outdated CLT).

## App

- `npm run dev` → http://localhost:3000
- `npx tsc --noEmit` — typecheck (no separate lint/test gate yet)
- `/world` — the Agora 3D lobby (public). Authed pages redirect to `/login?next=...`.
- Temple doors route: Self-Development → `/games/g1`, Library → `/books`,
  Gallery → `/sculpture` (see `src/app/world/page.tsx` DESTINATIONS).
- Screenshot the world headless: `node /tmp/worldshot.mjs <azimuth[,radius]>`
  writes `/tmp/statue_cam<deg>.png` via the `?cam=` dev param.

## Git

- Remote: `git@github.com:Dyligentlydone/GTG.git`, branch `master`.
- `uploaded images/` is gitignored (large source assets, e.g. the Meshy `.mov`).

## Gotchas

- NEVER run `npm run build` while `npm run dev` is running — they share `.next/` and the production build corrupts dev chunks (`Cannot find module './NNNN.js'`). Kill the dev server first, or check `lsof -ti :3000`.
