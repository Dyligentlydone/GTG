// Wellness wheel (SPEC §10.1 /home): 8 axes, Inner World on the left half, Outer World
// on the right. Each axis fills to that pillar's weekly completion (0..1).
import type { PillarId } from '../core/types';

const ORDER: PillarId[] = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'];
const LABELS: Record<PillarId, string> = {
  mental: 'Mental', physical: 'Physical', emotional: 'Emotional', spiritual: 'Spiritual',
  financial: 'Financial', social: 'Social', environmental: 'Environmental', recreational: 'Recreational',
};

export function WellnessWheel({ values, size = 260 }: { values: Partial<Record<PillarId, number>>; size?: number }) {
  const c = size / 2;
  const R = c - 34;
  // Inner world on top half, outer on the bottom — 4 axes each spread across the half.
  const pt = (i: number, r: number) => {
    const a = (-90 + i * 45) * (Math.PI / 180);
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };
  const spoke = ORDER.map((p, i) => {
    const [x, y] = pt(i, R);
    const [lx, ly] = pt(i, R + 16);
    const world = i < 4 ? 'inner' : 'outer';
    return { p, x, y, lx, ly, world };
  });
  const poly = (r: number) => ORDER.map((_, i) => pt(i, R * r).join(',')).join(' ');
  const value = ORDER.map((p, i) => pt(i, R * Math.max(0.03, Math.min(1, values[p] ?? 0))).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Wellness wheel">
      <circle cx={c} cy={c} r={R} fill="none" stroke="#3a3a42" />
      {[0.25, 0.5, 0.75].map((r) => <polygon key={r} points={poly(r)} fill="none" stroke="#2e2e36" />)}
      <line x1={c - R} y1={c} x2={c + R} y2={c} stroke="#2e2e36" strokeDasharray="3 4" />
      {spoke.map(({ x, y, lx, ly, p }) => (
        <g key={p}>
          <line x1={c} y1={c} x2={x} y2={y} stroke="#2e2e36" />
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.042} fill="#9a968e" fontFamily="Cinzel, Georgia, serif">
            {LABELS[p].slice(0, 4).toUpperCase()}
          </text>
        </g>
      ))}
      <polygon points={value} fill="#C9A227" fillOpacity="0.28" stroke="#C9A227" strokeWidth="1.5" />
      {spoke.map(({ p, x, y }) => <circle key={p} cx={c + (x - c) * Math.max(0.03, values[p] ?? 0)} cy={c + (y - c) * Math.max(0.03, values[p] ?? 0)} r="3" fill="#C9A227" />)}
      <text x={c} y={18} textAnchor="middle" fontSize={size * 0.045} letterSpacing="3" fill="#9a968e" fontFamily="Cinzel, Georgia, serif">INNER</text>
      <text x={c} y={size - 8} textAnchor="middle" fontSize={size * 0.045} letterSpacing="3" fill="#9a968e" fontFamily="Cinzel, Georgia, serif">OUTER</text>
    </svg>
  );
}
