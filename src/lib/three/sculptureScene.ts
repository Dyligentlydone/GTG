// Three.js museum stage for the player's sculpture — a port of the proven
// docs/chisel-3d-demo.html prototype to modern three (ESM, physical lights,
// CapsuleGeometry). The rock's 120 chunks are seeded so they match the account.
// Client-only: import via a 'use client' component, never on the server.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mulberry32 } from '../../sculpture/rng';
import { marbleTexture } from './materials';
import { buildStatue } from './statue';

export interface SculptureSceneOptions {
  seed: number;
  piecesRevealed: number;
  /** 0..1 — on-deck chunks glow as the week fills. */
  weekPct?: number;
  autoRotate?: boolean;
}

interface Falling {
  v: THREE.Vector3;
  spin: THREE.Vector3;
  t: number;
  delay: number;
}
interface Piece {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  homeRot: THREE.Euler;
  homeScale: THREE.Vector3;
  removed: boolean;
  falling: Falling | null;
}
interface Dust { pts: THREE.Points; vel: THREE.Vector3[]; life: number; }

const VOID = 0x0a0a0c;
const TOTAL = 120;

export class SculptureScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private pieces: Piece[] = [];
  private order: number[] = [];
  private dust: Dust[] = [];
  private rand: () => number;
  private revealed = 0;
  private weekPct: number;
  private raf = 0;
  private resizeObs: ResizeObserver;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, opts: SculptureSceneOptions) {
    this.rand = mulberry32(opts.seed || 1).next;
    this.weekPct = opts.weekPct ?? 0;
    const rand = this.rand;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(VOID);
    this.scene.fog = new THREE.Fog(VOID, 9, 18);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(3.2, 3.0, 6.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 2.0, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 11;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.autoRotate = opts.autoRotate ?? !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.autoRotateSpeed = 0.6;

    // ---------- lighting: museum spotlight ----------
    this.scene.add(new THREE.HemisphereLight(0x9aa0b0, 0x0a0a0c, 0.35));
    const key = new THREE.SpotLight(0xfff4e2, 180, 30, Math.PI / 7, 0.45, 1.2);
    key.position.set(-3.5, 8.5, 5);
    key.target.position.set(0, 1.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x8fa6ff, 0.55);
    rim.position.set(3, 4, -5);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffe2b0, 12, 12);
    fill.position.set(3, 1.5, 3);
    this.scene.add(fill);

    // floor with a soft pool of light
    const fc = document.createElement('canvas');
    fc.width = fc.height = 256;
    const fg = fc.getContext('2d')!;
    const grd = fg.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, '#26262b');
    grd.addColorStop(1, '#0a0a0c');
    fg.fillStyle = grd;
    fg.fillRect(0, 0, 256, 256);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fc), roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // ---------- procedural marble + statue (shared with the agora world) ----------
    const statueMat = new THREE.MeshStandardMaterial({ map: marbleTexture([238, 234, 226], [150, 146, 140], 11), roughness: 0.42 });
    const rockTex = marbleTexture([212, 208, 200], [120, 116, 110], 23);
    rockTex.repeat.set(1.5, 1.5);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1c1c21, roughness: 0.55 });
    const statue = buildStatue(statueMat);
    this.scene.add(statue);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.2), plinthMat);
    plinth.position.y = 0.21;
    plinth.castShadow = plinth.receiveShadow = true;
    this.scene.add(plinth);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 1.08), new THREE.MeshStandardMaterial({ color: 0x2a2a31, roughness: 0.5 }));
    cap.position.y = 0.46;
    cap.castShadow = cap.receiveShadow = true;
    this.scene.add(cap);

    // ---------- the rock: 120 chunks on a jittered grid ----------
    const NX = 4;
    const NY = 10;
    const NZ = 3;
    const minB = new THREE.Vector3(-0.78, 0.5, -0.58);
    const maxB = new THREE.Vector3(0.78, 3.92, 0.62);
    const cell = new THREE.Vector3((maxB.x - minB.x) / NX, (maxB.y - minB.y) / NY, (maxB.z - minB.z) / NZ);
    const headCenter = new THREE.Vector3(0, 3.45, 0.02);
    const chunkGeometry = () => {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const p = geo.attributes.position as THREE.BufferAttribute;
      const cache = new Map<string, number>();
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!cache.has(k)) cache.set(k, 0.78 + rand() * 0.36);
        const s = cache.get(k)!;
        p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
      }
      geo.computeVertexNormals();
      return geo;
    };
    for (let iy = 0; iy < NY; iy++) {
      for (let ix = 0; ix < NX; ix++) {
        for (let iz = 0; iz < NZ; iz++) {
          const c = new THREE.Vector3(
            minB.x + (ix + 0.5 + (rand() - 0.5) * 0.35) * cell.x,
            minB.y + (iy + 0.5 + (rand() - 0.5) * 0.3) * cell.y,
            minB.z + (iz + 0.5 + (rand() - 0.5) * 0.35) * cell.z,
          );
          const taper = 1 - 0.1 * (iy / (NY - 1));
          c.x *= taper;
          c.z *= taper;
          const shade = 0.82 + rand() * 0.14;
          const mat = new THREE.MeshStandardMaterial({
            map: rockTex,
            color: new THREE.Color(shade, shade, shade * 0.985),
            roughness: 0.8,
            flatShading: true,
            emissive: new THREE.Color(0xc9a227),
            emissiveIntensity: 0,
          });
          const m = new THREE.Mesh(chunkGeometry(), mat);
          m.position.copy(c);
          m.scale.set(cell.x * 0.78, cell.y * 0.8, cell.z * 0.8);
          m.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
          m.castShadow = true;
          m.receiveShadow = true;
          this.scene.add(m);
          this.pieces.push({ mesh: m, home: c.clone(), homeRot: m.rotation.clone(), homeScale: m.scale.clone(), removed: false, falling: null });
        }
      }
    }
    // reveal order: bottom-up with jitter, the head region always last
    const isHead = (p: Piece) => p.home.y > 3.05 && Math.hypot(p.home.x - headCenter.x, p.home.z - headCenter.z) < 0.55;
    this.order = this.pieces
      .map((p, i) => ({ i, key: p.home.y + (rand() - 0.5) * 0.35 + (isHead(p) ? 100 : 0) }))
      .sort((a, b) => a.key - b.key)
      .map((o) => o.i);
    this.isHead = isHead;

    this.placeInstant(opts.piecesRevealed);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.tick();
  }

  private isHead: (p: Piece) => boolean = () => false;

  /** Number of chunks currently carved away. */
  get piecesRevealed(): number {
    return this.revealed;
  }

  setWeekPct(pct: number): void {
    this.weekPct = Math.max(0, Math.min(1, pct));
    this.updateDeckGlow();
  }

  private updateDeckGlow(): void {
    const onDeck = new Set(this.order.slice(this.revealed, this.revealed + 5));
    const crack = Math.min(1, this.weekPct / 0.75);
    for (const [i, p] of this.pieces.entries()) {
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = onDeck.has(i) && !p.removed ? 0.05 + 0.35 * crack : 0;
    }
  }

  /** Jump straight to n carved pieces (page load state). */
  placeInstant(n: number): void {
    this.revealed = Math.max(0, Math.min(TOTAL, n));
    for (const p of this.pieces) {
      p.removed = false;
      p.falling = null;
      p.mesh.visible = true;
      p.mesh.position.copy(p.home);
      p.mesh.rotation.copy(p.homeRot);
      p.mesh.scale.copy(p.homeScale);
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      mat.transparent = false;
    }
    for (let k = 0; k < this.revealed; k++) {
      const p = this.pieces[this.order[k]!]!;
      p.removed = true;
      p.mesh.visible = false;
    }
    this.updateDeckGlow();
  }

  private burst(at: THREE.Vector3): void {
    const N = 60;
    const pos = new Float32Array(N * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = at.x;
      pos[i * 3 + 1] = at.y;
      pos[i * 3 + 2] = at.z;
      vel.push(new THREE.Vector3((this.rand() - 0.5) * 1.6, this.rand() * 1.2, (this.rand() - 0.5) * 1.6));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8e2d4, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false }));
    this.scene.add(pts);
    this.dust.push({ pts, vel, life: 1 });
  }

  /** Animate n chunks cracking off — Chisel Day or "preview your week". */
  chisel(n: number): void {
    for (let k = 0; k < n && this.revealed < TOTAL; k++) {
      const p = this.pieces[this.order[this.revealed]!]!;
      p.removed = true;
      const out = p.home.clone().setY(0).normalize();
      if (!isFinite(out.x)) out.set(1, 0, 0);
      p.falling = {
        v: new THREE.Vector3(out.x * (0.8 + this.rand()), 1.2 + this.rand() * 1.2, out.z * (0.8 + this.rand()) + 0.4),
        spin: new THREE.Vector3(this.rand() * 6 - 3, this.rand() * 6 - 3, this.rand() * 6 - 3),
        t: 0,
        delay: k * 0.12,
      };
      (p.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      const home = p.home.clone();
      setTimeout(() => { if (!this.disposed) this.burst(home); }, k * 120);
      this.revealed++;
    }
    this.updateDeckGlow();
  }

  private resize(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.setLength(w < 560 ? 8.4 : 7.6);
    this.camera.updateProjectionMatrix();
  }

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    for (const p of this.pieces) {
      if (!p.falling) continue;
      const f = p.falling;
      if (f.delay > 0) {
        f.delay -= dt;
        p.mesh.position.x = p.home.x + Math.sin(t * 80) * 0.01;
        continue;
      }
      f.t += dt;
      f.v.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(f.v, dt);
      p.mesh.rotation.x += f.spin.x * dt;
      p.mesh.rotation.y += f.spin.y * dt;
      p.mesh.rotation.z += f.spin.z * dt;
      const floorY = 0.12;
      if (p.mesh.position.y < floorY && Math.hypot(p.mesh.position.x, p.mesh.position.z) > 0.75) {
        p.mesh.position.y = floorY;
        f.v.y *= -0.3;
        f.v.x *= 0.6;
        f.v.z *= 0.6;
        f.spin.multiplyScalar(0.6);
      }
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      if (f.t > 1.4) mat.opacity = Math.max(0, 1 - (f.t - 1.4) / 0.8);
      if (f.t > 2.2) {
        p.mesh.visible = false;
        p.falling = null;
      }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i]!;
      d.life -= dt * 0.7;
      const a = d.pts.geometry.attributes.position as THREE.BufferAttribute;
      for (const [j, v] of d.vel.entries()) {
        v.y -= 1.2 * dt;
        a.setXYZ(j, a.getX(j) + v.x * dt, a.getY(j) + v.y * dt, a.getZ(j) + v.z * dt);
      }
      a.needsUpdate = true;
      (d.pts.material as THREE.PointsMaterial).opacity = Math.max(0, d.life);
      if (d.life <= 0) {
        this.scene.remove(d.pts);
        d.pts.geometry.dispose();
        this.dust.splice(i, 1);
      }
    }
    // on-deck pieces pulse gently
    const pulse = 0.85 + 0.15 * Math.sin(t * 3);
    for (const i of this.order.slice(this.revealed, this.revealed + 5)) {
      const mat = this.pieces[i]!.mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity > 0) mat.emissiveIntensity = (0.05 + 0.35 * Math.min(1, this.weekPct / 0.75)) * pulse;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          m.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
}
