'use client';
// The agora itself: plaza floor, perimeter colonnade, temples, braziers,
// statue centerpiece — and the vista: a mountain plateau falling into a
// valley, ridges on the horizon, the sea to the south. Vista is visual
// only; the plaza walls contain the player.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { buildStatue } from '../../lib/three/statue';
import { mulberry32 } from '../../sculpture/rng';
import { Column, Brazier, Temple } from './structures';
import type { DoorDestination } from './types';

const HALF = 30; // plaza half-size

/** Landscape height field: flat under the courtyard, falling to a valley,
 *  rising to mountain ridges at the horizon; the sea claims the south. */
function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 34) return -0.35;
  const t = Math.min(1, (r - 34) / 150);
  const s = t * t * (3 - 2 * t);
  let h = -0.35 - 38 * s; // plateau edge → valley floor ≈ -38
  h += (Math.sin(x * 0.011) * Math.cos(z * 0.013) * 7
      + Math.sin(x * 0.031 + 1.7) * Math.cos(z * 0.027 + 0.4) * 3) * s;
  const m = Math.max(0, (r - 420) / 650);
  const ridge = Math.sin(x * 0.006 + z * 0.002) * 0.5
              + Math.sin(z * 0.005 - x * 0.003 + 1.3) * 0.5;
  h += m * m * (100 + 80 * ridge);
  if (z > 480) h = Math.min(h, -26); // coastline
  return h;
}

function useTerrain() {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(2400, 2400, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const olive = new THREE.Color(0x46513a);
    const scrub = new THREE.Color(0x5d5639);
    const rock = new THREE.Color(0x6b6670);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);
      c.copy(olive).lerp(scrub, Math.min(1, Math.abs(y + 10) / 45));
      if (y > 40) c.lerp(rock, Math.min(1, (y - 40) / 80));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
}

const TREE_GEO = {
  cypress: () => new THREE.ConeGeometry(1.6, 8, 7),
  olive: () => new THREE.IcosahedronGeometry(2.4, 1),
} as const;

function Trees({ kind, count }: { kind: 'cypress' | 'olive'; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => TREE_GEO[kind](), [kind]);
  const spots = useMemo(() => {
    const r = mulberry32(kind === 'cypress' ? 99 : 141);
    const out: { x: number; y: number; z: number; h: number; s: number }[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 8) {
      const a = r.next() * Math.PI * 2;
      const rad = 48 + Math.pow(r.next(), 1.4) * 620;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = terrainHeight(x, z);
      if (y < -24 || y > 55) continue; // not in the sea, below the treeline
      out.push({ x, y, z, h: r.range(6, 13), s: r.range(0.7, 1.5) });
    }
    return out;
  }, [count, kind]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    spots.forEach((t, i) => {
      p.set(t.x, t.y + t.h / 2, t.z);
      s.set(t.s, t.h / 8, t.s);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, spots.length]} castShadow={false}>
      <meshStandardMaterial color={kind === 'cypress' ? 0x1c3120 : 0x4a5c38} roughness={1} />
    </instancedMesh>
  );
}

