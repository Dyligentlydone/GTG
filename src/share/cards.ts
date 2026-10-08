// Share card templates (SPEC §9.3): SVG, 1200×630, light and dark variants.
// Greek-meets-gaming: marble field, Greek key border, Cinzel headings, gold accents,
// pillar emblem, the GAMIFYING THE GRIND wordmark and the player's handle.
import type { LocalDate, PillarId } from '../core/types';
import { PILLAR_SYMBOLS } from '../sculpture/symbols';
import { PALETTE, STATUE_BBOX } from '../sculpture/placeholderStatue';
import { renderSculptureSvg } from '../sculpture/render';
import { STATUE_PIECES } from '../core/chisel';
import { MILESTONE_INFO, SCOPE_INFO } from './scopes';
import { primaryItem, type QuestLine, type ShareCardModel, type ShareItem, type WeekQuestLine } from './model';

export const CARD = { width: 1200, height: 630 } as const;
export type CardVariant = 'light' | 'dark';
export const CARD_VARIANTS: readonly CardVariant[] = ['light', 'dark'];

/** Pillar display names (the fixed eight from core types). */
export const PILLAR_NAMES: Record<PillarId, string> = {
  mental: 'Mental', physical: 'Physical', emotional: 'Emotional', spiritual: 'Spiritual',
  financial: 'Financial', social: 'Social', environmental: 'Environmental', recreational: 'Recreational',
};

const HEADING = 'Cinzel, Georgia, serif';
const BODY = 'Inter, Georgia, serif';

interface Theme {
  bg0: string; bg1: string; panel: string; text: string; muted: string;
  hairline: string; key: string; gold: string; goldDeep: string; emblemBg: string;
}
const THEMES: Record<CardVariant, Theme> = {
  light: {
    bg0: '#FBF8F1', bg1: '#E9E3D6', panel: '#F4F1EA', text: '#1B1B1F', muted: '#6E6A63',
    hairline: '#B9B4AA', key: '#8E877B', gold: '#A8801B', goldDeep: '#7A5C0E', emblemBg: '#FBF8F1',
  },
  dark: {
    bg0: '#26262E', bg1: '#0E0E12', panel: '#1B1B1F', text: '#F4F1EA', muted: '#9A968E',
    hairline: '#3E3A34', key: '#6E6A63', gold: PALETTE.gold, goldDeep: '#8A6A12', emblemBg: '#141419',
  },
};

const RARITY_COLOR: Record<string, string> = {
  common: '#8E877B', uncommon: '#5E8F5A', rare: '#4A6FA5', epic: '#7B4FA5', legendary: PALETTE.gold,
};

// ---------- text helpers ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rough advance-width estimate (fraction of font size) per character class. */
function charWidth(ch: string, caps: boolean): number {
  if (ch === ' ') return 0.3;
  if ('ilj.,:;\'|!'.includes(ch)) return 0.28;
  if ('mwMW@'.includes(ch)) return 0.9;
  if (caps || ch === ch.toUpperCase()) return 0.72;
  return 0.52;
}

function textWidth(s: string, caps: boolean): number {
  return [...s].reduce((n, ch) => n + charWidth(ch, caps), 0);
}

