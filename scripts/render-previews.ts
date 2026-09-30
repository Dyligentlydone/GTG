// Renders sculpture previews to PNG in previews/ (SPEC §8.4).
// Uses Playwright's Chromium if available (local or global install), else sharp.
// Run: npm run previews
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES, renderSculptureSvg, type RenderSculptureInput } from '../src/sculpture';

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

await browser?.close();