export function Courtyard({ destinations, onDoorChange }: {
  destinations: DoorDestination[];
  onDoorChange: (d: DoorDestination | null) => void;
}) {
  const marble = useMemo(() => {
    const m = marbleMaterial([222, 215, 200], [146, 138, 126], 7, 0.55);
    if (m.map) { m.map.repeat.set(9, 9); }
    return m;
  }, []);
  const marbleTrim = useMemo(() => marbleMaterial([198, 190, 172], [126, 118, 106], 13, 0.62), []);
  const statue = useMemo(() => buildStatue(marbleMaterial([238, 234, 226], [150, 146, 140], 11, 0.42)), []);
  const terrain = useTerrain();

  // temple placements: north / east / west, facing the plaza center
  const placements: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [0, 0, -21], rotY: Math.PI },       // faces +z
    { pos: [23, 0, 0], rotY: -Math.PI / 2 },   // faces -x
    { pos: [-23, 0, 0], rotY: Math.PI / 2 },   // faces +x
  ];

  const colMat = marbleTrim;
  return (
    <group>
      {/* plaza floor + apron */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[90, 0.5, 90]} position={[0, -0.5, 0]} />
      </RigidBody>
      <mesh material={marble} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
      </mesh>
      {/* the vista: mountain terrain, the sea to the south, tree fields */}
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -25.6, 850]}>
        <planeGeometry args={[2400, 1100]} />
        <meshStandardMaterial color={0x4a7ba6} roughness={0.1} metalness={0.4} />
      </mesh>
      <Trees kind="cypress" count={520} />
      <Trees kind="olive" count={340} />
      <Clouds />
      {/* inlay ring around the statue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[4.4, 4.9, 64]} />
        <meshStandardMaterial color={0x8a6a2f} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* central statue on a grand plinth */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.9, 0.6, 1.5]} position={[0, 0.6, 0]} />
        <CuboidCollider args={[1.3, 2.4, 1.1]} position={[0, 2.9, 0]} />
      </RigidBody>
      <mesh material={marbleTrim} position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.7, 2.8]} />
      </mesh>
      <mesh material={marbleTrim} position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.6, 2.2]} />
      </mesh>
      <group position={[0, 0.8, 0]} scale={[1.15, 1.15, 1.15]}>{/* statue feet sit ~0.5 above its own origin */}
        <primitive object={statue} position={[0, 0, 0]} />
      </group>

      {/* temples */}
      {destinations.map((d, i) => (
        <Temple key={d.slug} destination={d} position={placements[i]!.pos} rotationY={placements[i]!.rotY} onDoorChange={onDoorChange} />
      ))}

      {/* perimeter colonnade — behind the temples and along the south edge */}
      {Array.from({ length: 9 }, (_, i) => -26 + i * 6.5).flatMap(v => [
        <Column key={`e${v}`} position={[HALF - 1.5, 0, v]} height={5} radius={0.36} material={colMat} />,
        <Column key={`w${v}`} position={[-(HALF - 1.5), 0, v]} height={5} radius={0.36} material={colMat} />,
      ])}
      {Array.from({ length: 9 }, (_, i) => -26 + i * 6.5).flatMap(v => [
        <Column key={`n${v}`} position={[v, 0, -(HALF - 1.5)]} height={5} radius={0.36} material={colMat} />,
        <Column key={`s${v}`} position={[v, 0, HALF - 1.5]} height={5} radius={0.36} material={colMat} />,
      ])}
      {/* entablature beams over the colonnade */}
      {[[0, -(HALF - 1.5), 0], [0, HALF - 1.5, 0]].map(([x, z]) => (
        <mesh key={`beam-z${z}`} material={marbleTrim} position={[x!, 5.35, z!]} castShadow>
          <boxGeometry args={[HALF * 2 - 2, 0.5, 1.0]} />
        </mesh>
      ))}
      {[[-(HALF - 1.5), 0], [HALF - 1.5, 0]].map(([x]) => (
        <mesh key={`beam-x${x}`} material={marbleTrim} position={[x!, 5.35, 0]} castShadow>
          <boxGeometry args={[1.0, 0.5, HALF * 2 - 2]} />
        </mesh>
      ))}

      {/* boundary walls (invisible) + low parapet (visual) */}
      <RigidBody type="fixed" colliders={false}>
        {[[0, -HALF], [0, HALF]].map(([x, z]) => (
          <CuboidCollider key={`w${z}`} args={[HALF + 2, 4, 0.4]} position={[x!, 4, z!]} />
        ))}
        {[[-HALF, 0], [HALF, 0]].map(([x]) => (
          <CuboidCollider key={`w${x}`} args={[0.4, 4, HALF + 2]} position={[x!, 4, 0]} />
        ))}
      </RigidBody>
      {[[0, -HALF, 0], [0, HALF, 0]].map(([x, z]) => (
        <mesh key={`p${z}`} material={marbleTrim} position={[x!, 0.55, z!]} receiveShadow castShadow>
          <boxGeometry args={[HALF * 2 + 1.6, 1.1, 0.6]} />
        </mesh>
      ))}
      {[[-HALF, 0], [HALF, 0]].map(([x]) => (
        <mesh key={`p${x}`} material={marbleTrim} position={[x!, 0.55, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.6, 1.1, HALF * 2 + 1.6]} />
        </mesh>
      ))}

      {/* braziers flanking each temple front + the south gate */}
      {placements.flatMap(({ pos, rotY }, i) => {
        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        return [-1, 1].map(s => {
          const p = new THREE.Vector3(pos[0], 0, pos[2])
            .add(fwd.clone().multiplyScalar(10.5))
            .add(side.clone().multiplyScalar(s * 4.4));
          return <Brazier key={`b${i}${s}`} position={[p.x, 0, p.z]} />;
        });
      })}
      <Brazier position={[-3.4, 0, 27]} />
      <Brazier position={[3.4, 0, 27]} />

      {/* a distant sanctuary on a far ridge — pure silhouette */}
      <DistantShrine />
    </group>
  );
}