/** Wraps text into lines that fit `maxWidth` at the given (unit) font size. */
function wrapText(s: string, maxWidth: number, caps = false): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (line && textWidth(candidate, caps) > maxWidth) { lines.push(line); line = w; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function ellipsize(s: string, maxChars: number): string {
  const chars = [...s];
  if (chars.length <= maxChars) return s;
  const cut = chars.slice(0, maxChars - 1).join('').trimEnd();
  const space = cut.lastIndexOf(' ');
  return `${space > 0 && cut.length - space < 20 ? cut.slice(0, space) : cut}…`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: LocalDate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${day}, ${y}`;
}

const fmt = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');

// ---------- frame ----------

/** One horizontal Greek-key strip from x0 to x1, centred on y, `h` tall. */
function meanderH(x0: number, x1: number, y: number, h: number): string {
  const parts: string[] = [];
  const u = h;
  for (let x = x0; x + u <= x1 + 0.01; x += u) {
    parts.push(`M${fmt(x)} ${fmt(y + h / 2)}L${fmt(x)} ${fmt(y - h / 2)}L${fmt(x + u * 0.75)} ${fmt(y - h / 2)}`
      + `L${fmt(x + u * 0.75)} ${fmt(y + h * 0.25)}L${fmt(x + u * 0.25)} ${fmt(y + h * 0.25)}`
      + `L${fmt(x + u * 0.25)} ${fmt(y - h * 0.1)}L${fmt(x + u * 0.5)} ${fmt(y - h * 0.1)}`);
  }
  return parts.join('');
}

function frame(t: Theme): string {
  const W = CARD.width;
  const H = CARD.height;
  const band = 18; // meander strip height
  const cy = { top: 40, bottom: H - 40 };
  const cx = { left: 40, right: W - 40 };
  const hPath = meanderH(66, W - 66, cy.top, band);
  const keyPaths = [
    `<path d="${hPath}" />`,
    `<path d="${hPath}" transform="translate(0 ${H}) scale(1 -1)"/>`,
    `<path d="${hPath}" transform="rotate(90 ${cx.left} ${cy.top}) translate(0 ${cx.left - cy.top})"/>`,
    `<path d="${hPath}" transform="rotate(90 ${cx.left} ${cy.top}) translate(0 ${cx.left - cy.top}) rotate(180 ${W / 2} ${H / 2})"/>`,
  ];
  const corner = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="-13" y="-13" width="26" height="26" fill="none" stroke="${t.gold}" stroke-width="1.6"/>`
    + `<path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill="none" stroke="${t.gold}" stroke-width="1.3"/><circle r="1.8" fill="${t.gold}"/></g>`;
  return `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${t.gold}" stroke-opacity="0.55" stroke-width="1.5"/>`
    + `<rect x="62" y="62" width="${W - 124}" height="${H - 124}" fill="none" stroke="${t.hairline}" stroke-width="1"/>`
    + `<g fill="none" stroke="${t.key}" stroke-width="1.5" stroke-linejoin="miter" stroke-linecap="square">${keyPaths.join('')}</g>`
    + `<g fill="none" stroke="#FFFFFF" stroke-opacity="${t === THEMES.light ? 0.5 : 0.08}" stroke-width="0.7" transform="translate(0.7 0.7)"><path d="${hPath}"/></g>`
    + corner(cx.left, cy.top) + corner(cx.right, cy.top) + corner(cx.left, cy.bottom) + corner(cx.right, cy.bottom);
}

function wordmark(t: Theme): string {
  const y = 108;
  return `<text x="600" y="${y}" text-anchor="middle" font-family="${HEADING}" font-size="19" letter-spacing="9" fill="${t.gold}">GAMIFYING THE GRIND</text>`
    + `<path d="M430 ${y + 12} L570 ${y + 12} M630 ${y + 12} L770 ${y + 12}" stroke="${t.hairline}" stroke-width="1"/>`
    + `<path d="M600 ${y + 7} L606 ${y + 12} L600 ${y + 17} L594 ${y + 12} Z" fill="${t.gold}"/>`;
}

function footer(model: ShareCardModel, t: Theme): string {
  const y = 548;
  const handle = `<text x="96" y="${y}" font-family="${HEADING}" font-size="17" letter-spacing="1.5" fill="${t.muted}">@${esc(model.handle)}</text>`;
  const pillar = model.pillar
    ? `<g transform="translate(994 ${y - 6}) scale(1.1)"><path d="${PILLAR_SYMBOLS[model.pillar]}" fill="none" stroke="${t.gold}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></g>`
      + `<text x="1010" y="${y}" font-family="${HEADING}" font-size="15" letter-spacing="2" fill="${t.muted}">${PILLAR_NAMES[model.pillar].toUpperCase()}</text>`
    : '';
  return `<text x="600" y="${y}" text-anchor="middle" font-family="${HEADING}" font-size="12" letter-spacing="4" fill="${t.hairline}">SET IN STONE</text>`
    + `<g transform="translate(552 ${y - 5})"><path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="${t.gold}"/></g>`
    + `<g transform="translate(648 ${y - 5})"><path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="${t.gold}"/></g>`
    + handle + pillar;
}

function eyebrow(text: string, t: Theme, y = 152): string {
  return `<text x="600" y="${y}" text-anchor="middle" font-family="${HEADING}" font-size="15" letter-spacing="5" fill="${t.muted}">${esc(text.toUpperCase())}</text>`;
}

function emblem(pillar: PillarId, cx: number, cy: number, r: number, t: Theme): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.emblemBg}" stroke="${t.gold}" stroke-width="2"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="none" stroke="${t.hairline}" stroke-width="0.8"/>`
    + `<g transform="translate(${cx} ${cy}) scale(${fmt(r / 12)})"><path d="${PILLAR_SYMBOLS[pillar]}" fill="none" stroke="${t.gold}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function pipRow(done: number, due: number, x: number, y: number, t: Theme): string {
  const out: string[] = [];
  for (let i = 0; i < due; i++) {
    const cx = x + i * 22;
    out.push(i < done
      ? `<circle cx="${cx}" cy="${y}" r="7" fill="${PALETTE.gold}" stroke="${t.goldDeep}" stroke-width="1"/>`
      : `<circle cx="${cx}" cy="${y}" r="7" fill="none" stroke="${t.muted}" stroke-width="1.2"/>`);
  }
  return out.join('');
}

// ---------- scope bodies ----------

function takeawayBody(model: ShareCardModel, t: Theme): string {
  const item = primaryItem(model, 'takeaway');
  const size = 40;
  const lines = wrapText(item.text, 880 / size);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = `${shown[2]!.replace(/\s*\S+$/, '')}…`;
  const y0 = 300 - (shown.length - 1) * 26;
  const body = shown.map((l, i) =>
    `<text x="600" y="${y0 + i * 52}" text-anchor="middle" font-family="${HEADING}" font-size="${size}" fill="${t.text}">${esc(l)}</text>`).join('');
  const sub = [item.bookTitle && `— ${item.bookTitle}`, item.dayNumber && `DAY ${item.dayNumber}`].filter(Boolean).join('   ·   ');
  return eyebrow(SCOPE_INFO.takeaway.label, t)
    + `<text x="168" y="236" font-family="${HEADING}" font-size="120" fill="${t.gold}" fill-opacity="0.9">“</text>`
    + body
    + (sub ? `<text x="600" y="${y0 + shown.length * 52}" text-anchor="middle" font-family="${BODY}" font-size="21" fill="${t.muted}">${esc(sub)}</text>` : '');
}

function questBody(model: ShareCardModel, t: Theme): string {
  const q = primaryItem(model, 'quest');
  const lines = wrapText(q.title, 760 / 44, true).slice(0, 2);
  const body = lines.map((l, i) =>
    `<text x="600" y="${356 + i * 54}" text-anchor="middle" font-family="${HEADING}" font-size="44" fill="${t.text}">${esc(l)}</text>`).join('');
  const pillY = 356 + (lines.length - 1) * 54 + 48;
  return eyebrow(SCOPE_INFO.quest.label, t)
    + emblem(q.pillar, 600, 226, 46, t)
    + body
    + `<g transform="translate(600 ${pillY})"><rect x="-64" y="-21" width="128" height="42" rx="21" fill="none" stroke="${t.gold}" stroke-width="1.6"/>`
    + `<text y="8" text-anchor="middle" font-family="${HEADING}" font-size="21" letter-spacing="1" fill="${t.gold}">+${q.xp} XP</text></g>`;
}

function customSetBody(model: ShareCardModel, t: Theme): string {
  const items = model.items;
  const cols = items.length > 3 ? 2 : 1;
  const perCol = Math.ceil(items.length / cols);
  const colW = cols === 2 ? 440 : 760;
  const rows = items.map((item, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 600 - (cols * colW) / 2 + col * colW + 30;
    const y = 230 + row * 74;
    const glyph = (p?: PillarId) => p
      ? `<g transform="translate(${x + 12} ${y - 8}) scale(1.05)"><path d="${PILLAR_SYMBOLS[p]}" fill="none" stroke="${t.gold}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : `<path d="M${x + 6} ${y - 8} L${x + 18} ${y - 8}" stroke="${t.gold}" stroke-width="2"/>`;
    let text = '';
    let sub = '';
    switch (item.type) {
      case 'quest': text = item.title; sub = `+${item.xp} XP`; break;
      case 'takeaway': case 'journal': text = `“${item.text}”`; sub = item.type === 'journal' ? 'Journal' : 'Takeaway'; break;
      case 'pillar': text = `${PILLAR_NAMES[item.pillar]} — ${item.done}/${item.due} on target`; break;
      case 'stat': text = item.label; sub = item.value; break;
      default: text = '';
    }
    return glyph(item.type === 'stat' ? item.pillar : 'pillar' in item ? (item as { pillar?: PillarId }).pillar : undefined)
      + `<text x="${x + 36}" y="${y}" font-family="${BODY}" font-size="21" fill="${t.text}">${esc(ellipsize(text, cols === 2 ? 30 : 58))}</text>`
      + (sub ? `<text x="${x + 36}" y="${y + 26}" font-family="${BODY}" font-size="15" fill="${t.muted}">${esc(sub)}</text>` : '');
  });
  return eyebrow('Progress', t) + rows.join('');
}

