'use client';
// The real marble block: 875 fractured GLB chunks encasing the statue.
//
// Rendering strategy — reveal order is deterministic, so all chunks are
// merged into ONE geometry concatenated in that order. Revealed chunks are
// a contiguous prefix of the index buffer: hiding them is setDrawRange(),
// i.e. the whole rock stays ONE draw call no matter how much is carved away.
// A struck chunk is spawned as a temporary falling clone; the next few
// banked chunks get gold-glow clones. Total steady-state draws: ~1-6.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rngFor } from '../sculpture/rng';
import { buildStatue } from '../lib/three/statue';
import { marbleMaterial } from '../lib/three/materials';

const ROCK_URL = '/models/rock_875_v3.glb';
const ON_DECK = 5;

interface Piece {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  /** index-buffer offset of this piece inside the merged geometry */
  indexStart: number;
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

  const { mergedMesh, pieces, order, statue } = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = height / size.y;
    const center = box.getCenter(new THREE.Vector3());
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    root.updateMatrixWorld(true); // chunk matrixWorlds are now group-space

    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });

    const rng = rngFor(seed, 'rock-order');
    const pieces: Piece[] = meshes.map((mesh) => {
      const home = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      return { mesh, home, indexStart: 0 };
    });
    // bottom-first with jitter; the top-center band (the face) falls last
    const headY = height * 0.72;
    const order = pieces
      .map((p, i) => ({ i, key: p.home.y + (rng.next() - 0.5) * 0.5 + (p.home.y > headY && Math.hypot(p.home.x, p.home.z) < 0.5 ? 100 : 0) }))
      .sort((a, b) => a.key - b.key)
      .map((o) => o.i);

    // merge in reveal order → revealed chunks form a contiguous index prefix
    const rockMat = marbleMaterial([232, 228, 219], [168, 162, 152], 13, 0.5);
    const geos = order.map((pi) => {
      const g = pieces[pi]!.mesh.geometry.clone();
      g.applyMatrix4(pieces[pi]!.mesh.matrixWorld);
      return g;
    });
    const merged = mergeGeometries(geos, false)!;
    let cursor = 0;
    for (let k = 0; k < order.length; k++) {
      pieces[order[k]!]!.indexStart = cursor;
      cursor += geos[k]!.index!.count;
    }
    const mergedMesh = new THREE.Mesh(merged, rockMat);
    // No castShadow: a multi-million-tri mesh doubles its cost in the shadow
    // pass. FrontSide is safe — the pipeline recalcs face normals per chunk.
    mergedMesh.receiveShadow = true;

    const statue = withStatue ? buildStatue(marbleMaterial([238, 234, 226], [150, 146, 140], 11, 0.42)) : null;
    if (statue) {
      statue.scale.setScalar((height * 0.78) / 3.9);
      statue.position.y = height * 0.05;
      statue.visible = revealed > 0;
    }
    return { mergedMesh, pieces, order, statue };
  }, [scene, height, seed, withStatue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw only the unrevealed suffix of the index buffer.
  const applied = useRef<number | null>(null);
  const fallingRef = useRef<THREE.Group>(null);
  const falling = useRef<{ mesh: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; life: number }[]>([]);
  const fallRng = useRef(rngFor(seed, 'fall'));

  useEffect(() => {
    const geo = mergedMesh.geometry;
    const total = geo.index!.count;
    const clamp = Math.min(revealed, order.length);
    const start = clamp < order.length ? pieces[order[clamp]!]!.indexStart : total;
    if (applied.current !== null) {
      // a strike happened since last render — spawn the tumbling clones
      const r = fallRng.current;
      for (let k = Math.min(applied.current, order.length); k < clamp; k++) {
        const src = pieces[order[k]!]!.mesh;
        const clone = src.clone();
        src.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
        clone.material = mergedMesh.material;
        fallingRef.current?.add(clone);
        falling.current.push({
          mesh: clone,
          v: new THREE.Vector3((r.next() - 0.5) * 0.9, -0.6 - r.next() * 0.5, 0.4 + r.next() * 0.7),
          w: new THREE.Vector3(r.signed() * 4, r.signed() * 4, r.signed() * 4),
          life: 1.2 + r.next() * 0.3,
        });
      }
    }
    geo.setDrawRange(start, total - start);
    applied.current = revealed;
    if (statue) statue.visible = revealed > 0;
  }, [revealed, mergedMesh, pieces, order, statue]);

  // Banked pieces: the next few chunks get a glowing clone on top (slightly
  // inflated so it draws over the merged surface without z-fighting).
  const glowRef = useRef<THREE.Group>(null);
  useEffect(() => {
    const grp = glowRef.current;
    if (!grp) return;
    grp.clear();
    const glow = Math.min(ON_DECK, pending, order.length - revealed);
    for (let k = revealed; k < revealed + glow; k++) {
      const src = pieces[order[k]!]!.mesh;
      const c = src.clone();
      src.matrixWorld.decompose(c.position, c.quaternion, c.scale);
      const mat = (mergedMesh.material as THREE.MeshStandardMaterial).clone();
      mat.emissive = new THREE.Color(0xc9a227);
      mat.emissiveIntensity = 0.45;
      c.material = mat;
      c.scale.multiplyScalar(1.015);
      grp.add(c);
    }
  }, [revealed, pending, pieces, order, mergedMesh]);

  useFrame((_, dt) => {
    const list = falling.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]!;
      f.life -= dt;
      f.v.y -= 7 * dt;
      f.mesh.position.addScaledVector(f.v, dt);
      f.mesh.rotation.x += f.w.x * dt;
      f.mesh.rotation.y += f.w.y * dt;
      f.mesh.rotation.z += f.w.z * dt;
      if (f.life <= 0) {
        f.mesh.removeFromParent();
        list.splice(i, 1);
      }
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={mergedMesh} />
      {statue && <primitive object={statue} />}
      <group ref={fallingRef} />
      <group ref={glowRef} />
      {/* strike surface — an invisible proxy so clicks never raycast the
          800k-triangle merged mesh */}
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
