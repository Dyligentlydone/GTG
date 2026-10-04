// Temple header (SPEC §10.4): wordmark, nav, and the eight pillar columns — a pillar's
// column is lit gold when that pillar hit its weekly target.
import Link from 'next/link';
import { PILLAR_SYMBOLS } from '../sculpture/symbols';
import type { PillarId } from '../core/types';

const NAV = [
  { href: '/games/g1', label: 'Board' },
  { href: '/profile', label: 'Profile' },
  { href: '/books', label: 'Books' },
  { href: '/journal', label: 'Journal' },
  { href: '/sculpture', label: 'Sculpture' },
  { href: '/achievements', label: 'Honors' },
  { href: '/share/new', label: 'Share' },
  { href: '/settings', label: 'Settings' },
];

function Column({ pillar, lit }: { pillar: PillarId; lit: boolean }) {
  const color = lit ? '#C9A227' : '#4a463f';
  return (
    <svg width="18" height="30" viewBox="-9 -15 18 30" aria-hidden="true">
      <path d={PILLAR_SYMBOLS[pillar]} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" style={lit ? { filter: 'drop-shadow(0 0 4px #C9A22788)' } : undefined} />
    </svg>
  );
}

export function TempleHeader({ litPillars = [], handle }: { litPillars?: PillarId[]; handle?: string | null }) {
  const lit = new Set(litPillars);
  const pillars: PillarId[] = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'];
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-sm tracking-[0.3em] text-gold">GAMIFY THE GRIND</Link>
        <div className="mx-2 hidden items-end gap-1 sm:flex" title="Pillars on target this week">
          {pillars.map((p) => <Column key={p} pillar={p} lit={lit.has(p)} />)}
        </div>
        <nav className="ml-auto flex items-center gap-3 text-sm text-shadow">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={n.href === '/games/g1' ? 'font-bold text-gold hover:text-marble' : 'hover:text-marble'}>
              {n.label}
            </Link>
          ))}
          {handle && <span className="text-gold">@{handle}</span>}
          <Link href="/world"
            className="font-display tracking-[0.18em] text-marble whitespace-nowrap hover:text-gold">
            ENTER THE AGORA
          </Link>
        </nav>
      </div>
    </header>
  );
}
