// LobbyView — the shared lobby experience rendered by `/` for both signed-in
// players (personalized data) and visitors (demo sculpture + catalog + CTAs).
// Presentational: every value arrives via props so the page decides auth state.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PillarId } from '../core/types';
import type { SculptureRow } from '../lib/repos/types';
import type { DecorationInput } from '../sculpture';
import { TempleHeader } from './TempleHeader';
import { SculptureHero } from './SculptureHero';
import { AmbientLayer } from './AmbientLayer';
import { Reveal } from './Reveal';
import { TiltCard } from './TiltCard';
import { CountUp } from './CountUp';
import { EnrollButton } from './EnrollButton';
import { EmptyState } from './Bits';
import { ChiselCountdown } from './ChiselCountdown';

export interface LobbyGameCard {
  slug: string;
  title: string;
  badge: string;
  href: string;
  doneToday?: number;
  dueToday?: number;
  weekPct?: number;
}

export interface LobbyDiscoverCard {
  slug: string;
  title: string;
  type: string;
  /** 'enroll' hits the enroll API; 'signin' points at /login. */
  cta: 'enroll' | 'signin';
}

export interface LobbyViewProps {
  handle?: string | null;
  litPillars?: PillarId[];
  sculpture: SculptureRow | null;
  decorations: DecorationInput[];
  /** 0..1 — sculpture-feeding game's current week (drives on-deck glow). */
  carvingWeekPct: number;
  /** Pieces to replay falling on arrival (recent Chisel Day). */
  recentChisel: number;
  /** Chisel countdown zone — the player's tz or a visitor's local zone. */
  timeZone: string;
  /** 'enter the hall' target: /sculpture signed-in, /login anonymous. */
  hallHref: string;
  hallLabel: string;
  level?: { level: number; xpIntoLevel: number; xpForNext: number } | null;
  /** Below-the-fold CTA for anonymous visitors (e.g. "Start your statue"). */
  joinCta?: ReactNode;
  games: LobbyGameCard[];
  discover: LobbyDiscoverCard[];
}

/** Narrative status line under the piece counter (mirrors the 3D demo). */
function statusText(n: number): string {
  if (n === 0) return 'Sealed. Your statue waits inside.';
  if (n < 30) return 'The plinth and feet emerge.';
  if (n < 60) return 'The drapery takes shape.';
  if (n < 90) return 'Halfway there. The body is free.';
  if (n < 110) return 'Shoulders and arms are carved.';
  if (n < 120) return 'Only the face remains.';
  return 'Complete. Your statue enters the Pantheon.';
}

export function LobbyView({
  handle, litPillars = [], sculpture, decorations, carvingWeekPct, recentChisel,
  timeZone, hallHref, hallLabel, level, joinCta, games, discover,
}: LobbyViewProps) {
  const piecesRevealed = sculpture?.pieces_revealed ?? 0;
  const piecesTotal = sculpture?.pieces_total ?? 120;

  return (
    <div className="relative min-h-screen">
      <AmbientLayer />
      <TempleHeader litPillars={litPillars} handle={handle} minimal level={level} />

      {/* -------- HERO: the museum stage -------- */}
      <section className="relative h-[68vh] min-h-[460px] overflow-hidden border-b border-line">
        <SculptureHero
          sculpture={sculpture}
          decorations={decorations}
          weekPct={carvingWeekPct}
          autoChisel={recentChisel}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-6 md:p-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-display text-4xl text-marble md:text-5xl">
                <CountUp value={piecesRevealed} />
                <span className="text-lg text-shadow md:text-xl"> / {piecesTotal} pieces</span>
              </p>
              <p className="mt-1 text-sm text-gold">{statusText(piecesRevealed)}</p>
            </div>
            <div className="text-right">
              <p className="label mb-1">Chisel Day in</p>
              <ChiselCountdown timeZone={timeZone} />
              <div className="mt-2 flex flex-col items-end gap-1">
                <Link href="/world" className="pointer-events-auto text-xs text-gold hover:underline">
                  walk the agora →
                </Link>
                <Link href={hallHref} className="pointer-events-auto text-xs text-stone hover:underline">
                  {hallLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        {joinCta && <Reveal>{joinCta}</Reveal>}

        {/* -------- game cards -------- */}
        {(games.length > 0 || discover.length === 0) && (
        <section>
          <Reveal>
            <h2 className="mb-1 font-display text-lg tracking-[0.2em] text-shadow">
              {level ? 'YOUR GAMES' : 'THE GAMES'}
            </h2>
            <p className="mb-4 text-sm text-shadow">Each arena moves its own needle. Only the founding protocol carves the marble.</p>
          </Reveal>
          {games.length === 0 ? (
            <Reveal><EmptyState title="No games yet" hint="Pick one below — the protocol begins with your first quest." /></Reveal>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {games.map((g, i) => (
              <Reveal key={g.slug} delay={i * 110}>
                <TiltCard>
                  <Link href={g.href} className="card block p-5">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-xl text-marble">{g.title}</h3>
                      <span className="text-xs uppercase tracking-wider text-shadow">{g.badge}</span>
                    </div>
                    {(g.doneToday !== undefined || g.weekPct !== undefined) && (
                      <>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-shadow">Today: <span className="text-gold">{g.doneToday ?? 0}/{g.dueToday ?? 0}</span></span>
                          <span className="text-shadow">Week: <span className="text-gold"><CountUp value={g.weekPct ?? 0} duration={900} />%</span></span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                          <div className="fill-bar h-full rounded-full bg-gold" style={{ '--fill': `${g.weekPct ?? 0}%` } as React.CSSProperties} />
                        </div>
                      </>
                    )}
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
          )}
        </section>
        )}

        {/* -------- discover -------- */}
        {discover.length > 0 && (
          <section>
            <Reveal><h2 className="mb-4 font-display text-lg tracking-[0.2em] text-shadow">DISCOVER</h2></Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {discover.map((g, i) => (
                <Reveal key={g.slug} delay={i * 110}>
                  <TiltCard>
                    <div className="card flex items-center justify-between p-5">
                      <div>
                        <h3 className="font-display text-xl text-marble">{g.title}</h3>
                        <p className="mt-1 text-xs uppercase tracking-wider text-shadow">{g.type}</p>
                      </div>
                      {g.cta === 'enroll'
                        ? <EnrollButton gameSlug={g.slug} />
                        : <Link href="/login" className="btn text-xs">Sign in to enter</Link>}
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-shadow">
          A game is data. A statue is patience. 120 pieces, one week at a time.
        </footer>
      </main>
    </div>
  );
}