function dayBody(model: ShareCardModel, t: Theme): string {
  const d = primaryItem(model, 'day');
  const quests = d.quests.slice(0, 8);
  const cols = quests.length > 4 ? 2 : 1;
  const perCol = Math.ceil(quests.length / cols);
  const rows = quests.map((q: QuestLine, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 150 + col * 460;
    const y = 268 + row * 52;
    return `<circle cx="${x}" cy="${y - 7}" r="9" fill="none" stroke="${t.gold}" stroke-width="1.6"/>`
      + `<path d="M${x - 4} ${y - 7} L${x - 1} ${y - 4} L${x + 5} ${y - 11}" fill="none" stroke="${PALETTE.gold}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<text x="${x + 24}" y="${y}" font-family="${BODY}" font-size="20" fill="${t.text}">${esc(ellipsize(q.title, 34))}</text>`;
  }).join('');
  const titleY = 216;
  const right = d.fullSet
    ? `<g transform="translate(930 380)"><circle r="66" fill="${t.emblemBg}" stroke="${t.gold}" stroke-width="2.4"/>`
      + `<circle r="57" fill="none" stroke="${t.gold}" stroke-width="0.9" stroke-dasharray="3 4"/>`
      + `<text y="-2" text-anchor="middle" font-family="${HEADING}" font-size="20" letter-spacing="2" fill="${t.gold}">FULL</text>`
      + `<text y="22" text-anchor="middle" font-family="${HEADING}" font-size="20" letter-spacing="2" fill="${t.gold}">SET</text></g>`
    : '';
  const streak = d.streak > 0
    ? `<text x="930" y="${d.fullSet ? 490 : 400}" text-anchor="middle" font-family="${HEADING}" font-size="17" letter-spacing="1.5" fill="${t.text}">${d.streak}-DAY</text>`
      + `<text x="930" y="${d.fullSet ? 514 : 424}" text-anchor="middle" font-family="${HEADING}" font-size="13" letter-spacing="3" fill="${t.muted}">STREAK</text>`
    : '';
  const more = d.quests.length > quests.length
    ? `<text x="150" y="${268 + perCol * 52}" font-family="${BODY}" font-size="17" fill="${t.muted}">+ ${d.quests.length - quests.length} more</text>` : '';
  return eyebrow(`${fmtDate(d.date)} — ${SCOPE_INFO.day.label}`, t)
    + `<text x="150" y="${titleY}" font-family="${HEADING}" font-size="40" fill="${t.text}">${d.dayNumber ? `DAY ${d.dayNumber}` : 'TODAY'}</text>`
    + rows + right + streak + more;
}

