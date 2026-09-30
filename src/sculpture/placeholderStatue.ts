// Placeholder statue: a classical figure on a plinth in white marble (SVG), used until AI-generated
// statues exist. Four archetypes share one frame so shards and decorations line up:
//   philosopher (default): bearded, himation over one shoulder, scroll held at the chest
//   athlete: heroic nude torso, hip drape, contrapposto stance
//   warrior: heroic body, round shield, spear, Corinthian helmet pushed up
//   orator: draped, clean-shaven, raised arm
// All coordinates are in the 600×800 sculpture canvas. Light comes from the upper left.
import type { BBox, Polygon } from './geometry';
import { limbPath } from './geometry';

export type Archetype = 'philosopher' | 'athlete' | 'warrior' | 'orator';
export const ARCHETYPES: readonly Archetype[] = ['philosopher', 'athlete', 'warrior', 'orator'];
export const DEFAULT_ARCHETYPE: Archetype = 'philosopher';

export const CANVAS = { width: 600, height: 800 } as const;
export const PALETTE = {
  marble: '#F4F1EA',
  stone: '#B9B4AA',
  shadow: '#6E6A63',
  gold: '#C9A227',
  ink: '#1B1B1F',
} as const;

/** Bounding box of the statue (figure + plinth), shared by every archetype. */
export const STATUE_BBOX: BBox = { x: 150, y: 30, width: 300, height: 732 };
/**
 * Top ~15% of the statue bounding box: the head region, revealed last. 17% here so the region
 * includes the whole head down to the tip of the beard (y ≈ 154).
 */
export const HEAD_REGION_MAX_Y = STATUE_BBOX.y + STATUE_BBOX.height * 0.17;
/** Base of the plinth (the ground line). */
export const PLINTH_BASE_Y = 762;
/**
 * Convex region every archetype fits inside (head, raised arm, shield, spear tip, plinth).
 * The rock is generated to cover it, so it hugs the figure but never cuts into it.
 */
export const STATUE_PROFILE: Polygon = [
  { x: 198, y: 20 }, { x: 402, y: 20 }, { x: 460, y: 112 },
  { x: 460, y: PLINTH_BASE_Y }, { x: 140, y: PLINTH_BASE_Y }, { x: 140, y: 112 },
];
/** Anchor points decorations attach to. */
export const ANCHORS = {
  headCenter: { x: 300, y: 92 },
  headRadius: { x: 37, y: 54 },
  /** Where a laurel wreath sits (hairline). */
  crown: { x: 300, y: 58, rx: 40, ry: 13 },
  plinthFace: { x: 180, y: 682, width: 240, height: 53 },
  plinthBaseY: PLINTH_BASE_Y,
} as const;

// ---------------------------------------------------------------- shared parts

const PLINTH = {
  base: 'M160 740 L166 735 L434 735 L440 740 L440 762 L160 762 Z',
  body: 'M180 682 L420 682 L420 735 L180 735 Z',
  cap: 'M166 664 L434 664 L434 674 L424 682 L176 682 L166 674 Z',
  slab: 'M212 646 L388 646 L392 664 L208 664 Z',
};

const NECK = 'M285 110 L282 160 C294 167 306 167 318 160 L315 110 Z';
const EARS = ['M275 84 C266 83 265 103 275 106 Z', 'M325 84 C334 83 335 103 325 106 Z'];
const FACE_BEARDED = 'M273 86 C273 64 285 52 300 52 C315 52 327 64 327 86 C327 106 320 124 300 128 C280 124 273 106 273 86 Z';
const FACE_YOUNG = 'M273 86 C273 64 285 52 300 52 C315 52 327 64 327 86 C327 104 322 118 312 126 C305 131 295 131 288 126 C278 118 273 104 273 86 Z';
const HAIR_LONG = 'M268 92 C260 62 277 36 300 35 C323 36 340 62 332 92 C329 78 323 68 314 63 C306 59 294 59 286 63 C277 68 271 78 268 92 Z';
const HAIR_SHORT = 'M270 86 C265 60 280 39 300 38 C320 39 335 60 330 86 C327 74 320 65 312 62 C304 59 296 59 288 62 C280 65 273 74 270 86 Z';
const BEARD = 'M272 94 C269 118 281 142 300 146 C319 142 331 118 328 94 C325 108 315 115 300 115 C285 115 275 108 272 94 Z';
const HELMET = 'M264 84 C258 54 276 32 300 31 C324 32 342 54 336 84 C332 72 318 64 300 64 C282 64 268 72 264 84 Z';
const HELMET_CREST = 'M280 40 C278 30 288 26 300 26 C312 26 322 30 320 40 C314 36 306 35 300 35 C294 35 286 36 280 40 Z';

// ---------------------------------------------------------------- draped body (philosopher, orator)

const CHITON = 'M284 164 C264 168 240 175 222 183 C204 191 193 206 194 226 C196 254 204 278 210 304 '
  + 'C214 330 214 352 212 374 C208 440 208 520 212 590 C214 614 218 630 222 640 L378 640 '
  + 'C382 630 386 614 388 590 C392 520 392 440 388 374 C386 352 386 330 390 304 C396 278 404 254 406 226 '
  + 'C408 206 398 191 380 183 C362 175 338 168 316 164 Z';
