// Temple header (SPEC §10.4): wordmark, nav, and the eight pillar columns — a pillar's
// column is lit gold when that pillar hit its weekly target.
import Link from 'next/link';
import { PILLAR_SYMBOLS } from '../sculpture/symbols';
import { rankForLevel } from '../lib/ranks';
import { HandleMenu } from './HandleMenu';
import type { PillarId } from '../core/types';

const NAV = [
  { href: '/games/g1', label: 'Board' },
  { href: '/books', label: 'Books' },
  { href: '/journal', label: 'Journal' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/sculpture', label: 'Sculpture' },
  { href: '/achievements', label: 'Honors' },
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

interface LevelChip { level: number; xpIntoLevel: number; xpForNext: number; }

export function TempleHeader({ litPillars = [], handle, minimal = false, level }: { litPillars?: PillarId[]; handle?: string | null; minimal?: boolean; level?: LevelChip | null }) {
  const lit = new Set(litPillars);
  const pillars: PillarId[] = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'];
  const links = minimal ? [] : NAV;
  const levelPct = level ? Math.min(100, Math.round((level.xpIntoLevel / level.xpForNext) * 100)) : 0;
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 font-display text-sm tracking-[0.3em] text-gold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GTG" className="h-8 w-8 object-contain" />
          GAMIFYING THE GRIND
        </Link>
        <div className="mx-2 hidden items-end gap-1 sm:flex" title="Pillars on target this week">
          {pillars.map((p) => <Column key={p} pillar={p} lit={lit.has(p)} />)}
        </div>
        <nav className="ml-auto flex items-center gap-3 text-sm text-shadow">
          {links.map((n) => (
            <Link key={n.href} href={n.href}
              className={n.href === '/games/g1' ? 'font-bold text-gold hover:text-marble' : 'hover:text-marble'}>
              {n.label}
            </Link>
          ))}
          {level && (
            <span className="hidden w-28 sm:block" title={`${level.xpIntoLevel} / ${level.xpForNext} XP`}>
              <span className="flex items-baseline justify-between font-display">
                <span className="text-[11px] text-marble">LVL {level.level}</span>
                <span className="text-[9px] tracking-[0.2em] text-gold">{rankForLevel(level.level).name.toUpperCase()}</span>
              </span>
              <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-gradient-to-r from-golddeep via-gold to-[#f8e68a]" style={{ width: `${levelPct}%` }} />
              </span>
            </span>
          )}
          {handle && <HandleMenu handle={handle} />}
          <Link href="/world" title="Enter the agora" aria-label="Enter the agora"
            className="block h-9 w-14 overflow-hidden rounded-sm border border-line hover:border-gold">
            <video autoPlay muted loop playsInline poster="/agora-preview.jpg"
              className="h-full w-full object-cover">
              <source src="/agora-preview.webm" type="video/webm" />
            </video>
          </Link>
        </nav>
      </div>
    </header>
  );
}
