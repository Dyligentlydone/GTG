// Landing (SPEC §10.1 /): the pitch — one marble statue, carved by every game you play.
import Link from 'next/link';
import { renderSculptureSvg } from '../sculpture';
import { game1 } from '../games/game1/config';

export default function LandingPage() {
  const rock = renderSculptureSvg({ seed: 7, piecesRevealed: 0, weekProgressPct: 0, idPrefix: 'land-rock' });
  const statue = renderSculptureSvg({ seed: 7, piecesRevealed: 120, weekProgressPct: 0, idPrefix: 'land-statue' });
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-sm tracking-[0.35em] text-gold">GAMIFY THE GRIND</span>
        <Link href="/login" className="btn">Sign in</Link>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 md:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl leading-tight text-marble md:text-5xl">
            The daily grind, <span className="text-gold">carved in marble</span>.
          </h1>
          <p className="mt-5 max-w-md text-lg text-stone">
            One account, one block of marble. The founding protocol carves it — each week
            you show up, pieces fall, and the statue underneath is you. Face last.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login" className="btn btn-primary">Enter the arena</Link>
            <Link href="/sculpture" className="btn">See the sculpture</Link>
          </div>
        </div>
        <div className="flex items-end justify-center gap-4">
          <div className="w-36 opacity-70 md:w-44" dangerouslySetInnerHTML={{ __html: rock }} />
          <div className="pb-8 text-center text-2xl text-gold">→</div>
          <div className="w-36 md:w-44" dangerouslySetInnerHTML={{ __html: statue }} />
        </div>
      </section>

      <section className="border-t border-line py-10">
        <h2 className="font-display text-xs tracking-[0.3em] text-shadow">THE CATALOG</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-marble">{game1.title} I</h3>
              <span className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">Live · Free · Carves the marble</span>
            </div>
            <p className="mt-2 text-sm text-stone">
              The founding protocol — {game1.quests.length} quests across {game1.pillars.length} pillars,
              split between the Inner and Outer Worlds. This is the game that chisels your statue.
            </p>
            <p className="mt-3 text-xs text-shadow">
              {game1.pillars.map((p) => p.name).join(' · ')}
            </p>
          </div>
          <div className="card flex flex-col items-center justify-center border-dashed py-10 text-center">
            <p className="font-display text-sm tracking-[0.2em] text-shadow">GAME II</p>
            <p className="mt-2 max-w-56 text-xs text-stone">
              In the forge. New games plug into your profile — XP, honors, streaks.
              The marble stays the founding protocol's work.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-shadow">
        A game is data. A statue is patience. 120 pieces, one week at a time.
      </footer>
    </main>
  );
}
