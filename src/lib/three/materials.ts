// Shared procedural materials for the 3D scenes.
import * as THREE from 'three';
import { mulberry32 } from '../../sculpture/rng';

function makeCanvasTex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface MarbleMaps { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; }

/** Seeded marble maps: layered value-noise with dark veining. Alongside the
 *  color map, the same field drives a bump map (veins read as shallow relief,
 *  broad noise as undulation) and a roughness map (polish varies subtly). */
export function marbleMaps(base: number[], vein: number[], seed: number): MarbleMaps {
  const r = mulberry32(seed).next;
  const S = 512;
  const col = document.createElement('canvas');
  const bmp = document.createElement('canvas');
  const rgh = document.createElement('canvas');
  col.width = col.height = bmp.width = bmp.height = rgh.width = rgh.height = S;
  const gc = col.getContext('2d')!;
  const gb = bmp.getContext('2d')!;
  const gr = rgh.getContext('2d')!;
  const ic = gc.createImageData(S, S);
  const ib = gb.createImageData(S, S);
  const ir = gr.createImageData(S, S);
  const grid = 64;
  const pts: number[] = [];
  for (let i = 0; i < grid * grid; i++) pts.push(r());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x) & 63;
    const yi = Math.floor(y) & 63;
    const xf = smooth(x - Math.floor(x));
    const yf = smooth(y - Math.floor(y));
    const a = pts[yi * grid + xi]!;
    const b = pts[yi * grid + ((xi + 1) & 63)]!;
    const c2 = pts[((yi + 1) & 63) * grid + xi]!;
    const d = pts[((yi + 1) & 63) * grid + ((xi + 1) & 63)]!;
    return a + (b - a) * xf + (c2 - a) * yf + (a - b - c2 + d) * xf * yf;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      let n = 0;
      let amp = 1;
      let f = 1;
      for (let o = 0; o < 5; o++) { n += vn(u * f, v * f) * amp; amp *= 0.5; f *= 2; }
      const veinV = Math.abs(Math.sin((u * 0.9 + v * 0.35 + n * 2.6) * Math.PI));
      const t = Math.pow(1 - veinV, 14) * 0.55 + (n - 0.9) * 0.06;
      const i = (y * S + x) * 4;
      ic.data[i] = base[0]! - (base[0]! - vein[0]!) * t;
      ic.data[i + 1] = base[1]! - (base[1]! - vein[1]!) * t;
      ic.data[i + 2] = base[2]! - (base[2]! - vein[2]!) * t;
      ic.data[i + 3] = 255;
      // bump: veins recess slightly, broad noise gives gentle undulation
      const hb = Math.max(0, Math.min(255, 150 + (n - 0.95) * 90 - Math.pow(1 - veinV, 14) * 120));
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = hb;
      ib.data[i + 3] = 255;
      // roughness: veins + noise matte the polish unevenly
      const hr = Math.max(0, Math.min(255, 170 + (n - 0.95) * 70 + Math.pow(1 - veinV, 14) * 60));
      ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = hr;
      ir.data[i + 3] = 255;
    }
  }
  gc.putImageData(ic, 0, 0);
  gb.putImageData(ib, 0, 0);
  gr.putImageData(ir, 0, 0);
  return { map: makeCanvasTex(col, true), bumpMap: makeCanvasTex(bmp, false), roughnessMap: makeCanvasTex(rgh, false) };
}

/** Back-compat: color map only. */
export function marbleTexture(base: number[], vein: number[], seed: number): THREE.CanvasTexture {
  return marbleMaps(base, vein, seed).map;
}

export function marbleMaterial(base: number[], vein: number[], seed: number, roughness = 0.5): THREE.MeshStandardMaterial {
  const maps = marbleMaps(base, vein, seed);
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: 0.6,
    roughnessMap: maps.roughnessMap,
    roughness: Math.min(1, roughness * 1.9),
    envMapIntensity: 0.55,
  });
}

/** Stone paving: a grid of worn slabs with dark joints, per-slab tone shifts,
 *  edge chips and surface wear — color + bump + roughness from one pass. */