function weekBody(model: ShareCardModel, t: Theme): string {
  const w = primaryItem(model, 'week');
  const quests = w.quests.slice(0, 10);
  const perCol = Math.ceil(quests.length / 2);
  const rows = quests.map((q: WeekQuestLine, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 140 + col * 480;
    const y = 218 + row * 56;
    return `<text x="${x}" y="${y}" font-family="${BODY}" font-size="19" fill="${t.text}">${esc(ellipsize(q.title, 30))}</text>`
      + pipRow(Math.min(q.done, q.due), q.due, x + 14, y + 24, t);
  }).join('');
  const stats = [
    w.pagesRead > 0 ? `${w.pagesRead} PAGES` : '',
    w.dawns > 0 ? `${w.dawns} ${w.dawns === 1 ? 'DAWN' : 'DAWNS'}` : '',
    `${w.piecesChiseled} ${w.piecesChiseled === 1 ? 'PIECE' : 'PIECES'} CHISELED`,
  ].filter(Boolean).join('   ·   ');
  const perfect = w.perfectWeek
    ? `<g transform="translate(1010 176)"><rect x="-118" y="-22" width="236" height="44" rx="22" fill="none" stroke="${PALETTE.gold}" stroke-width="2"/>`
      + `<text y="7" text-anchor="middle" font-family="${HEADING}" font-size="19" letter-spacing="2.5" fill="${PALETTE.gold}">PERFECT WEEK</text></g>` : '';
  return eyebrow(`WEEK OF ${fmtDate(w.weekStart).toUpperCase()}`, t) + perfect + rows
    + `<text x="600" y="520" text-anchor="middle" font-family="${HEADING}" font-size="17" letter-spacing="2.5" fill="${t.gold}">${esc(stats)}</text>`;
}

