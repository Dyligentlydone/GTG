// Landing (SPEC §10.1 /): the pitch — a marble rock that becomes you.
import Link from 'next/link';
import { renderSculptureSvg } from '../sculpture';

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
            Nine quests. Eight pillars. One block of marble. Every week you show up,
            pieces fall — and the statue underneath is you. Face last.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login" className="btn btn-primary">Start the protocol</Link>
            <Link href="/sculpture" className="btn">See the sculpture</Link>
          </div>
        </div>
        <div className="flex items-end justify-center gap-4">
          <div className="w-36 opacity-70 md:w-44" dangerouslySetInnerHTML={{ __html: rock }} />
          <div className="pb-8 text-center text-2xl text-gold">→</div>
          <div className="w-36 md:w-44" dangerouslySetInnerHTML={{ __html: statue }} />
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-shadow">
        A game is data. A statue is patience. 120 pieces, one week at a time.
      </footer>
    </main>
  );
}
