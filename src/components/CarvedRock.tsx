'use client';
// The marble block as a shader carve on the ORIGINAL uploaded GLB — no
// fractured geometry. `revealed` indexes a deterministic field of 875
// seeded "bite" spheres (bottom-first, face-last); a 3D occupancy texture
// carries them to the fragment shader, which discards carved space, jitters
// the edge with noise, darkens the fresh rim, and shades backfaces as raw
// stone interior so holes read as carved thickness, not a hollow shell.
// Each strike also kicks a handful of instanced debris chips. One mesh,
// one draw call, and reload reconstructs everything from the count alone.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { rngFor } from '../sculpture/rng';
import { buildStatue } from '../lib/three/statue';
import { marbleMaterial } from '../lib/three/materials';

const ROCK_URL = '/models/rock_carve.glb';
const TOTAL = 875;
const OCC = 96;                 // occupancy texture resolution per axis
const ON_DECK = 5;              // pending glow markers
const DEBRIS_POOL = 48;         // instanced chips, recycled

interface Bite { pos: THREE.Vector3; r: number } // carve space: bbox-normalized [0,1]³

/** 875 seeded bite spheres on the rock's shell, ordered bottom-first. */
function makeBites(seed: number): Bite[] {
  const rng = rngFor(seed, 'bites');
  const bites: Bite[] = [];
  for (let i = 0; i < TOTAL; i++) {
    // random direction on the unit sphere, pushed onto the ellipsoid shell band
    const u = rng.next() * 2 - 1;
    const a = rng.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
    // depth spread 0.55–1.08: surface bites open craters, deeper bites open
    // as their neighbours erode — the carve tunnels inward toward the statue
    const rr = 0.55 + rng.next() * 0.53;
    const pos = new THREE.Vector3(0.5 + dir.x * 0.5 * rr, 0.5 + dir.y * 0.5 * rr, 0.5 + dir.z * 0.5 * rr);
    bites.push({ pos, r: 0.075 * (0.8 + rng.next() * 0.45) });
  }
  // bottom first with jitter; the top-center band (the face) is struck last.
  // shallow (outer-shell) bites sort earlier so early strikes are visible,
  // with a mild bias toward the -Z face — that's the side you approach from
  // in the hall, so the first strikes land where you can see them.
  const order = bites
    .map((b, i) => {
      const depth = Math.hypot(b.pos.x - 0.5, b.pos.y - 0.5, b.pos.z - 0.5);
      const faceish = b.pos.y > 0.72 && Math.hypot(b.pos.x - 0.5, b.pos.z - 0.5) < 0.28;
      return { i, key: b.pos.y + (rng.next() - 0.5) * 0.4 + depth * -0.35 + (0.5 - b.pos.z) * 0.22 + (faceish ? 100 : 0) };
    })
    .sort((a, b) => a.key - b.key);
  return order.map((o) => bites[o.i]!);
}

/** Bake bite k into the occupancy volume (increments only — voxels 0..255). */
function bakeBite(data: Uint8Array, bite: Bite) {
  const { pos, r } = bite;
  const w = r * 1.18; // soft rim: solid core, feathered edge band
  const x0 = Math.max(0, Math.floor((pos.x - w) * OCC));
  const x1 = Math.min(OCC - 1, Math.ceil((pos.x + w) * OCC));
  const y0 = Math.max(0, Math.floor((pos.y - w) * OCC));
  const y1 = Math.min(OCC - 1, Math.ceil((pos.y + w) * OCC));
  const z0 = Math.max(0, Math.floor((pos.z - w) * OCC));
  const z1 = Math.min(OCC - 1, Math.ceil((pos.z + w) * OCC));
  const inv = 1 / OCC;
  const c = new THREE.Vector3();
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    c.set((x + 0.5) * inv, (y + 0.5) * inv, (z + 0.5) * inv);
    const f = 1.18 - c.distanceTo(pos) / r; // 1 inside core, ~0 at feather edge
    if (f <= 0) continue;
    const idx = x + OCC * (y + OCC * z);
    const v = Math.min(255, Math.round(f * 255)); // Uint8Array wraps mod 256 — clamp!
    if (v > data[idx]!) data[idx] = v;
  }
}