function laurelArc(cx: number, cy: number, r: number, t: Theme): string {
  // Two symmetric branches framing the emblem: a stem arc plus pointed leaves tilted
  // toward the tip (SVG coords: angle 0 = +x, 90 = down; left branch sweeps bottom → left).
  const LEAF = 'M0 0 C2.5 -3.5 8 -5.5 14 -5 C10.5 -2 10.5 2 14 5 C8 5.5 2.5 3.5 0 0 Z';
  const out: string[] = [];
  for (const side of [1, -1] as const) {
    // Stem angles 195° (tip, beside the emblem) → 100° (near the bottom). Mirroring
    // `side * cos` puts the right branch in the same angle range automatically.
    const a0 = 195;
    const a1 = 100;
    const toRad = (a: number) => (a * Math.PI) / 180;
    const px = (a: number) => cx + side * r * Math.cos(toRad(a));
    const py = (a: number) => cy + r * Math.sin(toRad(a));
    out.push(`<path d="M${fmt(px(a0))} ${fmt(py(a0))} A${r} ${r} 0 0 ${side === 1 ? 0 : 1} ${fmt(px(a1))} ${fmt(py(a1))}" fill="none" stroke="${t.goldDeep}" stroke-width="1.8" stroke-linecap="round"/>`);
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = a0 + ((a1 - a0) * (k + 0.5)) / n;
      const x = px(a);
      const y = py(a);
      // Leaf points radially out (angle a, mirrored to 180−a on the right), tilted ~40°
      // toward the branch tip.
      const leafAngle = side === 1 ? a + 40 : 140 - a;
      out.push(`<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(leafAngle)})"><path d="${LEAF}" fill="${t.gold}" fill-opacity="0.9"/></g>`);
    }
  }
  return `<g>${out.join('')}</g>`;
}

