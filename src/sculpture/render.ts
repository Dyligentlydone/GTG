// SVG renderer for the rock → statue (SPEC §8.2). Pure string output, deterministic from the seed.
// Layers (back to front): background → ground shadow → rings (back) → statue where revealed
// (final image, or rough-cut for the freshest shards) → decorations → rock shards covering the
// unrevealed area (faceted marble, veins, grain, surface cracks) → on-deck cracks → rings (front).
import { centroid, dilate, fmt, polygonPath, polylinePath, smoothOpenPath, type Point } from './geometry';
import { generateRock, LIGHT, type Rock, type RockFacet } from './rock';
import { generateShards, type Shard } from './shards';
import { revealOrder } from './revealOrder';
import { clampPieces, crackIntensity, cracksPerShard, onDeckShards, shardCrackLines } from './cracks';
import { ANCHORS, CANVAS, DEFAULT_ARCHETYPE, PALETTE, STATUE_BBOX, placeholderStatueSvg, figureSilhouettePaths, type Archetype } from './placeholderStatue';
import { rngFor } from './rng';
import { PILLAR_ORDER, PILLAR_SYMBOLS as SYMBOLS } from './symbols';
import { STATUE_PIECES } from '../core/chisel';

export interface SculptureModel { seed: number; rock: Rock; shards: Shard[]; order: number[]; }

const cache = new Map<number, SculptureModel>();

/** Rock, shards and reveal order for a seed (memoized; pure function of the seed). */
export function sculptureModel(seed: number): SculptureModel {
  const key = seed >>> 0;
  let m = cache.get(key);
  if (!m) {
    const rock = generateRock(key);
    const shards = generateShards(rock);
    m = { seed: key, rock, shards, order: revealOrder(key, shards) };
    if (cache.size > 64) cache.clear();
    cache.set(key, m);
  }
  return m;
}

export type DecorationInput = string | { type: string; count?: number };

export interface RenderSculptureInput {
  seed: number;
  piecesRevealed: number;
  /** This week's completion so far (0..1); drives cracks on the on-deck shards. */
  weekProgressPct: number;
  /** Final statue image in the 600×800 sculpture frame (defaults to the placeholder). */
  finalImageHref?: string;
  /** Rough-cut statue image in the same frame (defaults to the placeholder rough-cut). */
  roughImageHref?: string;
  decorations?: DecorationInput[];
  /** Placeholder figure when no images are given (default philosopher). */
  archetype?: Archetype;
  background?: 'dark' | 'light' | 'none';
  /** Prefix for element ids (unique per sculpture when several share a document). */
  idPrefix?: string;
  /** How many of the most recently revealed shards still show the rough cut (default 10). */
  roughWindow?: number;
  width?: number;
  height?: number;
}

// ---------- colour helpers ----------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function countDecorations(list: readonly DecorationInput[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of list) {
    const type = typeof d === 'string' ? d : d.type;
    const n = typeof d === 'string' ? 1 : d.count ?? 1;
    m.set(type, (m.get(type) ?? 0) + n);
  }
  return m;
}

// ---------- rock ----------

function rockTone(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? mix('#7C776E', '#CBC5B9', x / 0.5) : mix('#CBC5B9', '#FBF9F4', (x - 0.5) / 0.5);
}

function facetGradient(id: string, f: RockFacet): string {
  const base = rockTone(0.08 + f.light * 0.92);
  const dx = Math.cos(f.gradAngle) * 0.5;
  const dy = Math.sin(f.gradAngle) * 0.5;
  // gradAngle points toward the light: the lit end is at +d.
  return `<linearGradient id="${id}" x1="${fmt(0.5 - dx)}" y1="${fmt(0.5 - dy)}" x2="${fmt(0.5 + dx)}" y2="${fmt(0.5 + dy)}">`
    + `<stop offset="0" stop-color="${mix(base, '#4A463F', 0.16)}"/><stop offset="0.55" stop-color="${base}"/>`
    + `<stop offset="1" stop-color="${mix(base, '#FFFFFF', 0.22)}"/></linearGradient>`;
}