const HIMATION = 'M316 164 C346 168 376 176 394 186 C411 196 418 214 417 238 C418 272 421 300 418 330 C414 350 413 366 414 382 '
  + 'C408 450 403 520 401 594 C372 609 318 607 270 597 C246 591 226 583 209 575 C207 510 208 440 212 380 '
  + 'C244 362 280 330 304 290 C322 258 332 214 316 164 Z';
const HIMATION_ROLL = 'M212 380 C244 362 280 330 304 290 C322 258 332 214 316 164 L332 166 C346 214 338 264 320 300 '
  + 'C296 342 260 374 222 394 Z';
const CASCADE = 'M398 384 C412 396 422 420 426 450 C430 490 433 530 435 566 L424 555 L428 584 L415 569 L416 598 '
  + 'L404 583 L402 598 C400 540 399 470 398 384 Z';
const HAND_AT_HIP = 'M396 380 C404 374 416 378 419 388 C421 398 414 406 404 405 C396 403 392 390 396 380 Z';
const FEET_DRAPED = ['M244 642 C244 634 280 634 280 642 C280 650 244 650 244 642 Z', 'M320 643 C320 635 358 635 358 643 C358 651 320 651 320 643 Z'];

const LEFT_ARM_BENT = limbPath([[216, 208, 40], [202, 250, 34], [196, 294, 29], [207, 322, 26], [240, 302, 23], [268, 274, 20]]);
const SLEEVE = 'M230 182 C210 186 192 198 188 222 C186 240 188 252 192 260 C204 268 224 266 236 256 C240 232 240 204 230 182 Z';
const SCROLL = 'M248 263 L340 247 C347 247 349 265 343 267 L251 283 C244 283 242 265 248 263 Z';
const HAND_ON_SCROLL = 'M258 262 C262 252 276 248 288 252 C295 256 296 272 290 280 C282 286 266 286 260 280 C256 275 256 268 258 262 Z';

const LEFT_ARM_RAISED = limbPath([[218, 210, 38], [196, 216, 31], [177, 222, 27], [166, 190, 24], [168, 150, 21], [174, 120, 18]]);
const HAND_RAISED = 'M166 118 C163 104 164 88 168 82 C171 78 175 80 175 86 L176 76 C177 71 182 71 183 76 L184 80 '
  + 'C185 75 190 75 191 80 L191 90 C194 86 198 88 197 94 C195 104 192 114 186 122 Z';

const DRAPED_FOLDS = {
  chest: ['M290 178 C282 200 266 218 246 238', 'M306 180 C302 206 290 228 274 246', 'M234 212 C238 232 240 250 238 268'],
  himationUpper: ['M398 204 C374 262 332 322 272 366', 'M410 250 C390 306 352 352 300 382', 'M413 306 C400 350 374 384 336 404', 'M376 188 C360 226 342 256 320 280'],
  himationLower: ['M222 410 C258 458 312 468 362 440', 'M218 452 C262 514 322 522 384 474', 'M216 500 C254 552 322 566 394 524', 'M228 552 C270 578 330 588 396 566', 'M372 430 C376 480 380 530 388 590'],
  hem: 'M211 568 C230 578 250 585 272 590 C318 600 370 602 399 588',
  chitonBottom: [230, 244, 258, 272, 286, 300, 314, 328, 342, 356, 370].map((x, i) => `M${x} ${592 + (i % 3) * 3} C${x - 2} ${608} ${x + 2} ${622} ${x - 1} ${638}`),
  cascade: ['M404 400 C412 440 418 500 420 560', 'M410 420 C420 470 426 520 428 576'],
};

// ---------------------------------------------------------------- heroic body (athlete, warrior)

const TORSO_HEROIC = 'M284 164 C264 168 240 175 220 183 C202 191 192 206 194 226 C198 246 208 256 220 266 '
  + 'C224 290 230 316 236 336 C234 350 228 362 224 378 L378 378 C374 362 368 350 366 336 C372 316 378 290 382 262 '
  + 'C392 256 402 246 406 226 C408 206 398 191 380 183 C360 175 336 168 316 164 Z';
const LEG_WEIGHT = limbPath([[262, 460, 64], [259, 530, 48], [257, 590, 36], [255, 630, 29]]);
const LEG_FREE = limbPath([[336, 460, 60], [346, 530, 46], [354, 590, 34], [362, 628, 28]]);
const FEET_HEROIC = ['M232 642 C232 632 276 632 278 642 C278 652 232 652 232 642 Z', 'M346 642 C346 634 382 634 384 642 C384 651 346 651 346 642 Z'];
const HIP_DRAPE = 'M218 368 C258 356 342 358 384 374 C390 410 393 450 387 492 C362 504 332 494 302 502 '
  + 'C272 512 244 500 220 508 C214 470 212 420 218 368 Z';