function achievementBody(model: ShareCardModel, t: Theme): string {
  const a = primaryItem(model, 'achievement');
  const color = RARITY_COLOR[a.rarity] ?? t.gold;
  const isPillar = !['inner', 'outer', 'all'].includes(a.scope);
  const center = isPillar ? emblem(a.scope as PillarId, 600, 262, 52, t)
    : `<circle cx="600" cy="262" r="52" fill="${t.emblemBg}" stroke="${t.gold}" stroke-width="2"/>`
      + `<circle cx="600" cy="262" r="47" fill="none" stroke="${t.hairline}" stroke-width="0.8"/>`
      + `<path d="M600 236 L608 256 L629 256 L612 269 L619 290 L600 277 L581 290 L588 269 L571 256 L592 256 Z" fill="none" stroke="${t.gold}" stroke-width="1.8" stroke-linejoin="round"/>`;
  const scopeLabel = a.scope === 'inner' ? 'INNER WORLD' : a.scope === 'outer' ? 'OUTER WORLD'
    : a.scope === 'all' ? 'ALL PILLARS' : `${PILLAR_NAMES[a.scope as PillarId].toUpperCase()} PILLAR`;
  const lines = wrapText(a.name, 800 / 50, true).slice(0, 2);
  const name = lines.map((l, i) =>
    `<text x="600" y="${392 + i * 58}" text-anchor="middle" font-family="${HEADING}" font-size="50" fill="${t.text}">${esc(l)}</text>`).join('');
  const rarity = `${a.rarity.toUpperCase()}${a.rarityPct != null ? ` · TOP ${a.rarityPct}%` : ''} · ${scopeLabel}`;
  return eyebrow(SCOPE_INFO.achievement.label, t)
    + laurelArc(600, 292, 96, t) + center + name
    + `<text x="600" y="${392 + (lines.length - 1) * 58 + 48}" text-anchor="middle" font-family="${HEADING}" font-size="17" letter-spacing="3" fill="${color}">${esc(rarity)}</text>`;
}

const MILESTONE_SUB: Record<string, (m: Extract<ShareItem, { type: 'milestone' }>) => string> = {
  book_finished: (m) => (m.bookTitle ? `"${m.bookTitle}"` : 'Another book') + ' — cover to cover.',
  chisel_day: (m) => `${m.piecesThisWeek ?? 0} ${m.piecesThisWeek === 1 ? 'piece' : 'pieces'} fell this week.`,
  sculpture_halfway: () => `${Math.ceil(STATUE_PIECES / 2)} of ${STATUE_PIECES} pieces revealed.`,
  face_reveal: () => 'The last pieces fell — the face is free.',
  sculpture_complete: () => `All ${STATUE_PIECES} pieces revealed.`,
};

function milestoneBody(model: ShareCardModel, id: string, t: Theme): string {
  const m = primaryItem(model, 'milestone');
  const info = MILESTONE_INFO[m.kind];
  const hasStatue = typeof m.seed === 'number' && m.piecesRevealed > 0;
  const textW = hasStatue ? 560 : 880;
  const cx = hasStatue ? 380 : 600;
  const titleLines = wrapText(info.title.toUpperCase(), textW / 46, true).slice(0, 2);
  const title = titleLines.map((l, i) =>
    `<text x="${cx}" y="${236 + i * 56}" text-anchor="middle" font-family="${HEADING}" font-size="46" fill="${t.text}">${esc(l)}</text>`).join('');
  const subY = 236 + (titleLines.length - 1) * 56 + 52;
  const sub = `<text x="${cx}" y="${subY}" text-anchor="middle" font-family="${BODY}" font-size="22" fill="${t.muted}">${esc(ellipsize(MILESTONE_SUB[m.kind]?.(m) ?? '', 60))}</text>`;
  // Progress bar toward 120 pieces.
  const barW = textW - 60;
  const barY = subY + 44;
  const pct = Math.min(1, m.piecesRevealed / STATUE_PIECES);
  const ticks = [0.25, 0.5, 0.75].map((p) =>
    `<path d="M${cx - barW / 2 + barW * p} ${barY - 8} L${cx - barW / 2 + barW * p} ${barY + 8}" stroke="${t.muted}" stroke-width="1"/>`).join('');
  const bar = m.piecesRevealed > 0
    ? `<rect x="${cx - barW / 2}" y="${barY - 5}" width="${barW}" height="10" rx="5" fill="none" stroke="${t.hairline}" stroke-width="1.4"/>`
      + (pct > 0.012 ? `<rect x="${cx - barW / 2 + 1.5}" y="${barY - 3.5}" width="${(barW - 3) * pct}" height="7" rx="3.5" fill="url(#${id}-goldfill)"/>` : '')
      + ticks
      + `<text x="${cx}" y="${barY + 36}" text-anchor="middle" font-family="${HEADING}" font-size="19" letter-spacing="2" fill="${t.gold}">${m.piecesRevealed} / ${STATUE_PIECES}</text>`
    : '';
  // Waist-up crop of the player's statue on the right (PROGRESS: share cards default to a bust crop).
  let statue = '';
  if (hasStatue) {
    const crop = { x: STATUE_BBOX.x - 15, y: STATUE_BBOX.y, w: STATUE_BBOX.width + 30, h: 420 };
    const s = 360 / crop.h;
    const svg = renderSculptureSvg({
      seed: m.seed!, piecesRevealed: m.piecesRevealed, weekProgressPct: 0,
      archetype: m.archetype, decorations: m.decorations ?? [],
      background: 'none', idPrefix: `${id}-sc`, width: 600, height: 800,
    });
    statue = `<clipPath id="${id}-bust"><rect x="768" y="118" width="330" height="400" rx="10"/></clipPath>`
      + `<rect x="768" y="118" width="330" height="400" rx="10" fill="${t.emblemBg}" stroke="${t.hairline}" stroke-width="1"/>`
      + `<g clip-path="url(#${id}-bust)"><g transform="translate(${fmt(768 + 165 - (crop.x + crop.w / 2) * s)} ${fmt(118 + 8 - crop.y * s)}) scale(${fmt(s)})">${svg}</g></g>`
      + `<rect x="768" y="118" width="330" height="400" rx="10" fill="none" stroke="${t.gold}" stroke-opacity="0.5" stroke-width="1.4"/>`;
  }
  return eyebrow(info.label, t) + title + sub + bar + statue;
}

