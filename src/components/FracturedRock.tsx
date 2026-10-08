'use client';
// The real marble block: 875 fractured GLB chunks encasing the statue,
// revealed bottom-first, the head region last. Banked pieces glow gold
// ("loaded"); a strike knocks the next chunk loose and it tumbles off.
// Used on /sculpture and inside the agora's self-development hall.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { rngFor } from '../sculpture/rng';
import { buildStatue } from '../lib/three/statue';
import { marbleMaterial } from '../lib/three/materials';

const ROCK_URL = '/models/rock_875.glb';
const ON_DECK = 5;

interface Piece {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  origMat: THREE.Material;
  falling: { v: THREE.Vector3; w: THREE.Vector3; life: number } | null;
}

export interface FracturedRockProps {
  /** World-space height of the rock (the statue fits inside). */
  height?: number;
  revealed: number;
  /** Banked pieces — the next min(5, pending) chunks glow. */
  pending?: number;
  /** Click/aim-click strikes one piece off. */
  onStrike?: () => void;
  withStatue?: boolean;
  seed?: number;
  position?: [number, number, number];
  rotationY?: number;
}

export function FracturedRock({
  height = 3.2, revealed, pending = 0, onStrike, withStatue = true, seed = 7,
  position = [0, 0, 0], rotationY = 0,
}: FracturedRockProps) {
  const { scene } = useGLTF(ROCK_URL);

  const { root, pieces, order, statue } = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = height / size.y;
    const center = box.getCenter(new THREE.Vector3());
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    root.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    // The GLB ships geometry-only — every chunk gets the white marble.
    // DoubleSide: a cut face with a flipped normal must never look like a hole.
    const rockMat = marbleMaterial([232, 228, 219], [168, 162, 152], 13, 0.5);
    rockMat.side = THREE.DoubleSide;
    for (const m of meshes) m.material = rockMat;
    const rng = rngFor(seed, 'rock-order');
    const pieces: Piece[] = meshes.map((mesh) => {
      const home = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      mesh.castShadow = mesh.receiveShadow = true;
      return { mesh, home, origMat: mesh.material as THREE.Material, falling: null };
    });
    // bottom-first with jitter; the top-center band (the face) falls last
    const headY = height * 0.72;
    const order = pieces
      .map((p, i) => ({ i, key: p.home.y + (rng.next() - 0.5) * 0.5 + (p.home.y > headY && Math.hypot(p.home.x, p.home.z) < 0.5 ? 100 : 0) }))
      .sort((a, b) => a.key - b.key)
      .map((o) => o.i);
    const statue = withStatue ? buildStatue(marbleMaterial([238, 234, 226], [150, 146, 140], 11, 0.42)) : null;
    if (statue) {
      statue.scale.setScalar((height * 0.78) / 3.9);
      statue.position.y = height * 0.05;
      statue.visible = revealed > 0;
    }
    return { root, pieces, order, statue };
  }, [scene, height, seed, withStatue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply initial reveal instantly; animate every later increase.
  const applied = useRef<number | null>(null);
  const fallRng = useRef(rngFor(seed, 'fall'));
  useEffect(() => {
    const from = applied.current;
    if (from === null) {
      for (let k = 0; k < Math.min(revealed, order.length); k++) pieces[order[k]!]!.mesh.visible = false;
      applied.current = revealed;
      if (statue) statue.visible = revealed > 0;
      return;
    }
    const r = fallRng.current;
    for (let k = from; k < Math.min(revealed, order.length); k++) {
      const p = pieces[order[k]!]!;
      p.falling = {
        v: new THREE.Vector3((r.next() - 0.5) * 0.9, -0.6 - r.next() * 0.5, 0.4 + r.next() * 0.7),
        w: new THREE.Vector3(r.signed() * 4, r.signed() * 4, r.signed() * 4),
        life: 1.2 + r.next() * 0.3,
      };
    }
    applied.current = revealed;
    if (statue && revealed > 0) statue.visible = true;
  }, [revealed, pieces, order, statue]);

  // Banked pieces: the next few chunks pulse gold.
  const deck = useRef<THREE.Mesh[]>([]);
  useEffect(() => {
    const restore = () => {
      for (const m of deck.current) m.material = (pieces.find((p) => p.mesh === m)?.origMat) ?? m.material;
      deck.current = [];
    };
    restore();
    const glow = Math.min(ON_DECK, pending, order.length - revealed);
    for (let k = revealed; k < revealed + glow; k++) {
      const p = pieces[order[k]!]!;
      const mat = p.origMat.clone() as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(0xc9a227);
      mat.emissiveIntensity = 0.3;
      p.mesh.material = mat;
      deck.current.push(p.mesh);
    }
    return restore;
  }, [revealed, pending, pieces, order]);

  useFrame((_, dt) => {
    for (const p of pieces) {
      const f = p.falling;
      if (!f) continue;
      f.life -= dt;
      f.v.y -= 7 * dt;
      p.mesh.position.addScaledVector(f.v, dt);
      p.mesh.rotation.x += f.w.x * dt;
      p.mesh.rotation.y += f.w.y * dt;
      p.mesh.rotation.z += f.w.z * dt;
      if (f.life <= 0) {
        p.mesh.visible = false;
        p.falling = null;
      }
    }
  });

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={onStrike ? (e) => { e.stopPropagation(); onStrike(); } : undefined}
    >
      <primitive object={root} />
      {statue && <primitive object={statue} />}
    </group>
  );
}

useGLTF.preload(ROCK_URL);