const HIP_DRAPE_END = 'M372 382 C390 420 396 472 388 524 L379 512 L375 536 L364 516 C368 472 368 424 372 382 Z';
const ARM_L_HANGING = limbPath([[216, 208, 42], [196, 240, 32], [193, 300, 27], [197, 360, 22], [203, 418, 18]]);
const ARM_R_HANGING = limbPath([[384, 208, 42], [404, 240, 32], [407, 300, 27], [403, 360, 22], [397, 418, 18]]);
const HAND_L_HANGING = 'M194 420 C192 432 196 450 205 454 C214 454 218 440 215 422 Z';
const HAND_R_HANGING = 'M406 420 C408 432 404 450 395 454 C386 454 382 440 385 422 Z';
const ARM_L_SHIELD = limbPath([[216, 208, 42], [197, 236, 32], [196, 290, 28]]);
const SHIELD = 'M224 294 C267 294 302 329 302 372 C302 415 267 450 224 450 C181 450 146 415 146 372 C146 329 181 294 224 294 Z';
const SPEAR = limbPath([[397, 80, 7], [398, 400, 7], [400, 644, 7]]);
const SPEAR_TIP = 'M397 40 C405 56 406 72 400 84 L394 84 C388 72 389 56 397 40 Z';
const ARM_R_SPEAR = limbPath([[384, 208, 42], [405, 240, 32], [409, 300, 27], [406, 356, 22], [400, 410, 18]]);
const HAND_ON_SPEAR = 'M388 412 C388 402 410 400 412 412 L412 438 C410 448 390 448 388 438 Z';

const HEROIC_ANATOMY = [
  'M226 214 C246 240 280 244 296 224', 'M374 214 C354 240 320 244 304 224', // pectorals
  'M300 190 L300 262', 'M300 270 C299 300 300 320 300 344', // sternum, linea alba
  'M270 266 C282 270 292 270 298 266', 'M330 266 C318 270 308 270 302 266',
  'M272 296 C284 299 292 299 298 296', 'M328 296 C316 299 308 299 302 296',
  'M274 324 C284 326 292 326 298 324', 'M326 324 C316 326 308 326 302 324',
  'M238 318 C254 342 272 358 292 368', 'M362 318 C346 342 328 358 308 368', // iliac line
  'M236 262 C246 282 252 300 256 318', 'M364 262 C354 282 348 300 344 318', // serratus/obliques
];

// ---------------------------------------------------------------- figures

interface Figure {
  silhouette: string[];
  draw(g: (n: string) => string): string;
}

const PLINTH_SIL = [PLINTH.base, PLINTH.body, PLINTH.cap, PLINTH.slab];

/** The head is drawn in its own frame and scaled up about the crown (heroic proportions). */
const HEAD_SCALE = 1.16;
const HEAD_PIVOT = { x: 300, y: 35 };
const HEAD_TRANSFORM = `translate(${HEAD_PIVOT.x} ${HEAD_PIVOT.y}) scale(${HEAD_SCALE}) translate(${-HEAD_PIVOT.x} ${-HEAD_PIVOT.y})`;

/** Applies the head transform to a path made only of absolute M/L/C/Q/Z commands. */
function scaleHeadPath(d: string): string {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (num) => {
    const v = Number(num);
    const pivot = i++ % 2 === 0 ? HEAD_PIVOT.x : HEAD_PIVOT.y;
    return String(Math.round((pivot + (v - pivot) * HEAD_SCALE) * 100) / 100);
  });
}

function headSil(kind: 'bearded' | 'young' | 'helmet'): string[] {
  const parts = kind === 'young' ? [NECK, ...EARS, FACE_YOUNG, HAIR_SHORT]
    : kind === 'helmet' ? [NECK, ...EARS, FACE_BEARDED, BEARD, HELMET, HELMET_CREST]
      : [NECK, ...EARS, FACE_BEARDED, HAIR_LONG, BEARD];
  return parts.map(scaleHeadPath);
}

const FIGURES: Record<Archetype, Figure> = {
  philosopher: {
    silhouette: [...PLINTH_SIL, ...FEET_DRAPED, CHITON, HIMATION, HIMATION_ROLL, CASCADE, HAND_AT_HIP, LEFT_ARM_BENT, SLEEVE, SCROLL, HAND_ON_SCROLL, ...headSil('bearded')],
    draw: (g) => drapedBody(g, 'scroll') + head(g, 'bearded'),
  },
  orator: {
    silhouette: [...PLINTH_SIL, ...FEET_DRAPED, CHITON, HIMATION, HIMATION_ROLL, CASCADE, HAND_AT_HIP, LEFT_ARM_RAISED, SLEEVE, HAND_RAISED, ...headSil('young')],
    draw: (g) => drapedBody(g, 'raised') + head(g, 'young'),
  },
  athlete: {
    silhouette: [...PLINTH_SIL, ...FEET_HEROIC, LEG_WEIGHT, LEG_FREE, TORSO_HEROIC, HIP_DRAPE, HIP_DRAPE_END, ARM_L_HANGING, ARM_R_HANGING, HAND_L_HANGING, HAND_R_HANGING, ...headSil('young')],
    draw: (g) => heroicBody(g, 'athlete') + head(g, 'young'),
  },
  warrior: {
    silhouette: [...PLINTH_SIL, ...FEET_HEROIC, LEG_WEIGHT, LEG_FREE, TORSO_HEROIC, HIP_DRAPE, HIP_DRAPE_END, ARM_L_SHIELD, SHIELD, SPEAR, SPEAR_TIP, ARM_R_SPEAR, HAND_ON_SPEAR, ...headSil('helmet')],
    draw: (g) => heroicBody(g, 'warrior') + head(g, 'helmet'),
  },
};

