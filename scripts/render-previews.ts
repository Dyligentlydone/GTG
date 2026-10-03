// Renders sculpture previews to PNG in previews/ (SPEC §8.4).
// Uses Playwright's Chromium if available (local or global install), else sharp.
// Run: npm run previews
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES, renderSculptureSvg, type RenderSculptureInput } from '../src/sculpture';
import { buildShareCardModel, renderShareCardSvg, CARD_VARIANTS, type ShareItem, type ShareScope } from '../src/share';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'previews');
mkdirSync(outDir, { recursive: true });

function loadModule<T>(name: string): T | null {
  const bases = [resolve(root, 'package.json')];
  try { bases.push(`${execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}/`); } catch { /* no npm */ }
  for (const base of bases) {
    try { return createRequire(base)(name) as T; } catch { /* try next */ }
  }
  return null;
}

type Page = { setContent(html: string): Promise<void>; screenshot(o: { path: string; fullPage?: boolean }): Promise<unknown>; setViewportSize(v: { width: number; height: number }): Promise<void> };
type Browser = { newPage(): Promise<Page>; close(): Promise<void> };
const playwright = loadModule<{ chromium: { launch(o?: object): Promise<Browser> } }>('playwright');
const sharp = playwright ? null : loadModule<(input: Buffer) => { png(): { toFile(p: string): Promise<unknown> } }>('sharp');
if (!playwright && !sharp) throw new Error('Need playwright or sharp to render previews');

const html = (body: string, width: number, height: number) =>
  `<!doctype html><html><head><style>html,body{margin:0;background:#111114;width:${width}px;height:${height}px;overflow:hidden}` +
  `.row{display:flex;gap:0}.cell{position:relative}.label{position:absolute;bottom:10px;width:100%;text-align:center;` +
  `font:600 18px Georgia,serif;letter-spacing:2px;color:#C9A227;text-transform:uppercase}</style></head><body>${body}</body></html>`;

let browser: Browser | null = null;
let page: Page | null = null;

async function renderPng(file: string, body: string, width: number, height: number, svgOnly?: string): Promise<void> {
  const path = resolve(outDir, file);
  mkdirSync(dirname(path), { recursive: true });
  if (playwright) {
    browser ??= await playwright.chromium.launch();
    page ??= await browser.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(html(body, width, height));
    await page.screenshot({ path });
  } else if (sharp && svgOnly) {
    await sharp(Buffer.from(svgOnly)).png().toFile(path);
  }
  console.log(`wrote previews/${file}`);
}

async function one(file: string, input: RenderSculptureInput): Promise<void> {
  const svg = renderSculptureSvg(input);
  writeFileSync(resolve(outDir, file.replace(/\.png$/, '.svg')), svg);
  await renderPng(file, svg, 600, 800, svg);
}

const ALL_DECORATIONS = [
  { type: 'laurel_leaf', count: 5 }, { type: 'gold_vein', count: 6 }, { type: 'plinth_carving', count: 2 },
  'plinth_symbol_mental', 'plinth_symbol_physical', 'plinth_symbol_emotional', 'plinth_symbol_spiritual',
  'plinth_symbol_financial', 'plinth_symbol_social', 'plinth_symbol_environmental', 'plinth_symbol_recreational',
  'inner_ring', 'outer_ring',
];

for (const seed of [1, 2, 3]) await one(`rock-seed${seed}-0.png`, { seed, piecesRevealed: 0, weekProgressPct: 0 });
for (const pieces of [0, 30, 60, 90, 115, 120]) await one(`sculpture-seed1-${pieces}.png`, { seed: 1, piecesRevealed: pieces, weekProgressPct: 0 });
await one('sculpture-seed1-60-week50.png', { seed: 1, piecesRevealed: 60, weekProgressPct: 0.5 });
await one('sculpture-seed1-60-week100.png', { seed: 1, piecesRevealed: 60, weekProgressPct: 1 });
await one('sculpture-seed1-complete-decorated.png', { seed: 1, piecesRevealed: 120, weekProgressPct: 0, decorations: ALL_DECORATIONS });

// Contact sheet: 0 → 120.
const steps = [0, 20, 40, 60, 80, 100, 110, 115, 120];
const cellW = 300;
const cellH = 400;
const cells = steps.map((p) => `<div class="cell">${renderSculptureSvg({ seed: 1, piecesRevealed: p, weekProgressPct: 0, idPrefix: `c${p}`, width: cellW, height: cellH })}<div class="label">${p}</div></div>`).join('');
await renderPng('sculpture-progression.png', `<div class="row">${cells}</div>`, cellW * steps.length, cellH);

// Every archetype, complete (the placeholder figures the statue provider falls back to).
const archCells = ARCHETYPES.map((a) => `<div class="cell">${renderSculptureSvg({ seed: 1, piecesRevealed: 120, weekProgressPct: 0, archetype: a, idPrefix: `a${a}`, width: cellW, height: cellH })}<div class="label">${a}</div></div>`).join('');
await renderPng('statue-archetypes.png', `<div class="row">${archCells}</div>`, cellW * ARCHETYPES.length, cellH);

