// Wellness wheel (SPEC §10.1 /home): 8 axes, Inner World on the top half, Outer World
// on the bottom — the spokes are rotated half a step so the INNER/OUTER labels sit
// clear of them. Spokes link to their quest when `links` is provided.
import type { PillarId } from '../core/types';

const ORDER: PillarId[] = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'];
const LABELS: Record<PillarId, string> = {
  mental: 'Mental', physical: 'Physical', emotional: 'Emotional', spiritual: 'Spiritual',
  financial: 'Financial', social: 'Social', environmental: 'Environmental', recreational: 'Recreational',
};

export function WellnessWheel({ values, size = 260, links, linkTitles }: {
  values: Partial<Record<PillarId, number>>;
  size?: number;
  /** pillar → href: makes each spoke + label a link (e.g. to its quest page). */
  links?: Partial<Record<PillarId, string>>;
  /** pillar → hover tooltip (e.g. the quest title). */
  linkTitles?: Partial<Record<PillarId, string>>;
}) {
  const c = size / 2;
  const R = c - 34;
  // Half-step rotation: inner axes (0–3) sweep the top half (-157.5°..-22.5°),
  // outer (4–7) the bottom — so the horizontal divider is the true world split
  // and no spoke label collides with the INNER/OUTER text.
  const pt = (i: number, r: number) => {
    const a = (-90 + (i - 1.5) * 45) * (Math.PI / 180);
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
      {spoke.map(({ x, y, lx, ly, p }) => {
        const href = links?.[p];
        const body = (
          <g>
            <line x1={c} y1={c} x2={x} y2={y} stroke="#2e2e36" />
            {href && <line x1={c} y1={c} x2={x} y2={y} stroke="transparent" strokeWidth={16} />}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.042}
              fontFamily="Cinzel, Georgia, serif"
              className={href ? 'fill-[#9a968e] transition-colors group-hover:fill-gold' : undefined}
              fill={href ? undefined : '#9a968e'}>
              {LABELS[p].slice(0, 4).toUpperCase()}
            </text>
          </g>
        );
        return href ? (
          <a key={p} href={href} className="group cursor-pointer">
            <title>{linkTitles?.[p] ?? LABELS[p]}</title>
            {body}
          </a>
        ) : <g key={p}>{body}</g>;
      })}
      <polygon points={value} fill="#C9A227" fillOpacity="0.28" stroke="#C9A227" strokeWidth="1.5" pointerEvents="none" />
      {spoke.map(({ p, x, y }) => <circle key={p} cx={c + (x - c) * Math.max(0.03, values[p] ?? 0)} cy={c + (y - c) * Math.max(0.03, values[p] ?? 0)} r="3" fill="#C9A227" pointerEvents="none" />)}
      <text x={c} y={18} textAnchor="middle" fontSize={size * 0.045} letterSpacing="3" fill="#9a968e" fontFamily="Cinzel, Georgia, serif">INNER</text>
      <text x={c} y={size - 8} textAnchor="middle" fontSize={size * 0.045} letterSpacing="3" fill="#9a968e" fontFamily="Cinzel, Georgia, serif">OUTER</text>
    </svg>
  );
}
