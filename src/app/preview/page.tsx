// /preview — dev-only mock of the /home experience so the lobby can be seen
// without a Supabase project. Renders 404 in production.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TempleHeader } from '../../components/TempleHeader';
import { SculptureHero } from '../../components/SculptureHero';
import { AmbientLayer } from '../../components/AmbientLayer';
import { Reveal } from '../../components/Reveal';
import { TiltCard } from '../../components/TiltCard';
import { CountUp } from '../../components/CountUp';
import { EmptyState, XpBar } from '../../components/Bits';
import { ChiselCountdown } from '../../components/ChiselCountdown';
import type { SculptureRow } from '../../lib/repos/types';

export const metadata = { title: 'Lobby preview' };
export const dynamic = 'force-dynamic';

function statusText(n: number): string {
  if (n === 0) return 'Sealed. Your statue waits inside.';
  if (n < 30) return 'The plinth and feet emerge.';
  if (n < 60) return 'The drapery takes shape.';
  if (n < 90) return 'Halfway there. The body is free.';
  if (n < 110) return 'Shoulders and arms are carved.';
  if (n < 120) return 'Only the face remains.';
  return 'Complete. Your statue enters the Pantheon.';
}

const MOCK_SCULPTURE: SculptureRow = {
  id: 'preview', user_id: 'preview', archetype: 'philosopher', seed: 7,
  pieces_total: 120, pieces_revealed: 47, status: 'carving',
  final_image_path: null, rough_image_path: null, completed_at: null,
};

const MOCK_GAMES = [
  { slug: 'g1', title: 'Self-Development', type: 'free', doneToday: 4, dueToday: 6, weekPct: 62, carves: true },
  { slug: 'g2', title: 'The Iron Path', type: 'free', doneToday: 2, dueToday: 3, weekPct: 40, carves: false },
];
const MOCK_DISCOVER = [{ slug: 'g3', title: 'Ledger of the Deep', type: 'earning' }];

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const weekPct = 0.62;
  const recentChisel = 5; // pretend a Chisel Day just landed — watch the pieces fall
  const piecesRevealed = MOCK_SCULPTURE.pieces_revealed;
  const decorations = [{ type: 'laurel_leaf', count: 2 }, { type: 'gold_vein', count: 1 }];

  return (
    <div className="relative min-h-screen">
      <AmbientLayer />
      <TempleHeader litPillars={['mental', 'physical', 'emotional']} handle="preview" />

      <section className="relative h-[68vh] min-h-[460px] overflow-hidden border-b border-line">
        <SculptureHero
          sculpture={MOCK_SCULPTURE}
          decorations={decorations}
          weekPct={weekPct}
          autoChisel={recentChisel}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-10">
          <div>
            <h1 className="text-shimmer font-display text-3xl tracking-[0.15em] md:text-4xl">THE AGORA</h1>
            <p className="mt-2 text-sm text-stone">
              Chisel Day — {recentChisel} pieces fell this week.
            </p>
          </div>
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-display text-4xl text-marble md:text-5xl">
                <CountUp value={piecesRevealed} />
                <span className="text-lg text-shadow md:text-xl"> / 120 pieces</span>
              </p>
              <p className="mt-1 text-sm text-gold">{statusText(piecesRevealed)}</p>
            </div>
            <div className="text-right">
              <p className="label mb-1">Chisel Day in</p>
              <ChiselCountdown timeZone="America/New_York" />
              <div className="mt-2">
                <span className="text-xs text-gold">enter the hall →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <Reveal>
          <section className="card p-5">
            <XpBar level={4} xpIntoLevel={340} xpForNext={600} />
          </section>
        </Reveal>

        <section>
          <Reveal>
            <h2 className="mb-1 font-display text-lg tracking-[0.2em] text-shadow">YOUR GAMES</h2>
            <p className="mb-4 text-sm text-shadow">Each arena moves its own needle. Only the founding protocol carves the marble.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_GAMES.map((g, i) => (
              <Reveal key={g.slug} delay={i * 110}>
                <TiltCard>
                  <Link href="/preview" className="card block p-5">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-xl text-marble">{g.title}</h3>
                      <span className="text-xs uppercase tracking-wider text-shadow">
                        {g.carves ? 'carves the marble' : g.type}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-shadow">Today: <span className="text-gold">{g.doneToday}/{g.dueToday}</span></span>
                      <span className="text-shadow">Week: <span className="text-gold"><CountUp value={g.weekPct} duration={900} />%</span></span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="fill-bar h-full rounded-full bg-gold" style={{ '--fill': `${g.weekPct}%` } as React.CSSProperties} />
                    </div>
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section>
          <Reveal><h2 className="mb-4 font-display text-lg tracking-[0.2em] text-shadow">DISCOVER</h2></Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_DISCOVER.map((g, i) => (
              <Reveal key={g.slug} delay={i * 110}>
                <TiltCard>
                  <div className="card flex items-center justify-between p-5">
                    <div>
                      <h3 className="font-display text-xl text-marble">{g.title}</h3>
                      <p className="mt-1 text-xs uppercase tracking-wider text-shadow">{g.type}</p>
                    </div>
                    <span className="btn text-xs">Enter</span>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {MOCK_GAMES.length === 0 && <EmptyState title="No games yet" />}
      </main>
    </div>
  );
}