/** Stylized flat-bottom cumulus, painted once on canvas and billboarded. */
function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  const lobes: [number, number, number, number][] = [
    [58, 92, 30, 18], [95, 74, 40, 26], [140, 62, 46, 32], [185, 78, 34, 22], [215, 92, 22, 15],
  ];
  for (const [x, y, rx, ry] of lobes) {
    const grad = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry) * 1.05);
    grad.addColorStop(0, 'rgba(255,253,250,0.98)');
    grad.addColorStop(0.72, 'rgba(255,250,245,0.85)');
    grad.addColorStop(1, 'rgba(255,248,242,0)');
    g.fillStyle = grad;
    g.save();
    g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.beginPath(); g.arc(x, y, Math.max(rx, ry) * 1.05, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // flat-bottom shading band — the classic cumulus underside
  const shade = g.createLinearGradient(0, 78, 0, 116);
  shade.addColorStop(0, 'rgba(148,168,196,0)');
  shade.addColorStop(0.8, 'rgba(148,168,196,0.4)');
  shade.addColorStop(1, 'rgba(148,168,196,0)');
  g.fillStyle = shade;
  g.fillRect(0, 78, 256, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Clouds() {
  const tex = useMemo(cloudTexture, []);
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = mulberry32(55);
    return Array.from({ length: 20 }, () => ({
      x: r.range(-1200, 1200),
      y: r.range(120, 300),
      z: r.range(-1200, 1200),
      s: r.range(110, 300),
      v: r.range(1.5, 4), // drift speed
    }));
  }, []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    for (const child of g.children) {
      child.position.x += (child.userData.v as number) * dt;
      if (child.position.x > 1400) child.position.x = -1400;
    }
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.45, 1]} userData={{ v: c.v }}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.95} />
        </sprite>
      ))}
    </group>
  );
}

function DistantShrine() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: false });
    g.translate(0, 0, -3);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 1 }), []);
  const spot = { x: 430, z: -480 };
  const y = terrainHeight(spot.x, spot.z);
  return (
    <group position={[spot.x, y, spot.z]} rotation={[0, -0.4, 0]}>
      <mesh material={mat} position={[0, 4, 0]}>
        <boxGeometry args={[16, 8, 10]} />
      </mesh>
      {[-7, -4.2, -1.4, 1.4, 4.2, 7].map(x => (
        <mesh key={x} material={mat} position={[x, 3.5, -6]}>
          <cylinderGeometry args={[0.5, 0.55, 7, 8]} />
        </mesh>
      ))}
      <mesh geometry={geo} material={mat} position={[0, 8, -6]} scale={[8.5, 3.5, 1]} />
    </group>
  );
}