/** Every silhouette path of an archetype: their union is the statue's outline (used for clipping). */
export function silhouettePaths(archetype: Archetype = DEFAULT_ARCHETYPE): readonly string[] {
  return (FIGURES[archetype] ?? FIGURES.philosopher).silhouette;
}
/** The figure without its plinth (gold veins run through the figure only). */
export function figureSilhouettePaths(archetype: Archetype = DEFAULT_ARCHETYPE): readonly string[] {
  return silhouettePaths(archetype).filter((d) => !PLINTH_SIL.includes(d));
}
/** Silhouette of the default (philosopher) statue. */
export const SILHOUETTE_PATHS: readonly string[] = silhouettePaths('philosopher');

// ---------------------------------------------------------------- drawing helpers

const OUTLINE = 'stroke="#9C958A" stroke-width="1.1" stroke-linejoin="round"';

function part(d: string, fill: string, extra = ''): string {
  return `<path d="${d}" fill="${fill}" ${OUTLINE}${extra ? ` ${extra}` : ''}/>`;
}

/** A carved fold: soft groove, crisp crease and a lit ridge on the side facing the light. */
function fold(g: (n: string) => string, d: string, w = 3): string {
  return `<path d="${d}" fill="none" stroke="#7F786D" stroke-width="${w * 1.7}" stroke-linecap="round" stroke-opacity="0.42" filter="url(#${g('soft')})"/>`
    + `<path d="${d}" fill="none" stroke="#8F887D" stroke-width="${w * 0.42}" stroke-linecap="round" stroke-opacity="0.8"/>`
    + `<path d="${d}" transform="translate(${w * 1.3} ${w * 0.4})" fill="none" stroke="#FFFFFF" stroke-width="${w * 1.1}" stroke-linecap="round" stroke-opacity="0.8" filter="url(#${g('soft')})"/>`;
}

function line(d: string, color = '#8F887D', w = 1.2, op = 0.85): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"/>`;
}

function blob(g: (n: string) => string, cx: number, cy: number, rx: number, ry: number, color: string, op: number, rot = 0): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} fill="${color}" opacity="${op}" filter="url(#${g('blur')})"/>`;
}

/** Wraps `content` in a clip to `d` so shading stays inside the part. */
function within(g: (n: string) => string, key: string, d: string, content: string): string {
  return `<clipPath id="${g(`c-${key}`)}"><path d="${d}"/></clipPath><g clip-path="url(#${g(`c-${key}`)})">${content}</g>`;
}

function curl(g: (n: string) => string, x: number, y: number, r: number): string {
  // A carved snail curl: soft dome, shadowed lower-right rim, a small spiral groove.
  const k = (v: number) => Math.round(v * 10) / 10;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g('curl')})"/>`
    + `<path d="M${k(x + r * 0.95)} ${k(y - r * 0.3)} A${r} ${r} 0 0 1 ${k(x - r * 0.3)} ${k(y + r * 0.95)}" fill="none" stroke="#8C857A" stroke-width="1" stroke-opacity="0.55" stroke-linecap="round"/>`
    + `<path d="M${k(x - r * 0.35)} ${k(y + r * 0.1)} A${k(r * 0.4)} ${k(r * 0.4)} 0 1 1 ${k(x + r * 0.15)} ${k(y + r * 0.42)}" fill="none" stroke="#9A9387" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="round"/>`;
}

/** Densely packed curls on a hex grid, kept where `inside` holds (drawn top to bottom). */
function curlField(g: (n: string) => string, x0: number, x1: number, y0: number, y1: number, step: number, r: number, inside: (x: number, y: number) => boolean): string {
  let s = '';
  let row = 0;
  for (let y = y0; y <= y1; y += step * 0.86, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) {
      if (inside(x, y)) s += curl(g, Math.round(x * 10) / 10, Math.round(y * 10) / 10, r);
    }
  }
  return s;
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function plinth(g: (n: string) => string): string {
  const m = `url(#${g('plinth')})`;
  return part(PLINTH.base, m)
    + line('M166 736 L434 736', '#FFFFFF', 1.2, 0.8)
    + part(PLINTH.body, m)
    + within(g, 'plinth-body', PLINTH.body, `<rect x="180" y="682" width="240" height="10" fill="#3A352E" opacity="0.14"/>`)
    + line('M184 690 L416 690', '#B3ADA2', 1, 0.9)
    + line('M184 728 L416 728', '#B3ADA2', 1, 0.9)
    + part(PLINTH.cap, m)
    + line('M170 666 L430 666', '#FFFFFF', 1.4, 0.85)
    + line('M174 675 L426 675', '#A9A397', 1, 0.8)
    + part(PLINTH.slab, m)
    + line('M214 648 L386 648', '#FFFFFF', 1.2, 0.7);
}

