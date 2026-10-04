// Small shared UI bits.
import { rankForLevel } from '../lib/ranks';
import { PILLAR_SYMBOLS } from '../sculpture/symbols';
import type { PillarId } from '../core/types';

export function XpBar({ level, xpIntoLevel, xpForNext }: { level: number; xpIntoLevel: number; xpForNext: number }) {
  const pct = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100));
  const rank = rankForLevel(level);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-sm text-marble">LVL {level}</span>
        <span className="font-display text-[10px] tracking-[0.25em] text-gold">{rank.name.toUpperCase()}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gradient-to-r from-golddeep via-gold to-[#f8e68a]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-right text-[10px] text-shadow">{xpIntoLevel} / {xpForNext} XP</div>
    </div>
  );
}

export function Pips({ done, due }: { done: number; due: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${done} of ${due}`}>
      {Array.from({ length: due }, (_, i) => (
        <span key={i} className={`inline-block h-2.5 w-2.5 rounded-full ${i < done ? 'bg-gold' : 'border border-shadow'}`} />
      ))}
    </span>
  );
}

export function PillarGlyph({ pillar, size = 18, lit = true }: { pillar: PillarId; size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-9 -9 18 18" aria-hidden="true">
      <path d={PILLAR_SYMBOLS[pillar]} fill="none" stroke={lit ? '#C9A227' : '#6e6a63'} strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StreakChip({ days, unit = 'day' }: { days: number; unit?: 'day' | 'week' }) {
  if (days <= 0) return null;
  return (
    <span className="rounded-full border border-gold/50 px-2 py-0.5 text-xs font-semibold text-gold">
      {days}{unit === 'week' ? 'w' : 'd'}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-display text-lg text-marble">{title}</p>
      {hint && <p className="mt-2 text-sm text-shadow">{hint}</p>}
    </div>
  );
}