// ---------- main ----------

export interface RenderCardInput {
  variant?: CardVariant;
  /** Prefix for element ids (unique per card when several share a document). */
  idPrefix?: string;
}

export function renderShareCardSvg(model: ShareCardModel, input: RenderCardInput = {}): string {
  const variant = input.variant ?? 'light';
  const t = THEMES[variant];
  const id = (input.idPrefix ?? 'card').replace(/[^A-Za-z0-9_-]/g, '');
  const W = CARD.width;
  const H = CARD.height;

  const defs = [
    `<radialGradient id="${id}-bg" cx="0.5" cy="0.38" r="0.9"><stop offset="0" stop-color="${t.bg0}"/><stop offset="1" stop-color="${t.bg1}"/></radialGradient>`,
    `<linearGradient id="${id}-goldfill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F8E68A"/><stop offset="0.5" stop-color="${PALETTE.gold}"/><stop offset="1" stop-color="#8A6A12"/></linearGradient>`,
    `<filter id="${id}-noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.4  0 0 0 0 0.36  0 0 0 -1.9 1.05"/></filter>`,
    `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.29  0 0 0 0 0.27  0 0 0 -1.1 0.9"/></filter>`,
    `<radialGradient id="${id}-vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${variant === 'dark' ? 0.42 : 0.14}"/></radialGradient>`,
  ];

  let body: string;
  switch (model.scope) {
    case 'takeaway': body = takeawayBody(model, t); break;
    case 'quest': body = questBody(model, t); break;
    case 'custom_set': body = customSetBody(model, t); break;
    case 'day': body = dayBody(model, t); break;
    case 'week': body = weekBody(model, t); break;
    case 'achievement': body = achievementBody(model, t); break;
    case 'milestone': body = milestoneBody(model, id, t); break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gamifying the Grind share card: ${esc(SCOPE_INFO[model.scope].label)}">`
    + `<defs>${defs.join('')}</defs>`
    + `<rect width="${W}" height="${H}" fill="url(#${id}-bg)"/>`
    + `<rect width="${W}" height="${H}" filter="url(#${id}-noise)" opacity="${variant === 'dark' ? 0.1 : 0.16}"/>`
    + `<rect width="${W}" height="${H}" filter="url(#${id}-grain)" opacity="0.05"/>`
    + `<rect width="${W}" height="${H}" fill="url(#${id}-vig)"/>`
    + frame(t) + wordmark(t) + body + footer(model, t)
    + `</svg>`;
}