// ---------------------------------------------------------------- heads

function head(g: (n: string) => string, kind: 'bearded' | 'young' | 'helmet'): string {
  return `<g transform="${HEAD_TRANSFORM}">${headUnscaled(g, kind)}</g>`;
}

function headUnscaled(g: (n: string) => string, kind: 'bearded' | 'young' | 'helmet'): string {
  const skin = `url(#${g('skin')})`;
  const face = kind === 'young' ? FACE_YOUNG : FACE_BEARDED;
  let s = part(NECK, skin)
    + within(g, 'neck', NECK, blob(g, 300, 116, 26, 14, '#5E574D', 0.45) + blob(g, 314, 140, 7, 22, '#7A7368', 0.3))
    + line('M292 132 C290 146 288 156 286 162', '#A39C90', 1, 0.6) + line('M308 132 C310 146 312 156 314 162', '#A39C90', 1, 0.6)
    + EARS.map((d) => part(d, skin)).join('')
    + line('M272 88 C269 92 269 99 272 102', '#9C958A', 1, 0.8) + line('M328 88 C331 92 331 99 328 102', '#9C958A', 1, 0.8)
    + part(face, skin)
    + within(g, `face-${kind}`, face,
      blob(g, 322, 98, 9, 26, '#8A8378', 0.4) // cheek in shadow
      + blob(g, 290, 86, 8, 5, '#8A8378', 0.45) + blob(g, 311, 86, 8, 5, '#8A8378', 0.5) // eye sockets
      + blob(g, 293, 68, 14, 7, '#FFFFFF', 0.9) + blob(g, 286, 100, 6, 9, '#FFFFFF', 0.55) // forehead, cheek light
      + blob(g, 305, 96, 3.5, 8, '#7F786D', 0.45)) // nose shadow
    // brows, eyes (blank, classical), nose, lips
    + line('M281 79 Q289 74 297 78', '#8C857A', 1.6) + line('M303 78 Q311 74 319 79', '#8C857A', 1.6)
    + `<path d="M283 87 Q290 82.5 297 87 Q290 90 283 87 Z" fill="#E9E5DC" stroke="#8C857A" stroke-width="0.9"/>`
    + `<path d="M303 87 Q310 82.5 317 87 Q310 90 303 87 Z" fill="#E1DCD2" stroke="#8C857A" stroke-width="0.9"/>`
    + line('M299.5 80 C299 88 296.5 96 295 101', '#948D82', 1.2)
    + line('M295 101 Q300 105 305 101', '#8C857A', 1.2)
    + line('M273 86 C274 102 279 116 288 124', '#FFFFFF', 1.6, 0.7);
  if (kind === 'young') {
    s += `<path d="M292 113 Q300 110 308 113 Q300 116 292 113 Z" fill="#DCD6CB" stroke="#8C857A" stroke-width="0.9"/>`
      + line('M294 118 Q300 120 306 118', '#FFFFFF', 1.4, 0.8)
      + line('M296 124 Q300 126 304 124', '#A39C90', 1, 0.6)
      + part(HAIR_SHORT, `url(#${g('hair')})`)
      + curlField(g, 268, 332, 40, 90, 6.6, 4.3, (x, y) => inEllipse(x, y, 300, 70, 30, 32) && !inEllipse(x, y, 300, 90, 25, 30));
    return s;
  }
  // Beard and moustache (bearded philosopher, helmeted warrior).
  s += part(BEARD, `url(#${g('hair')})`)
    + within(g, `beard-${kind}`, BEARD, blob(g, 318, 134, 12, 18, '#7F786D', 0.45))
    + curlField(g, 270, 330, 98, 146, 6.6, 4.2, (x, y) => inEllipse(x, y, 300, 108, 28, 38) && y < 142 - Math.abs(x - 300) * 0.3 && !(y < 121 && Math.abs(x - 300) < 16))
    + `<path d="M286 108 C292 103 298 105 300 107 C302 105 308 103 314 108 C308 112 302 111 300 110 C298 111 292 112 286 108 Z" fill="#EDE9E1" stroke="#8C857A" stroke-width="0.9"/>`
    + line('M293 114 Q300 116 307 114', '#8C857A', 1.1);
  if (kind === 'helmet') {
    s += part(HELMET, `url(#${g('skin')})`)
      + within(g, 'helmet', HELMET, blob(g, 324, 56, 12, 22, '#7F786D', 0.45) + blob(g, 286, 44, 12, 6, '#FFFFFF', 0.9))
      + `<path d="M280 58 C284 52 294 52 297 58 C292 61 284 61 280 58 Z M303 58 C306 52 316 52 320 58 C316 61 308 61 303 58 Z" fill="#5F594F" opacity="0.8"/>`
      + line('M299 60 L299 66', '#8C857A', 1.4)
      + line('M266 80 C274 70 288 66 300 66 C312 66 326 70 334 80', '#FFFFFF', 1.4, 0.7)
      + part(HELMET_CREST, `url(#${g('hair')})`)
      + [284, 290, 296, 302, 308, 314].map((x) => line(`M${x} ${30} L${x + 1} ${37}`, '#9C958A', 0.8, 0.7)).join('');
    return s;
  }
  s += part(HAIR_LONG, `url(#${g('hair')})`)
    + curlField(g, 266, 334, 38, 100, 7, 4.6, (x, y) => inEllipse(x, y, 300, 72, 32, 36) && !inEllipse(x, y, 300, 92, 25, 32));
  return s;
}