/** Bevelled facet edges: a highlight where an edge faces the key light, a crease where it faces away. */
function facetEdges(rock: Rock): string {
  const lx = LIGHT[0];
  const ly = LIGHT[1];
  const ll = Math.hypot(lx, ly);
  const light: string[] = [];
  const dark: string[] = [];
  for (const f of rock.facets) {
    const c = centroid(f.polygon);
    for (let i = 0; i < f.polygon.length; i++) {
      const a = f.polygon[i]!;
      const b = f.polygon[(i + 1) % f.polygon.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 4) continue;
      let nx = (b.y - a.y) / len;
      let ny = -(b.x - a.x) / len;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if ((mx - c.x) * nx + (my - c.y) * ny < 0) { nx = -nx; ny = -ny; }
      const facing = (nx * lx + ny * ly) / ll;
      const inset = 1.1;
      const seg = `M${fmt(a.x - nx * inset)} ${fmt(a.y - ny * inset)}L${fmt(b.x - nx * inset)} ${fmt(b.y - ny * inset)}`;
      if (facing > 0.15) light.push(seg);
      else if (facing < -0.15) dark.push(seg);
    }
  }
  return `<path d="${light.join('')}" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.3" stroke-linecap="round"/>`
    + `<path d="${dark.join('')}" fill="none" stroke="#4E4A43" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round"/>`;
}