export function pavingMaterial(seed: number, tiles = 6): THREE.MeshStandardMaterial {
  const rnd = mulberry32(seed).next;
  const S = 1024;
  const col = document.createElement('canvas');
  const bmp = document.createElement('canvas');
  const rgh = document.createElement('canvas');
  col.width = col.height = bmp.width = bmp.height = rgh.width = rgh.height = S;
  const gc = col.getContext('2d')!;
  const gb = bmp.getContext('2d')!;
  const gr = rgh.getContext('2d')!;
  const ic = gc.createImageData(S, S);
  const ib = gb.createImageData(S, S);
  const ir = gr.createImageData(S, S);
  const grid = 64;
  const pts: number[] = [];
  for (let i = 0; i < grid * grid; i++) pts.push(rnd());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x) & 63, yi = Math.floor(y) & 63;
    const xf = smooth(x - Math.floor(x)), yf = smooth(y - Math.floor(y));
    const a = pts[yi * grid + xi]!, b = pts[yi * grid + ((xi + 1) & 63)]!;
    const c2 = pts[((yi + 1) & 63) * grid + xi]!, d = pts[((yi + 1) & 63) * grid + ((xi + 1) & 63)]!;
    return a + (b - a) * xf + (c2 - a) * yf + (a - b - c2 + d) * xf * yf;
  };
  // per-slab tone variation (hash on slab index)
  const slabTone = (sx: number, sy: number) => {
    const h = Math.sin(sx * 127.1 + sy * 311.7 + seed * 13.3) * 43758.5453;
    return (h - Math.floor(h)) * 2 - 1;
  };
  const tile = S / tiles;
  const JOINT = 3.5;       // half joint width in px
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const sx = Math.floor(x / tile), sy = Math.floor(y / tile);
      // jittered joint lines so slabs aren't laser-cut
      const jx = vn(x / 37 + sy * 9, y / 37) * 4 - 2;
      const jy = vn(y / 37 + sx * 7, x / 37) * 4 - 2;
      const dx = Math.min((x + jx) % tile, tile - ((x + jx) % tile));
      const dy = Math.min((y + jy) % tile, tile - ((y + jy) % tile));
      const edge = Math.min(dx, dy);
      const joint = Math.max(0, 1 - edge / JOINT);           // 1 in the gap
      const bevel = Math.max(0, 1 - edge / (JOINT * 4)) * (1 - joint); // worn slab edges
      let n = 0, amp = 1, f = 1;
      for (let o = 0; o < 5; o++) { n += vn((x / S) * 10 * f, (y / S) * 10 * f) * amp; amp *= 0.5; f *= 2; }
      const tone = slabTone(sx, sy);
      // dusty travertine: warm grey with per-slab shifts and grime pooling near joints
      let rC = 196 + tone * 11 + (n - 0.95) * 34;
      let gC = 188 + tone * 9 + (n - 0.95) * 32;
      let bC = 172 + tone * 7 + (n - 0.95) * 28;
      const grime = joint * 0.72 + bevel * 0.2;
      rC *= 1 - grime * 0.55; gC *= 1 - grime * 0.55; bC *= 1 - grime * 0.52;
      const i = (y * S + x) * 4;
      ic.data[i] = Math.max(0, Math.min(255, rC));
      ic.data[i + 1] = Math.max(0, Math.min(255, gC));
      ic.data[i + 2] = Math.max(0, Math.min(255, bC));
      ic.data[i + 3] = 255;
      const hb = Math.max(0, Math.min(255, 165 + (n - 0.95) * 70 - joint * 120 - bevel * 36));
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = hb; ib.data[i + 3] = 255;
      const hr = Math.max(0, Math.min(255, 196 + (n - 0.95) * 60 + joint * 50 - tone * 14));
      ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = hr; ir.data[i + 3] = 255;
    }
  }
  gc.putImageData(ic, 0, 0); gb.putImageData(ib, 0, 0); gr.putImageData(ir, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: makeCanvasTex(col, true),
    bumpMap: makeCanvasTex(bmp, false),
    bumpScale: 1.4,
    roughnessMap: makeCanvasTex(rgh, false),
    roughness: 1,
    envMapIntensity: 0.35,
  });
}
