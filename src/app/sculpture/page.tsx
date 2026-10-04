// /sculpture — the full statue view: pieces, decorations, chisel history (SPEC §10.1).
import { computeWeekResult, localDate, weekStart } from '../../core';
import { requireViewer } from '../../lib/viewer';
import { loadEnrolledStates } from '../../lib/shareItems';
import { loadAllSculptures, loadDecorations, loadSculpture } from '../../lib/repos/players';
import { TempleHeader } from '../../components/TempleHeader';
import { StatueSvg } from '../../components/StatueSvg';
import { ChiselCountdown } from '../../components/ChiselCountdown';
import { EmptyState } from '../../components/Bits';

export const metadata = { title: 'Sculpture' };
export const dynamic = 'force-dynamic';

export default async function SculpturePage() {
  const { supabase, user, profile } = await requireViewer('/sculpture');
  // The marble is account-level but carved only by sculpture-feeding games —
  // on-deck cracks reflect that game's current week.
  const states = await loadEnrolledStates(supabase, user.id);
  const sculpture = await loadSculpture(supabase, user.id);
  const all = await loadAllSculptures(supabase, user.id);
  const decorations = sculpture ? await loadDecorations(supabase, sculpture.id) : [];

  const weekPct = Math.max(0, ...states.filter((s) => s.game.def.feedsSculpture).map((s) => {
    const r = computeWeekResult(s.env, weekStart(localDate(new Date(), s.env.ctx.timeZone)), s.completions);
    return r.due > 0 ? r.done / r.due : 0;
  }));

  const { data: chiselRows } = sculpture
    ? await supabase.from('chisel_events').select('week_start, pieces, completion_pct').eq('sculpture_id', sculpture.id).order('week_start', { ascending: false }).limit(12)
    : { data: [] };

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-3xl text-marble">The Sculpture</h1>
        <p className="mt-1 text-sm text-shadow">120 pieces. Face last. Chisel Day is Monday 00:00 your time.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <section className="card flex flex-col items-center p-5">
            {sculpture
              ? <>
                <StatueSvg sculpture={sculpture} decorations={decorations} weekProgressPct={weekPct * 100} idPrefix="page" width={260} />
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(sculpture.pieces_revealed / sculpture.pieces_total) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm text-marble">{sculpture.pieces_revealed} / {sculpture.pieces_total} revealed · {sculpture.archetype} · {sculpture.status}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="label mb-0">Chisel Day in</span>
                  <ChiselCountdown timeZone={profile.time_zone} />
                </div>
              </>
              : <EmptyState title="No marble yet" hint="Your block is cut when your account finishes setup." />}
          </section>

          <div className="space-y-6">
            <section className="card p-5">
              <h2 className="font-display text-lg text-marble">Decorations</h2>
              {decorations.length === 0
                ? <p className="mt-2 text-sm text-shadow">Earned honors appear on the statue — laurel leaves for books, gold veins for perfect weeks, plinth carvings for balance.</p>
                : <ul className="mt-3 space-y-1">
                  {decorations.map((d) => (
                    <li key={d.type} className="flex justify-between text-sm">
                      <span className="capitalize text-marble">{d.type.replace(/_/g, ' ')}</span>
                      <span className="text-gold">×{d.count}</span>
                    </li>
                  ))}
                </ul>}
            </section>

            <section className="card p-5">
              <h2 className="font-display text-lg text-marble">Chisel Days</h2>
              {(chiselRows ?? []).length === 0
                ? <p className="mt-2 text-sm text-shadow">The first strike lands after your first closed week.</p>
                : <ul className="mt-3 space-y-1">
                  {(chiselRows ?? []).map((r) => (
                    <li key={r.week_start as string} className="flex justify-between text-sm">
                      <span className="text-shadow">week of {r.week_start as string}</span>
                      <span className="text-marble">-{r.pieces as number} pieces · {Math.round((r.completion_pct as number) * 100)}%</span>
                    </li>
                  ))}
                </ul>}
            </section>

            {all.length > 1 && (
              <section className="card p-5">
                <h2 className="font-display text-lg text-marble">Hall of finished statues</h2>
                <p className="mt-2 text-sm text-shadow">{all.filter((s2) => s2.status === 'complete').length} complete.</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