// Share cards (SPEC §9.3): every scope, light and dark.
const cardItems: ShareItem[] = [
  { type: 'takeaway', id: 't1', text: 'You do not rise to your goals; you fall to your systems.', bookTitle: 'Atomic Habits', dayNumber: 34, pillar: 'mental' },
  { type: 'quest', id: 'q1', title: 'Wake up before the sun rises 5 days a week', pillar: 'physical', xp: 25, date: '2026-09-28' },
  { type: 'quest', id: 'q2', title: 'Read 10 pages a day from a self-development book', pillar: 'mental', xp: 20, date: '2026-09-28' },
  { type: 'quest', id: 'q3', title: 'Money minute', pillar: 'financial', xp: 10, date: '2026-09-28' },
  { type: 'pillar', id: 'p1', pillar: 'emotional', done: 6, due: 7 },
  { type: 'stat', id: 's1', label: 'Longest streak', value: '34 days', pillar: 'emotional' },
  { type: 'takeaway', id: 't2', text: 'Discipline is remembering what you want most.', pillar: 'spiritual' },
  {
    type: 'day', id: 'd1', date: '2026-09-28', dayNumber: 34, fullSet: true, streak: 12,
    quests: [
      { title: 'Read 10 pages a day from a self-development book', pillar: 'mental', xp: 20 },
      { title: 'Journal once a day', pillar: 'emotional', xp: 15 },
      { title: 'Exercise 4 days a week', pillar: 'physical', xp: 30 },
      { title: 'Wake up before the sun rises', pillar: 'physical', xp: 25 },
      { title: 'Money minute', pillar: 'financial', xp: 10 },
      { title: '5 minutes of stillness', pillar: 'spiritual', xp: 10 },
    ],
  },
  {
    type: 'week', id: 'w1', weekStart: '2026-09-21', pagesRead: 84, dawns: 5, perfectWeek: true, piecesChiseled: 5, piecesRevealed: 65,
    quests: [
      { title: 'Read 10 pages a day', pillar: 'mental', done: 7, due: 7 },
      { title: 'Journal once a day', pillar: 'emotional', done: 7, due: 7 },
      { title: 'Exercise 4 days a week', pillar: 'physical', done: 4, due: 4 },
      { title: 'Wake before the sun', pillar: 'physical', done: 5, due: 5 },
      { title: 'Stillness', pillar: 'spiritual', done: 5, due: 5 },
      { title: 'Money minute', pillar: 'financial', done: 5, due: 5 },
      { title: 'Intentional connection', pillar: 'social', done: 3, due: 3 },
      { title: 'Space reset', pillar: 'environmental', done: 3, due: 3 },
      { title: 'Play', pillar: 'recreational', done: 3, due: 3 },
    ],
  },
  { type: 'achievement', id: 'a1', name: 'Dawn Patrol', scope: 'physical', rarity: 'rare', rarityPct: 8 },
  { type: 'achievement', id: 'a2', name: 'Master of the Inner World', scope: 'inner', rarity: 'legendary', rarityPct: 1 },
  { type: 'milestone', id: 'm1', kind: 'book_finished', piecesRevealed: 48, seed: 1, archetype: 'philosopher', bookTitle: 'Meditations', decorations: ['laurel_leaf'] },
  { type: 'milestone', id: 'm2', kind: 'sculpture_halfway', piecesRevealed: 60, seed: 1, archetype: 'athlete' },
  { type: 'milestone', id: 'm3', kind: 'sculpture_complete', piecesRevealed: 120, seed: 1, archetype: 'warrior', decorations: [{ type: 'laurel_leaf', count: 5 }, { type: 'gold_vein', count: 4 }, 'inner_ring', 'outer_ring'] },
];

const cardSelections: { scope: ShareScope; ids: string[]; name: string }[] = [
  { scope: 'takeaway', ids: ['t1'], name: '' },
  { scope: 'quest', ids: ['q1'], name: '' },
  { scope: 'custom_set', ids: ['q2', 't2', 'p1', 's1', 'q3'], name: '' },
  { scope: 'day', ids: ['d1'], name: '' },
  { scope: 'week', ids: ['w1'], name: '' },
  { scope: 'achievement', ids: ['a1'], name: '-pillar' },
  { scope: 'achievement', ids: ['a2'], name: '-world' },
  { scope: 'milestone', ids: ['m1'], name: '-book' },
  { scope: 'milestone', ids: ['m2'], name: '-halfway' },
  { scope: 'milestone', ids: ['m3'], name: '-complete' },
];

for (const { scope, ids, name } of cardSelections) {
  for (const variant of CARD_VARIANTS) {
    const r = buildShareCardModel({ scope, handle: 'dyl', items: cardItems, selectedIds: ids });
    if (!r.ok) throw new Error(`preview model failed for ${scope}/${ids}: ${r.reason}`);
    const file = `cards/${scope}${name}-${variant}.png`;
    const svg = renderShareCardSvg(r.model, { variant, idPrefix: `p${scope}${ids.join('')}${variant}` });
    mkdirSync(resolve(outDir, 'cards'), { recursive: true });
    writeFileSync(resolve(outDir, file.replace(/\.png$/, '.svg')), svg);
    await renderPng(file, svg, 1200, 630, svg);
  }
}

await browser?.close();
