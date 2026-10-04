// Shared procedural materials for the 3D scenes.
import * as THREE from 'three';
import { mulberry32 } from '../../sculpture/rng';

/** Seeded marble texture: layered value-noise with dark veining (canvas-backed). */
export function marbleTexture(base: number[], vein: number[], seed: number): THREE.CanvasTexture {
  const r = mulberry32(seed).next;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
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
      img.data[i] = base[0]! - (base[0]! - vein[0]!) * t;
      img.data[i + 1] = base[1]! - (base[1]! - vein[1]!) * t;
      img.data[i + 2] = base[2]! - (base[2]! - vein[2]!) * t;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function marbleMaterial(base: number[], vein: number[], seed: number, roughness = 0.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: marbleTexture(base, vein, seed), roughness });
}