function crackStrokes(lines: Point[][], dark: string, width: number, opacity: number): string {
  return lines.map((pts) => {
    const d = polylinePath(pts);
    return `<path d="${d}" transform="translate(1 1)" fill="none" stroke="#FFFFFF" stroke-opacity="${fmt(opacity * 0.6)}" stroke-width="${fmt(width * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="${d}" fill="none" stroke="${dark}" stroke-opacity="${opacity}" stroke-width="${fmt(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
}

// ---------- decorations ----------

function meander(x0: number, x1: number, y: number, h: number): string {
  // Greek key: repeating hooked units of width h.
  const parts: string[] = [];
  const u = h;
  for (let x = x0; x + u <= x1 + 0.01; x += u) {
    parts.push(`M${fmt(x)} ${fmt(y + h)}L${fmt(x)} ${fmt(y)}L${fmt(x + u * 0.75)} ${fmt(y)}L${fmt(x + u * 0.75)} ${fmt(y + h * 0.75)}`
      + `L${fmt(x + u * 0.25)} ${fmt(y + h * 0.75)}L${fmt(x + u * 0.25)} ${fmt(y + h * 0.4)}L${fmt(x + u * 0.5)} ${fmt(y + h * 0.4)}`);
  }
  return `<path d="${parts.join('')}M${fmt(x0)} ${fmt(y + h)}L${fmt(x1)} ${fmt(y + h)}" fill="none" stroke="#8E877B" stroke-width="1.3" stroke-linejoin="miter"/>`
    + `<path d="${parts.join('')}" transform="translate(0.8 0.8)" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="0.8"/>`;
}

function laurel(id: string, leaves: number): string {
  const n = Math.min(24, leaves);
  if (n <= 0) return '';
  const { x: cx, y: cy, rx, ry } = ANCHORS.crown;
  const perSide = Math.ceil(n / 2);
  const leaf = (x: number, y: number, dirDeg: number, len: number): string => {
    const r = (dirDeg * Math.PI) / 180;
    const tx = x + Math.cos(r) * len;
    const ty = y + Math.sin(r) * len;
    const nx = -Math.sin(r) * len * 0.32;
    const ny = Math.cos(r) * len * 0.32;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    return `<path d="M${fmt(x)} ${fmt(y)}Q${fmt(mx + nx)} ${fmt(my + ny)} ${fmt(tx)} ${fmt(ty)}Q${fmt(mx - nx)} ${fmt(my - ny)} ${fmt(x)} ${fmt(y)}Z" fill="url(#${id}-gold)" stroke="#7A5C0E" stroke-width="0.5"/>`
      + `<path d="M${fmt(x)} ${fmt(y)}L${fmt(mx + (tx - x) * 0.3)} ${fmt(my + (ty - y) * 0.3)}" stroke="#8A6A12" stroke-width="0.5"/>`;
  };
  // Two branches along the front of the hairline, from the temples to the middle of the brow.
  const out: string[] = [];
  const stems: string[] = [];
  for (const side of [-1, 1]) {
    const count = side < 0 ? perSide : n - perSide;
    if (count <= 0) continue;
    const a0 = side < 0 ? Math.PI * 1.08 : -Math.PI * 0.08;
    const a1 = side < 0 ? Math.PI * 0.56 : Math.PI * 0.44;
    const at = (t: number) => a0 + (a1 - a0) * t;
    const pt = (a: number) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    const span = count / perSide; // shorter branch while few leaves are earned
    const p0 = pt(at(0));
    const p1 = pt(at(span));
    stems.push(`M${fmt(p0.x)} ${fmt(p0.y)}A${rx} ${ry} 0 0 ${side < 0 ? 0 : 1} ${fmt(p1.x)} ${fmt(p1.y)}`);
    for (let k = 0; k < count; k++) {
      const a = at(((k + 0.5) / perSide) * 1);
      const p = pt(a);
      // Direction of travel along the branch (toward the brow).
      const dx = -rx * Math.sin(a) * (a1 - a0);
      const dy = ry * Math.cos(a) * (a1 - a0);
      const dir = (Math.atan2(dy, dx) * 180) / Math.PI;
      out.push(leaf(p.x, p.y, dir - 34, 13), leaf(p.x, p.y, dir + 34, 12));
    }
  }
  return `<g filter="url(#${id}-glow)"><path d="${stems.join('')}" fill="none" stroke="#9C7A1A" stroke-width="1.6"/>${out.join('')}</g>`;
}

function goldVeins(id: string, seed: number, count: number): string {
  const rng = rngFor(seed, 'gold-veins');
  const out: string[] = [];
  for (let i = 0; i < Math.min(10, count); i++) {
    // Kintsugi-like seams wandering across the figure.
    const pts: Point[] = [];
    let x = STATUE_BBOX.x - 10;
    let y = STATUE_BBOX.y + rng.range(0.22, 0.86) * STATUE_BBOX.height;
    const drift = rng.range(-0.8, 0.8);
    while (x < STATUE_BBOX.x + STATUE_BBOX.width + 10) {
      pts.push({ x, y });
      const dx = rng.range(14, 26);
      x += dx;
      y += dx * drift + rng.range(-8, 8);
    }
    const d = smoothOpenPath(pts);
    out.push(`<path d="${d}" fill="none" stroke="${PALETTE.gold}" stroke-width="${fmt(rng.range(1.2, 2.2))}" stroke-linecap="round"/>`);
    out.push(`<path d="${d}" fill="none" stroke="#FFF3C4" stroke-width="0.6" stroke-opacity="0.9"/>`);
  }
  return `<g filter="url(#${id}-glowsoft)" clip-path="url(#${id}-sil)">${out.join('')}</g>`;
}

function plinthDecor(id: string, counts: Map<string, number>): string {
  const out: string[] = [];
  const face = ANCHORS.plinthFace;
  const carvings = counts.get('plinth_carving') ?? 0;
  if (carvings > 0) out.push(meander(face.x + 10, face.x + face.width - 10, face.y + 12, 10));
  if (carvings > 1) out.push(meander(170, 430, 744, 10));
  const symbols = PILLAR_ORDER.filter((p) => (counts.get(`plinth_symbol_${p}`) ?? 0) > 0);
  PILLAR_ORDER.forEach((p, i) => {
    if (!symbols.includes(p)) return;
    const x = face.x + 22 + i * ((face.width - 44) / 7);
    const y = face.y + 38;
    out.push(`<g transform="translate(${fmt(x)} ${y}) scale(1.15)"><path d="${SYMBOLS[p]}" fill="none" stroke="${PALETTE.gold}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  });
  return out.length ? `<g filter="url(#${id}-glowsoft)">${out.join('')}</g>` : '';
}

function rings(id: string, counts: Map<string, number>, half: 'back' | 'front'): string {
  const out: string[] = [];
  const y = ANCHORS.plinthBaseY;
  const arc = (rx: number, ry: number) => (half === 'back'
    ? `M${300 - rx} ${y}A${rx} ${ry} 0 0 1 ${300 + rx} ${y}`
    : `M${300 - rx} ${y}A${rx} ${ry} 0 0 0 ${300 + rx} ${y}`);
  const ring = (rx: number, ry: number, color: string, w: number) =>
    `<path d="${arc(rx, ry)}" fill="none" stroke="${color}" stroke-width="${w * 4}" stroke-opacity="0.25" filter="url(#${id}-blur)"/>`
    + `<path d="${arc(rx, ry)}" fill="none" stroke="${color}" stroke-width="${w}" filter="url(#${id}-glow)"/>`
    + `<path d="${arc(rx, ry)}" fill="none" stroke="#FFF8DC" stroke-width="${w * 0.35}"/>`;
  if ((counts.get('outer_ring') ?? 0) > 0) out.push(ring(214, 30, '#F0D878', 2.6));
  if ((counts.get('inner_ring') ?? 0) > 0) out.push(ring(172, 20, PALETTE.gold, 3));
  return out.join('');
}

// ---------- main ----------

export function renderSculptureSvg(input: RenderSculptureInput): string {
  const model = sculptureModel(input.seed);
  const { rock, shards, order } = model;
  const archetype = input.archetype ?? DEFAULT_ARCHETYPE;
  const id = (input.idPrefix ?? `sc${model.seed}`).replace(/[^A-Za-z0-9_-]/g, '');
  const revealed = clampPieces(input.piecesRevealed);
  const complete = revealed >= STATUE_PIECES;
  const roughWindow = complete ? 0 : Math.max(0, input.roughWindow ?? 10);
  const revealedSet = order.slice(0, revealed);
  const roughSet = new Set(revealedSet.slice(Math.max(0, revealed - roughWindow)));
  const unrevealed = order.slice(revealed);
  const counts = countDecorations(input.decorations ?? []);
  const intensity = complete ? 0 : crackIntensity(input.weekProgressPct);
  const onDeck = complete ? [] : onDeckShards(order, revealed);
  const byIndex = (i: number) => shards[i]!;
  const clipOf = (list: Iterable<number>) => [...list].map((i) => `<path d="${polygonPath(dilate(byIndex(i).polygon, 0.7))}"/>`).join('');
  const W = input.width ?? CANVAS.width;
  const H = input.height ?? CANVAS.height;
  const bg = input.background ?? 'dark';
  const box = rock.bbox;
  const rect = (fill: string, extra = '') => `<rect x="${fmt(box.x - 2)}" y="${fmt(box.y - 2)}" width="${fmt(box.width + 4)}" height="${fmt(box.height + 4)}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;

  const defs: string[] = [
    `<radialGradient id="${id}-bg" cx="0.5" cy="0.42" r="0.8"><stop offset="0" stop-color="${bg === 'light' ? '#FBFAF7' : '#383841'}"/><stop offset="1" stop-color="${bg === 'light' ? '#E4DFD5' : '#121215'}"/></radialGradient>`,
    `<radialGradient id="${id}-shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8E68A"/><stop offset="0.5" stop-color="${PALETTE.gold}"/><stop offset="1" stop-color="#8A6A12"/></linearGradient>`,
    `<linearGradient id="${id}-ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.82" stop-color="#2B2723" stop-opacity="0.06"/><stop offset="1" stop-color="#2B2723" stop-opacity="0.4"/></linearGradient>`,
    `<linearGradient id="${id}-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.62" stop-color="#1B1B1F" stop-opacity="0"/><stop offset="1" stop-color="#1B1B1F" stop-opacity="0.4"/></linearGradient>`,
    `<radialGradient id="${id}-key" cx="0.22" cy="0.12" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.4"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`,
    `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${model.seed % 1000}"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.28  0 0 0 0 0.26  0 0 0 -1.2 0.95"/></filter>`,
    `<filter id="${id}-mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="3" seed="${(model.seed + 7) % 1000}"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.43  0 0 0 0 0.4  0 0 0 -2.4 1.3"/></filter>`,
    `<filter id="${id}-rim" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="10"/></filter>`,
    `<filter id="${id}-blur" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<filter id="${id}-drop" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5"/></filter>`,
    `<filter id="${id}-vein" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.45"/></filter>`,
    `<filter id="${id}-veinhalo" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>`,
    `<filter id="${id}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    `<filter id="${id}-glowsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    `<clipPath id="${id}-rock"><path d="${polygonPath(rock.outline)}"/></clipPath>`,
    `<clipPath id="${id}-rough">${clipOf(roughSet)}</clipPath>`,
    `<clipPath id="${id}-revealed">${clipOf(revealedSet)}</clipPath>`,
    `<clipPath id="${id}-unrevealed">${clipOf(unrevealed)}</clipPath>`,
    `<clipPath id="${id}-sil">${figureSilhouettePaths(archetype).map((d) => `<path d="${d}"/>`).join('')}</clipPath>`,
    ...rock.facets.map((f, k) => facetGradient(`${id}-f${k}`, f)),
  ];

  const statueFinal = input.finalImageHref
    ? `<image href="${escapeAttr(input.finalImageHref)}" x="0" y="0" width="${CANVAS.width}" height="${CANVAS.height}" preserveAspectRatio="xMidYMid meet"/>`
    : placeholderStatueSvg(`${id}-pf`, 'final', archetype);
  const statueRough = input.roughImageHref
    ? `<image href="${escapeAttr(input.roughImageHref)}" x="0" y="0" width="${CANVAS.width}" height="${CANVAS.height}" preserveAspectRatio="xMidYMid meet"/>`
    : placeholderStatueSvg(`${id}-pr`, 'rough', archetype);

  const remaining = unrevealed.length / STATUE_PIECES;
  const layers: string[] = [];
  if (bg !== 'none') layers.push(`<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="url(#${id}-bg)"/>`);
  // Ground shadow: the plinth's, plus the rock's (cast toward the lower right) while it remains.
  layers.push(`<ellipse cx="312" cy="${ANCHORS.plinthBaseY + 4}" rx="165" ry="13" fill="url(#${id}-shadow)"/>`);
  if (remaining > 0) {
    const s = Math.min(1, remaining * 1.6);
    layers.push(`<ellipse cx="${fmt(box.x + box.width / 2 + 26)}" cy="${rock.groundY + 2}" rx="${fmt(box.width * 0.62)}" ry="16" fill="#000" opacity="${fmt(0.3 + 0.45 * s)}" filter="url(#${id}-blur)"/>`);
  }
  layers.push(rings(id, counts, 'back'));

  // Statue: the final image is drawn whole; rough-cut shards and unrevealed rock cover it.
  if (revealed > 0) layers.push(`<g>${statueFinal}</g>`);
  if (roughSet.size) layers.push(`<g clip-path="url(#${id}-rough)">${statueRough}</g>`);

  // Decorations on the revealed statue.
  if (revealed > 0) {
    const deco = [
      counts.get('gold_vein') ? goldVeins(id, model.seed, counts.get('gold_vein')!) : '',
      plinthDecor(id, counts),
      counts.get('laurel_leaf') ? laurel(id, (counts.get('laurel_leaf') ?? 0) * 4) : '',
    ].join('');
    if (deco) layers.push(complete ? `<g>${deco}</g>` : `<g clip-path="url(#${id}-revealed)">${deco}</g>`);
  }

  if (unrevealed.length) {
    const unrevealedPaths = unrevealed.map((i) => `<path d="${polygonPath(dilate(byIndex(i).polygon, 0.7))}"/>`).join('');
    // The remaining rock casts a soft shadow onto the freshly revealed statue below it.
    if (revealed > 0) layers.push(`<g transform="translate(5 8)" fill="#15130F" opacity="0.5" filter="url(#${id}-drop)">${unrevealedPaths}</g>`);
    const facets = rock.facets.map((f, k) => `<path d="${polygonPath(dilate(f.polygon, 0.6))}" fill="url(#${id}-f${k})"/>`).join('');
    const veins = rock.veins.map((v) => `<path d="${v.d}" fill="none" stroke="#8B8580" stroke-opacity="${fmt(v.opacity * 0.35)}" stroke-width="${fmt(v.width * 4)}" filter="url(#${id}-veinhalo)"/>`
      + `<path d="${v.d}" fill="none" stroke="#56524E" stroke-linejoin="round" stroke-opacity="${fmt(Math.min(0.9, v.opacity * 1.4))}" stroke-width="${fmt(v.width)}" filter="url(#${id}-vein)"/>`).join('');
    const seams = unrevealed.map((i) => polygonPath(byIndex(i).polygon)).join('');
    const chips = rock.chips.map((c) => {
      const [p0, p1, apex] = c.polygon as [Point, Point, Point];
      // A small broken-off notch: recessed (shaded) face, crisp lit lip on one side.
      return `<path d="${polygonPath(c.polygon)}" fill="#2E2A25" fill-opacity="0.2"/>`
        + `<path d="M${fmt(p0.x)} ${fmt(p0.y)}L${fmt(apex.x)} ${fmt(apex.y)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="1.1" stroke-linecap="round"/>`
        + `<path d="M${fmt(apex.x)} ${fmt(apex.y)}L${fmt(p1.x)} ${fmt(p1.y)}" fill="none" stroke="#3E3A34" stroke-opacity="0.55" stroke-width="1.1" stroke-linecap="round"/>`;
    }).join('');
    layers.push(`<g clip-path="url(#${id}-unrevealed)">`
      + facets
      + rect('#000', `filter="url(#${id}-mottle)" opacity="0.16"`)
      + veins
      + rect('#000', `filter="url(#${id}-grain)" opacity="0.2"`)
      + rect(`url(#${id}-ao)`) + rect(`url(#${id}-side)`) + rect(`url(#${id}-key)`)
      + `<path d="${polygonPath(rock.outline)}" transform="translate(-10 -12)" fill="none" stroke="#2E2A25" stroke-opacity="0.5" stroke-width="28" filter="url(#${id}-rim)"/>`
      + facetEdges(rock)
      + `<path d="${seams}" fill="none" stroke="#5E5A53" stroke-opacity="0.06" stroke-width="0.6"/>`
      + chips
      + crackStrokes(rock.cracks, '#4E4A44', 1, 0.65)
      + `</g>`);
  }

  // On-deck shards loosen and crack as the week progresses (visual only).
  if (intensity > 0 && onDeck.length) {
    const n = cracksPerShard(intensity);
    const lines = onDeck.flatMap((i) => shardCrackLines(model.seed, byIndex(i), n));
    const shade = onDeck.map((i) => `<path d="${polygonPath(byIndex(i).polygon)}" fill="#2A2621" fill-opacity="${fmt(0.03 + 0.07 * intensity)}"/>`).join('');
    const edges = onDeck.map((i) => {
      const d = polygonPath(byIndex(i).polygon);
      return `<path d="${d}" transform="translate(0.9 0.9)" fill="none" stroke="#FFFFFF" stroke-opacity="${fmt(0.3 + 0.3 * intensity)}" stroke-width="1.2" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="none" stroke="#221F1B" stroke-opacity="${fmt(0.45 + 0.4 * intensity)}" stroke-width="${fmt(1 + 0.9 * intensity)}" stroke-linejoin="round"/>`;
    }).join('');
    const glow = intensity >= 1
      ? onDeck.map((i) => `<path d="${polygonPath(byIndex(i).polygon)}" fill="none" stroke="${PALETTE.gold}" stroke-opacity="0.85" stroke-width="1.6" filter="url(#${id}-glow)"/>`).join('')
      : '';
    layers.push(`<g clip-path="url(#${id}-rock)">${shade}${edges}${crackStrokes(lines, '#1E1B18', 1.4 + 1.3 * intensity, 0.95)}${glow}</g>`);
  }

  layers.push(rings(id, counts, 'front'));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" width="${W}" height="${H}" role="img" aria-label="Marble sculpture, ${revealed} of ${STATUE_PIECES} pieces revealed">`
    + `<defs>${defs.join('')}</defs>${layers.join('')}</svg>`;
}