export interface CarvedRockProps {
  /** World-space height of the rock. */
  height?: number;
  revealed: number;
  /** Banked pieces — next min(5, pending) bite spots pulse gold. */
  pending?: number;
  onStrike?: () => void;
  withStatue?: boolean;
  seed?: number;
  position?: [number, number, number];
  rotationY?: number;
}

export function CarvedRock({
  height = 3.2, revealed, pending = 0, onStrike, withStatue = true, seed = 7,
  position = [0, 0, 0], rotationY = 0,
}: CarvedRockProps) {
  const { scene } = useGLTF(ROCK_URL);

  // ---------- geometry + occupancy texture + materials (once per mount) ----------
  const built = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());

    // bake node transforms into the geometry, then normalize so the rock's
    // local space IS carve space: bbox [0,1]³, base sitting at y=0
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const src = meshes[0];
    if (!src) return null;
    const geo = src.geometry.clone();
    src.updateWorldMatrix(true, false);
    geo.applyMatrix4(src.matrixWorld);
    const gbox = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const gsize = gbox.getSize(new THREE.Vector3());
    geo.translate(-gbox.min.x, -gbox.min.y, -gbox.min.z);
    geo.scale(1 / gsize.x, 1 / gsize.y, 1 / gsize.z);

    // occupancy texture: 0 = solid stone, 255 = carved away
    const occData = new Uint8Array(OCC * OCC * OCC);
    const occ = new THREE.Data3DTexture(occData, OCC, OCC, OCC);
    occ.format = THREE.RedFormat;
    occ.type = THREE.UnsignedByteType;
    occ.minFilter = occ.magFilter = THREE.LinearFilter;
    occ.unpackAlignment = 1;
    occ.needsUpdate = true;

    // patch the rock's own material — keep its textures and PBR lighting
    const srcMat = (Array.isArray(src.material) ? src.material[0] : src.material) as THREE.MeshStandardMaterial;
    const mat = (srcMat ?? marbleMaterial([232, 228, 219], [168, 162, 152], 13, 0.5)).clone() as THREE.MeshStandardMaterial;
    mat.side = THREE.DoubleSide;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOcc = { value: occ };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCarve;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarve = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vCarve;
          uniform sampler3D uOcc;
          float cHash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
          float cNoise(vec3 p){
            vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            float a=cHash(i),b=cHash(i+vec3(1,0,0)),c=cHash(i+vec3(0,1,0)),d=cHash(i+vec3(1,1,0));
            float e=cHash(i+vec3(0,0,1)),g=cHash(i+vec3(1,0,1)),h=cHash(i+vec3(0,1,1)),k=cHash(i+vec3(1,1,1));
            return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);
          }`)
        .replace('#include <map_fragment>', `
          float cField = texture(uOcc, vCarve).r;
          cField += (cNoise(vCarve * 90.0) - 0.5) * 0.34;      // jagged break edge
          float cRim = smoothstep(0.34, 0.5, cField);
          if (cField > 0.5) discard;
          #include <map_fragment>
          if (!gl_FrontFacing) {
            // inside the cut — raw stone, darker and flatter than the skin
            diffuseColor.rgb = diffuseColor.rgb * vec3(0.42, 0.4, 0.38) + vec3(0.10, 0.095, 0.09);
          } else {
            diffuseColor.rgb *= 1.0 - 0.35 * cRim;             // fresh-cut rim darkening
          }`);
    };
    mat.customProgramCacheKey = () => 'carved-rock';

    const rock = new THREE.Mesh(geo, mat);
    rock.receiveShadow = true;
    const s = height / 1.0; // carve space is already 0..1 — scale it to world height
    rock.scale.setScalar(s);

    const bites = makeBites(seed);

    const statue = withStatue ? buildStatue(marbleMaterial([238, 234, 226], [150, 146, 140], 11, 0.42)) : null;
    if (statue) {
      statue.scale.setScalar((height * 0.68) / 3.9);
      statue.position.y = height * 0.06;
      statue.visible = revealed > 0;
    }

    return { rock, occ, occData, bites, statue };
  }, [scene, height, seed, withStatue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- carve state → occupancy texture (incremental) ----------
  const applied = useRef(0);
  useEffect(() => {
    if (!built) return;
    const { occData, occ, bites, statue } = built;
    const clamp = Math.min(revealed, TOTAL);
    for (let k = applied.current; k < clamp; k++) bakeBite(occData, bites[k]!);
    applied.current = clamp;
    occ.needsUpdate = true;
    built.rock.visible = clamp < TOTAL;
    if (statue) statue.visible = clamp > 0;
  }, [revealed, built]);

  // ---------- debris: instanced chips, recycled ----------
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const debris = useRef<{ pos: THREE.Vector3; v: THREE.Vector3; axis: THREE.Vector3; spin: number; life: number; size: number }[]>([]);
  const debrisMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd9d4cb, roughness: 0.85 }), []);
  const spawn = (at: THREE.Vector3) => {
    const rng = rngFor(seed * 1009 + applied.current, 'debris');
    for (let i = 0; i < 7; i++) {
      if (debris.current.length >= DEBRIS_POOL) debris.current.shift();
      const dir = new THREE.Vector3(at.x - 0.5, 0, at.z - 0.5).normalize();
      debris.current.push({
        pos: at.clone().multiplyScalar(height),
        v: new THREE.Vector3(dir.x * (0.5 + rng.next()), -0.3 - rng.next() * 0.4, dir.z * (0.5 + rng.next())).multiplyScalar(height * 0.45),
        axis: new THREE.Vector3(rng.signed(), rng.signed(), rng.signed()).normalize(),
        spin: rng.signed() * 9,
        life: 1.0 + rng.next() * 0.35,
        size: height * (0.012 + rng.next() * 0.02),
      });
    }
  };
  const prevRevealed = useRef(revealed);
  useEffect(() => {
    // only animate strikes that happened while mounted — not the replay bake
    if (prevRevealed.current !== null && revealed > prevRevealed.current && built) {
      for (let k = prevRevealed.current; k < Math.min(revealed, TOTAL); k++) spawn(built.bites[k]!.pos);
    }
    prevRevealed.current = revealed;
  }, [revealed, built]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- on-deck glow: pulse where the next strikes will land ----------
  const glowRef = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!built) return;
    // glow markers
    const grp = glowRef.current;
    if (grp) {
      const t = clock.elapsedTime;
      for (let i = 0; i < grp.children.length; i++) {
        const m = grp.children[i] as THREE.Mesh;
        m.scale.setScalar((m.userData.base as number) * (1 + 0.18 * Math.sin(t * 3.2 + i * 1.7)));
      }
    }
    // debris physics
    const inst = debrisRef.current;
    if (!inst) return;
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const list = debris.current;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]!;
      d.life -= dt;
      if (d.life <= 0) { list.splice(i, 1); continue; }
      d.v.y -= 7 * dt;
      d.pos.addScaledVector(d.v, dt);
      q.setFromAxisAngle(d.axis, d.spin * (1.2 - d.life));
      M.compose(d.pos, q, new THREE.Vector3(d.size, d.size, d.size));
      inst.setMatrixAt(n++, M);
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
  });

  // place glow markers for the next ON_DECK bites
  const glowGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.85 }), []);
  useEffect(() => {
    const grp = glowRef.current;
    if (!grp || !built) return;
    grp.clear();
    const glow = Math.min(ON_DECK, pending, TOTAL - revealed);
    for (let k = revealed; k < revealed + glow; k++) {
      const b = built.bites[k]!;
      const m = new THREE.Mesh(glowGeo, glowMat);
      m.userData.base = height * 0.02;
      m.scale.setScalar(height * 0.02);
      m.position.set(b.pos.x * height, b.pos.y * height, b.pos.z * height);
      grp.add(m);
    }
  }, [revealed, pending, built, height, glowGeo, glowMat]);

  if (!built) return null;
  const { rock, statue } = built;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* carve space is 0..1 scaled to `height` — shift so the rock is
          centered on x/z; debris + glow share the same frame */}
      <group position={[-height * 0.5, 0, -height * 0.5]}>
        <primitive object={rock} />
        <instancedMesh ref={debrisRef} args={[undefined, undefined, DEBRIS_POOL]} material={debrisMat} frustumCulled={false}>
          <tetrahedronGeometry args={[1, 0]} />
        </instancedMesh>
        <group ref={glowRef} />
      </group>
      {statue && <primitive object={statue} />}
      {/* strike surface — invisible proxy so clicks never raycast the rock */}
      {onStrike && (
        <mesh position={[0, height / 2, 0]} onClick={(e) => { e.stopPropagation(); onStrike(); }}>
          <cylinderGeometry args={[height * 0.3, height * 0.36, height, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
    </group>
  );
}

useGLTF.preload(ROCK_URL);