// ---------------------------------------------------------------- bodies

function drapedBody(g: (n: string) => string, arm: 'scroll' | 'raised'): string {
  const cloth = `url(#${g('cloth')})`;
  const drape = `url(#${g('drape')})`;
  const skin = `url(#${g('skin')})`;
  let s = plinth(g)
    + FEET_DRAPED.map((d) => part(d, skin)).join('')
    + line('M250 638 L250 646 M258 637 L258 647 M266 637 L266 647 M327 639 L327 647 M335 638 L335 648 M343 638 L343 648', '#A39C90', 0.8, 0.7)
    + part(CHITON, cloth)
    + within(g, 'chiton', CHITON,
      DRAPED_FOLDS.chitonBottom.map((d) => fold(g, d, 2.2)).join('')
      + DRAPED_FOLDS.chest.map((d) => fold(g, d, 2)).join('')
      + blob(g, 300, 640, 90, 10, '#5E574D', 0.35)
      + `<rect x="190" y="150" width="220" height="500" fill="url(#${g('form')})"/>`)
    + part(HIMATION, drape)
    + within(g, 'himation', HIMATION,
      blob(g, 338, 484, 20, 40, '#FFFFFF', 0.55, -15) // relaxed knee pressing through the cloth
      + DRAPED_FOLDS.himationUpper.map((d) => fold(g, d, 3)).join('')
      + DRAPED_FOLDS.himationLower.map((d) => fold(g, d, 3.2)).join('')
      + blob(g, 246, 402, 36, 14, '#6E675D', 0.22, -30) // shadow under the roll
      + `<rect x="200" y="150" width="220" height="460" fill="url(#${g('form')})"/>`)
    + line(DRAPED_FOLDS.hem, '#8F887D', 1.4, 0.8)
    + part(HIMATION_ROLL, drape)
    + within(g, 'roll', HIMATION_ROLL, line('M218 388 C252 368 288 336 312 296 C330 262 338 214 326 156', '#FFFFFF', 3, 0.85)
      + line('M226 392 C260 372 294 342 318 302', '#8F887D', 1.2, 0.7))
    + part(CASCADE, drape)
    + DRAPED_FOLDS.cascade.map((d) => fold(g, d, 2)).join('')
    + within(g, 'cascade', CASCADE, `<rect x="396" y="380" width="44" height="220" fill="url(#${g('form')})"/>`)
    + part(HAND_AT_HIP, skin);
  if (arm === 'scroll') {
    s += blob(g, 250, 300, 26, 34, '#5E574D', 0.35) // arm shadow on the chest
      + part(LEFT_ARM_BENT, skin)
      + within(g, 'arm-bent', LEFT_ARM_BENT,
        blob(g, 196, 220, 8, 36, '#FFFFFF', 0.9) + blob(g, 222, 312, 22, 10, '#6E675D', 0.4, -30)
      )
      + sleeve(g)
      + blob(g, 300, 282, 44, 8, '#4E483F', 0.4, -10) // scroll shadow
      + part(SCROLL, `url(#${g('plinth')})`)
      + line('M254 266 L338 251', '#FFFFFF', 2, 0.8) + line('M256 280 L342 265', '#A39C90', 1.2, 0.8)
      + `<ellipse cx="343" cy="257" rx="4" ry="10" transform="rotate(-10 343 257)" fill="#E2DDD3" stroke="#9C958A" stroke-width="0.9"/>`
      + `<ellipse cx="343" cy="257" rx="1.5" ry="4" transform="rotate(-10 343 257)" fill="#B2AB9F"/>`
      + part(HAND_ON_SCROLL, skin)
      + line('M266 256 C270 262 270 272 266 280 M275 253 C279 260 279 272 275 283 M284 254 C288 262 287 272 283 283', '#A39C90', 0.9, 0.8);
  } else {
    s += blob(g, 220, 230, 20, 30, '#5E574D', 0.3)
      + part(LEFT_ARM_RAISED, skin)
      + within(g, 'arm-raised', LEFT_ARM_RAISED, blob(g, 178, 170, 6, 40, '#FFFFFF', 0.85) + blob(g, 196, 214, 16, 10, '#6E675D', 0.35))
      + sleeve(g)
      + part(HAND_RAISED, skin)
      + line('M179 84 L179 106 M187 84 L187 108', '#A39C90', 0.8, 0.7);
  }
  return s;
}

/** Short chiton sleeve over the shoulder, pinned with small buttons. */
function sleeve(g: (n: string) => string): string {
  return part(SLEEVE, `url(#${g('cloth')})`)
    + within(g, 'sleeve', SLEEVE, blob(g, 200, 214, 8, 22, '#FFFFFF', 0.8) + blob(g, 232, 230, 8, 30, '#6E675D', 0.35)
      + fold(g, 'M214 196 C208 216 206 236 208 258', 1.8) + fold(g, 'M226 196 C224 220 224 240 224 260', 1.6))
    + line('M190 254 C202 266 222 266 236 256', '#8F887D', 1.3, 0.85)
    + [[208, 200], [199, 218], [195, 238]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#EDE9E1" stroke="#9C958A" stroke-width="0.7"/>`).join('');
}

function heroicBody(g: (n: string) => string, kind: 'athlete' | 'warrior'): string {
  const skin = `url(#${g('skin')})`;
  const drape = `url(#${g('drape')})`;
  let s = plinth(g)
    + FEET_HEROIC.map((d) => part(d, skin)).join('')
    + part(LEG_FREE, skin)
    + within(g, 'leg-free', LEG_FREE, blob(g, 344, 532, 10, 14, '#FFFFFF', 0.9) + `<rect x="300" y="440" width="100" height="200" fill="url(#${g('form')})"/>`)
    + part(LEG_WEIGHT, skin)
    + within(g, 'leg-weight', LEG_WEIGHT, blob(g, 252, 530, 10, 14, '#FFFFFF', 0.9) + blob(g, 278, 560, 8, 40, '#7A7368', 0.35) + blob(g, 244, 600, 5, 26, '#FFFFFF', 0.7))
    + line('M252 546 C256 552 262 552 266 546', '#A39C90', 1, 0.7) + line('M340 548 C344 554 350 554 354 548', '#A39C90', 1, 0.7);
  // Arms are drawn behind the torso so the shoulders overlap them.
  if (kind === 'athlete') {
    s += part(ARM_L_HANGING, skin)
      + within(g, 'arm-l', ARM_L_HANGING, blob(g, 196, 240, 8, 40, '#FFFFFF', 0.9) + blob(g, 214, 300, 6, 60, '#7A7368', 0.3))
      + part(ARM_R_HANGING, skin)
      + within(g, 'arm-r', ARM_R_HANGING, blob(g, 408, 270, 10, 70, '#6E675D', 0.4))
      + part(HAND_L_HANGING, skin) + part(HAND_R_HANGING, skin)
      + line('M200 440 L203 452 M208 440 L209 453', '#A39C90', 0.8, 0.7) + line('M400 440 L397 452 M392 440 L391 453', '#A39C90', 0.8, 0.7);
  } else {
    s += part(SPEAR, `url(#${g('plinth')})`) + part(SPEAR_TIP, `url(#${g('plinth')})`) + line('M397 46 L397 82', '#A39C90', 1, 0.8)
      + part(ARM_L_SHIELD, skin)
      + part(ARM_R_SPEAR, skin)
      + within(g, 'arm-r', ARM_R_SPEAR, blob(g, 410, 270, 10, 70, '#6E675D', 0.4));
  }
  s += part(TORSO_HEROIC, skin)
    + within(g, 'torso', TORSO_HEROIC,
      HEROIC_ANATOMY.map((d) => fold(g, d, 1.6)).join('')
      + blob(g, 262, 226, 18, 12, '#FFFFFF', 0.85) + blob(g, 260, 292, 12, 30, '#FFFFFF', 0.6)
      + blob(g, 300, 172, 34, 10, '#5E574D', 0.35) // under the chin
      + blob(g, 214, 200, 10, 14, '#FFFFFF', 0.8) // lit deltoid
      + `<rect x="190" y="150" width="220" height="230" fill="url(#${g('form')})"/>`)
    + line('M222 186 C216 206 214 226 220 246', '#9C958A', 1, 0.6) + line('M378 186 C384 206 386 226 380 246', '#9C958A', 1, 0.6)
    + `<circle cx="300" cy="334" r="2.2" fill="#9C958A"/>`
    + part(HIP_DRAPE_END, drape)
    + part(HIP_DRAPE, drape)
    + within(g, 'hip-drape', HIP_DRAPE,
      ['M224 384 C264 402 318 404 380 388', 'M222 420 C262 446 322 444 386 420', 'M222 460 C258 482 316 480 388 458', 'M300 380 C296 420 300 460 302 500']
        .map((d) => fold(g, d, 2.6)).join('')
      + `<rect x="210" y="356" width="190" height="160" fill="url(#${g('form')})"/>`)
    + fold(g, 'M378 400 C388 440 390 480 384 516', 2);
  if (kind === 'warrior') {
    s += blob(g, 236, 382, 72, 72, '#3F3A33', 0.35)
      + part(SHIELD, `url(#${g('plinth')})`)
      + within(g, 'shield', SHIELD, `<rect x="146" y="294" width="156" height="156" fill="url(#${g('form')})"/>` + blob(g, 200, 340, 30, 20, '#FFFFFF', 0.8, -30))
      + `<circle cx="224" cy="372" r="66" fill="none" stroke="#9C958A" stroke-width="1.4"/>`
      + `<circle cx="224" cy="372" r="64" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-opacity="0.7"/>`
      + `<path d="M224 334 L233 362 L262 362 L238 379 L247 407 L224 390 L201 407 L210 379 L186 362 L215 362 Z" fill="none" stroke="#9C958A" stroke-width="1.6" stroke-linejoin="round"/>`
      + part(HAND_ON_SPEAR, skin)
      + line('M390 420 L410 420 M390 428 L410 428', '#A39C90', 0.8, 0.7);
  }
  return s;
}

// ---------------------------------------------------------------- public API

export type StatueVariant = 'final' | 'rough';

function statueDefs(g: (n: string) => string): string {
  return `<linearGradient id="${g('skin')}" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.45" stop-color="#F4F1EA"/><stop offset="1" stop-color="#CFC8BC"/></linearGradient>`
    + `<linearGradient id="${g('cloth')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EAE6DD"/><stop offset="0.18" stop-color="#FBFAF6"/><stop offset="0.55" stop-color="#F1EDE5"/><stop offset="1" stop-color="#C9C2B6"/></linearGradient>`
    + `<linearGradient id="${g('drape')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#F2EFE8"/><stop offset="1" stop-color="#D2CCC0"/></linearGradient>`
    + `<linearGradient id="${g('hair')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4DFD5"/><stop offset="1" stop-color="#B3AC9F"/></linearGradient>`
    + `<linearGradient id="${g('plinth')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EEEAE1"/><stop offset="0.3" stop-color="#F8F6F0"/><stop offset="1" stop-color="#B7B0A4"/></linearGradient>`
    + `<linearGradient id="${g('form')}" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.62" stop-color="#3A352E" stop-opacity="0"/><stop offset="1" stop-color="#3A352E" stop-opacity="0.34"/></linearGradient>`
    + `<radialGradient id="${g('curl')}" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#F7F4EE"/><stop offset="0.7" stop-color="#E2DDD3"/><stop offset="1" stop-color="#C8C1B5"/></radialGradient>`
    + `<filter id="${g('soft')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>`
    + `<filter id="${g('blur')}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>`;
}

/**
 * SVG fragment (defs + group) for the placeholder statue. `id` prefixes all ids so several
 * sculptures can share one document.
 */
export function placeholderStatueSvg(id: string, variant: StatueVariant = 'final', archetype: Archetype = DEFAULT_ARCHETYPE): string {
  const g = (n: string) => `${id}-${n}`;
  const fig = FIGURES[archetype] ?? FIGURES.philosopher;
  if (variant === 'rough') {
    // Roughed-out form: the silhouette thickened, flat-planed, covered in point-chisel marks.
    const bulk = fig.silhouette.map((d) => `<path d="${d}" fill="#D9D3C8" stroke="#D9D3C8" stroke-width="12" stroke-linejoin="round"/>`).join('');
    const edge = fig.silhouette.map((d) => `<path d="${d}" fill="none" stroke="#8F897F" stroke-width="13.5" stroke-linejoin="round"/>`).join('');
    return `<defs>`
      + `<linearGradient id="${g('rough')}" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#EAE5DB"/><stop offset="0.5" stop-color="#D5CFC3"/><stop offset="1" stop-color="#A9A296"/></linearGradient>`
      + `<pattern id="${g('chisel')}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 2 L5 2 M4 6 L10 6" stroke="#7F786D" stroke-width="1" stroke-opacity="0.5"/><circle cx="7" cy="2" r="0.8" fill="#7F786D" fill-opacity="0.5"/></pattern>`
      + `<clipPath id="${g('rough-sil')}">${fig.silhouette.map((d) => `<path d="${d}"/>`).join('')}</clipPath>`
      + `</defs><g>${edge}${bulk}`
      + `<g clip-path="url(#${g('rough-sil')})"><rect x="${STATUE_BBOX.x - 20}" y="${STATUE_BBOX.y - 20}" width="${STATUE_BBOX.width + 40}" height="${STATUE_BBOX.height + 40}" fill="url(#${g('rough')})"/>`
      + `<rect x="${STATUE_BBOX.x - 20}" y="${STATUE_BBOX.y - 20}" width="${STATUE_BBOX.width + 40}" height="${STATUE_BBOX.height + 40}" fill="url(#${g('chisel')})"/></g></g>`;
  }
  return `<defs>${statueDefs(g)}</defs><g>${fig.draw(g)}</g>`;
}

/** A complete standalone SVG document of the placeholder statue (transparent background). */
export function placeholderStatueDocument(variant: StatueVariant = 'final', id = 'statue', archetype: Archetype = DEFAULT_ARCHETYPE): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" width="${CANVAS.width}" height="${CANVAS.height}">${placeholderStatueSvg(id, variant, archetype)}</svg>`;
}

