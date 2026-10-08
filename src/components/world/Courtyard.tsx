'use client';
// The agora itself: plaza floor, perimeter colonnade, temples, braziers,
// statue centerpiece — and the vista: a mountain plateau falling into a
// valley, ridges on the horizon, the sea to the south. Vista is visual
// only; the plaza walls contain the player.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial, pavingMaterial } from '../../lib/three/materials';
import { GlbStatue } from './GlbStatue';
import { mulberry32 } from '../../sculpture/rng';
import { Column, Brazier, Temple, NorthGate } from './structures';
import type { DoorDestination, QuestTarget } from './types';

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

/** A copse of trees painted on canvas — cypress spikes or leafy canopy —
 *  billbboarded on the far slopes so the forest reads real at distance. */
function treeClusterTexture(kind: 'cypress' | 'leafy' | 'pine' | 'fir' | 'palm', seed: number): THREE.CanvasTexture {
  const r = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const BASE = 235;
  const trees = 4 + Math.floor(r.next() * 4);
  const trunks: { x: number; h: number; w: number }[] = [];
  for (let i = 0; i < trees; i++) {
    trunks.push({ x: 30 + r.next() * 196, h: r.range(90, 210), w: r.range(10, 20) });
  }
  trunks.sort((a, b) => b.h - a.h); // paint tall back-to-front
  for (const t of trunks) {
    const top = BASE - t.h;
    if (kind === 'cypress') {
      // tapered flame shape, darker base, sun-kissed left edge
      const grad = g.createLinearGradient(t.x - t.w, BASE, t.x + t.w, top);
      grad.addColorStop(0, '#2c4a2e');
      grad.addColorStop(0.55, '#1e3521');
      grad.addColorStop(1, '#152718');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(t.x - t.w * 0.4, BASE);
      g.quadraticCurveTo(t.x - t.w, BASE - t.h * 0.45, t.x - t.w * 0.28, top + 18);
      g.quadraticCurveTo(t.x - t.w * 0.1, top, t.x, top);
      g.quadraticCurveTo(t.x + t.w * 0.1, top, t.x + t.w * 0.28, top + 18);
      g.quadraticCurveTo(t.x + t.w, BASE - t.h * 0.45, t.x + t.w * 0.4, BASE);
      g.closePath();
      g.fill();
      // rim light on the sun side
      g.strokeStyle = 'rgba(180,200,140,0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(t.x - t.w * 0.28, top + 18);
      g.quadraticCurveTo(t.x - t.w, BASE - t.h * 0.45, t.x - t.w * 0.4, BASE);
      g.stroke();
    } else if (kind === 'pine') {
      // umbrella stone pine: tall bare trunk, wide flat canopy
      const canopyY = BASE - t.h * 0.62;
      g.strokeStyle = '#4a3524';
      g.lineWidth = Math.max(2.5, t.w * 0.22);
      g.beginPath();
      g.moveTo(t.x, BASE);
      g.quadraticCurveTo(t.x + t.w * 0.3, (BASE + canopyY) / 2, t.x + r.range(-4, 4), canopyY);
      g.stroke();
      const crx = t.w * 3.4, cry = t.h * 0.15;
      for (let j = 0; j < 16; j++) {
        const a = r.next() * Math.PI * 2;
        const cx = t.x + Math.cos(a) * crx * r.next();
        const cy = canopyY - cry * 0.5 + Math.sin(a) * cry * r.next();
        const cr = r.range(8, 18);
        const lit = cy < canopyY - cry * 0.4;
        g.fillStyle = lit
          ? `rgba(${72 + r.int(0, 18)},${96 + r.int(0, 18)},${48 + r.int(0, 12)},0.95)`
          : `rgba(${30 + r.int(0, 12)},${48 + r.int(0, 12)},${26 + r.int(0, 8)},0.95)`;
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
      }
    } else if (kind === 'palm') {
      // palm: leaning trunk + drooping fronds fanning from the crown
      const lean = r.signed() * 26;
      const crownX = t.x + lean;
      const crownY = BASE - t.h;
      g.strokeStyle = '#5c4530';
      g.lineWidth = Math.max(3, t.w * 0.24);
      g.beginPath();
      g.moveTo(t.x, BASE);
      g.quadraticCurveTo(t.x + lean * 0.3, BASE - t.h * 0.55, crownX, crownY);
      g.stroke();
      const fronds = 8 + Math.floor(r.next() * 3);
      for (let j = 0; j < fronds; j++) {
        const fa = Math.PI * (1.05 + (j / (fronds - 1)) * 0.9); // fan left→right over the top
        const fl = t.h * r.range(0.28, 0.4);
        const dx = Math.cos(fa), dy = Math.sin(fa);
        g.strokeStyle = `rgba(${36 + r.int(0, 16)},${84 + r.int(0, 20)},${44 + r.int(0, 14)},0.95)`;
        g.lineWidth = r.range(2.5, 4.5);
        g.beginPath();
        g.moveTo(crownX, crownY);
        g.quadraticCurveTo(
          crownX + dx * fl * 0.7, crownY + dy * fl * 0.35 - fl * 0.25,
          crownX + dx * fl, crownY + dy * fl * 0.4 + fl * 0.35,
        );
        g.stroke();
      }
    } else if (kind === 'fir') {
      // tiered conifer: scalloped layers narrowing to a point
      const layers = 7;
      for (let j = 0; j < layers; j++) {
        const f = j / (layers - 1);
        const ly = BASE - t.h * 0.12 - f * t.h * 0.85;
        const lw = t.w * 2.6 * (1 - f * 0.8);
        g.fillStyle = `rgba(${26 + r.int(0, 10)},${44 + r.int(0, 12)},${40 + r.int(0, 10)},0.95)`;
        g.beginPath();
        g.moveTo(t.x - lw, ly + 10);
        g.quadraticCurveTo(t.x, ly - 14, t.x + lw, ly + 10);
        g.quadraticCurveTo(t.x + lw * 0.4, ly + 16, t.x, ly + 14);
        g.quadraticCurveTo(t.x - lw * 0.4, ly + 16, t.x - lw, ly + 10);
        g.fill();
      }
    } else {
      // trunk
      g.strokeStyle = '#3a2e20';
      g.lineWidth = Math.max(2, t.w * 0.18);
      g.beginPath(); g.moveTo(t.x, BASE); g.lineTo(t.x + r.range(-3, 3), top + t.h * 0.3); g.stroke();
      // canopy: clustered blobs, shaded underneath, lit on top
      for (let j = 0; j < 14; j++) {
        const a = r.next() * Math.PI * 2;
        const rad = r.next() * t.w * 1.9;
        const cx = t.x + Math.cos(a) * rad;
        const cy = top + t.h * 0.18 + Math.sin(a) * rad * 0.62 + r.range(-6, 6);
        const cr = r.range(9, 20);
        const lit = cy < top + t.h * 0.22;
        g.fillStyle = lit
          ? `rgba(${86 + r.int(0, 20)},${110 + r.int(0, 20)},${52 + r.int(0, 14)},0.95)`
          : `rgba(${38 + r.int(0, 14)},${58 + r.int(0, 14)},${30 + r.int(0, 10)},0.95)`;
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Forest({ kind, count, seed, maxY = 62, coastal = false }: {
  kind: 'cypress' | 'leafy' | 'pine' | 'fir' | 'palm';
  count: number;
  seed: number;
  maxY?: number;
  coastal?: boolean;
}) {
  const texA = useMemo(() => treeClusterTexture(kind, seed), [kind, seed]);
  const texB = useMemo(() => treeClusterTexture(kind, seed + 1000), [kind, seed]);
  const spots = useMemo(() => {
    const r = mulberry32(seed + 7);
    const out: { x: number; y: number; z: number; s: number; v: number }[] = [];
    // groves: pick grove centers on the slopes, then pack trees around them —
    // real hillsides are patchy, not evenly sprinkled
    const GOLDEN = 2.39996; // golden-angle spread → even cover all the way around
    let guard = 0;
    while (out.length < count && guard++ < 400) {
      const ga = (guard * GOLDEN) % (Math.PI * 2);
      const grad = 240 + Math.pow(r.next(), 1.3) * 500;
      const gx = Math.cos(ga) * grad;
      const gz = Math.sin(ga) * grad;
      const gy = terrainHeight(gx, gz);
      if (gy < -22 || gy > maxY) continue;
      if (coastal && gz < 140) continue; // palms hug the southern shore
      const size = 4 + Math.floor(r.next() * 8);
      for (let i = 0; i < size && out.length < count; i++) {
        const x = gx + r.signed() * 26;
        const z = gz + r.signed() * 26;
        const y = terrainHeight(x, z);
        if (y < -22 || y > maxY + 8) continue;
        out.push({ x, y, z, s: r.range(22, 48), v: r.next() < 0.5 ? 0 : 1 });
      }
    }
    return out;
  }, [count, seed, maxY]);
  return (
    <group>
      {spots.map((t, i) => (
        <sprite key={i} position={[t.x, t.y + t.s / 2, t.z]} scale={[t.s, t.s, 1]}>
          <spriteMaterial map={t.v ? texA : texB} alphaTest={0.12} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

export function Courtyard({ destinations, onDoorChange, onQuest, boardVersion }: {
  destinations: DoorDestination[];
  onDoorChange: (d: DoorDestination | null) => void;
  onQuest: (q: QuestTarget) => void;
  boardVersion: number;
}) {
  const marble = useMemo(() => {
    // worn paving slabs — ~2m slabs across the 60m plaza
    const m = pavingMaterial(7, 5);
    for (const t of [m.map, m.bumpMap, m.roughnessMap]) t?.repeat.set(6, 6);
    return m;
  }, []);
  const marbleTrim = useMemo(() => marbleMaterial([198, 190, 172], [126, 118, 106], 13, 0.62), []);
  const terrain = useTerrain();

  // Temples flank the plaza: two on the west (left walking in), two on the east.
  // The gate at the north end stands where the old north temple was.
  const placements: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [-23, 0, 11], rotY: -Math.PI / 2 },  // left, near the entry — door faces +x
    { pos: [-23, 0, -11], rotY: -Math.PI / 2 }, // left, by the gate — door faces +x
    { pos: [23, 0, -11], rotY: Math.PI / 2 },   // right, by the gate — door faces -x
    { pos: [23, 0, 11], rotY: Math.PI / 2 },    // right, near the entry — door faces -x
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
      <Forest kind="cypress" count={160} seed={31} maxY={62} />
      <Forest kind="leafy" count={240} seed={77} maxY={55} />
      <Forest kind="pine" count={130} seed={113} maxY={58} />
      <Forest kind="fir" count={170} seed={149} maxY={105} />
      <Forest kind="palm" count={110} seed={199} maxY={28} coastal />
      <Clouds />
      {/* inlay ring around the statue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[4.4, 4.9, 64]} />
        <meshStandardMaterial color={0x8a6a2f} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* central statue on a grand plinth */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 2.9, 1.3]} position={[0, 2.9, 0]} />
      </RigidBody>
      <GlbStatue position={[0, 0, 0]} />

      {/* temples */}
      {destinations.slice(0, placements.length).map((d, i) => (
        <Temple key={d.slug} destination={d} position={placements[i]!.pos} rotationY={placements[i]!.rotY}
          onDoorChange={onDoorChange} onQuest={onQuest} boardVersion={boardVersion} />
      ))}
      {/* the gate — monumental entry at the plaza's north end */}
      <NorthGate />

      {/* perimeter colonnade — skipping spots that would land inside a temple
          or the gate (a column inside the hall stood in front of the frieze) */}
      {(() => {
        // world-space AABB of each placed temple (W=12, D=13 + krepis/skirt)
        const boxes = destinations.slice(0, placements.length).map((_, i) => {
          const { pos, rotY } = placements[i]!;
          const side = Math.abs(Math.abs(rotY) - Math.PI / 2) < 0.1; // rotated onto the flanks
          const hx = side ? 8.2 : 7.6;
          const hz = side ? 7.6 : 8.2;
          return { x0: pos[0] - hx, x1: pos[0] + hx, z0: pos[2] - hz, z1: pos[2] + hz };
        });
        // the gate's footprint at the north end (W=20, D=13 at z=-23 + stairs)
        boxes.push({ x0: -11, x1: 11, z0: -29.6, z1: -12 });
        const clear = (x: number, z: number) => !boxes.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
        return Array.from({ length: 9 }, (_, i) => -26 + i * 6.5).flatMap(v => [
          clear(HALF - 1.5, v) ? <Column key={`e${v}`} position={[HALF - 1.5, 0, v]} height={7.2} radius={0.55} material={colMat} base /> : null,
          clear(-(HALF - 1.5), v) ? <Column key={`w${v}`} position={[-(HALF - 1.5), 0, v]} height={7.2} radius={0.55} material={colMat} base /> : null,
          clear(v, -(HALF - 1.5)) ? <Column key={`n${v}`} position={[v, 0, -(HALF - 1.5)]} height={7.2} radius={0.55} material={colMat} base /> : null,
          clear(v, HALF - 1.5) ? <Column key={`s${v}`} position={[v, 0, HALF - 1.5]} height={7.2} radius={0.55} material={colMat} base /> : null,
        ]);
      })()}
      {/* entablature: architrave band + overhanging cornice — the north band
          splits around the gate (|x| < ~10.5 is the gate's footprint) */}
      {[
        { x: 0, z: HALF - 1.5, w: HALF * 2 - 2 },       // south band
        { x: -20.3, z: -(HALF - 1.5), w: 19.4 },        // north band, west of the gate
        { x: 20.3, z: -(HALF - 1.5), w: 19.4 },         // north band, east of the gate
      ].map(({ x, z, w }) => (
        <group key={`ent-${z}-${x}`}>
          <mesh material={marbleTrim} position={[x, 7.95, z]} castShadow>
            <boxGeometry args={[w, 0.6, 1.3]} />
          </mesh>
          <mesh material={marbleTrim} position={[x, 8.4, z]} castShadow>
            <boxGeometry args={[w + 1, 0.28, 1.7]} />
          </mesh>
        </group>
      ))}
      {[[-(HALF - 1.5), 0], [HALF - 1.5, 0]].map(([x]) => (
        <group key={`ent-x${x}`}>
          <mesh material={marbleTrim} position={[x!, 7.95, 0]} castShadow>
            <boxGeometry args={[1.3, 0.6, HALF * 2 - 2]} />
          </mesh>
          <mesh material={marbleTrim} position={[x!, 8.4, 0]} castShadow>
            <boxGeometry args={[1.7, 0.28, HALF * 2 - 1]} />
          </mesh>
        </group>
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
        <group key={`p${z}`}>
          <mesh material={marbleTrim} position={[x!, 0.68, z!]} receiveShadow castShadow>
            <boxGeometry args={[HALF * 2 + 1.6, 1.35, 0.9]} />
          </mesh>
          <mesh material={marbleTrim} position={[x!, 1.5, z!]} receiveShadow castShadow>
            <boxGeometry args={[HALF * 2 + 2.0, 0.3, 1.15]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => -22.75 + i * 6.5).map(v => (
            <group key={`pr${v}`}>
              <mesh material={marbleTrim} position={[v, 1.0, z!]} castShadow receiveShadow>
                <boxGeometry args={[1.15, 2.0, 1.3]} />
              </mesh>
              <mesh material={marbleTrim} position={[v, 2.15, z!]} castShadow>
                <boxGeometry args={[1.45, 0.3, 1.6]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {[[-HALF, 0], [HALF, 0]].map(([x]) => (
        <group key={`p${x}`}>
          <mesh material={marbleTrim} position={[x!, 0.68, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.9, 1.35, HALF * 2 + 1.6]} />
          </mesh>
          <mesh material={marbleTrim} position={[x!, 1.5, 0]} receiveShadow castShadow>
            <boxGeometry args={[1.15, 0.3, HALF * 2 + 2.0]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => -22.75 + i * 6.5).map(v => (
            <group key={`pr${v}`}>
              <mesh material={marbleTrim} position={[x!, 1.0, v]} castShadow receiveShadow>
                <boxGeometry args={[1.3, 2.0, 1.15]} />
              </mesh>
              <mesh material={marbleTrim} position={[x!, 2.15, v]} castShadow>
                <boxGeometry args={[1.6, 0.3, 1.45]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* braziers flanking each temple front + the south gate */}
      {placements.flatMap(({ pos, rotY }, i) => {
        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        return [-1, 1].map(s => {
          const p = new THREE.Vector3(pos[0], 0, pos[2])
            .add(fwd.clone().multiplyScalar(-10.5))
            .add(side.clone().multiplyScalar(s * 4.4));
          return <Brazier key={`b${i}${s}`} position={[p.x, 0, p.z]} />;
        });
      })}
      <Brazier position={[-3.4, 0, 27]} />
      <Brazier position={[3.4, 0, 27]} />
      {/* flanking the gate's approach */}
      <Brazier position={[-8.3, 0, -16.5]} />
      <Brazier position={[8.3, 0, -16.5]} />

      {/* a distant sanctuary on a far ridge — pure silhouette */}
      <DistantShrine />
    </group>
  );
}

/** Soft photographic cumulus: stacked feathered gradients, sunlit tops, shaded bellies. */
function cloudTexture(seed: number): THREE.CanvasTexture {
  const r = mulberry32(seed);
  const W = 512, H = 288;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const baseY = 214 + r.range(-8, 10);
  type L = [number, number, number, number];

  // three tiers: mains → scallop subs on their tops → tiny minis on the subs
  const mains: L[] = [];
  const subs: L[] = [];
  const minis: L[] = [];
  const n = Math.floor(r.range(8, 12));
  for (let i = 0; i < n; i++) {
    const rx = r.range(26, 74), ry = r.range(22, 50);
    mains.push([r.range(120, 390), baseY - ry * r.range(0.3, 0.75), rx, ry]);
  }
  const towers = 1 + (r.next() < 0.6 ? 1 : 0);
  for (let t = 0; t < towers; t++) {
    mains.push([r.range(170, 350), baseY - r.range(70, 100), r.range(46, 68), r.range(42, 60)]);
  }
  for (const [x, y, rx, ry] of mains) {
    const k = 3 + Math.floor(r.range(0, 3));
    for (let i = 0; i < k; i++) {
      const a = r.range(Math.PI * 1.05, Math.PI * 1.95);
      const s: L = [
        x + Math.cos(a) * rx * r.range(0.55, 0.85),
        y + Math.sin(a) * ry * r.range(0.55, 0.85),
        rx * r.range(0.3, 0.5),
        ry * r.range(0.28, 0.46),
      ];
      subs.push(s);
      if (r.next() < 0.6) {
        const b = r.range(Math.PI * 1.15, Math.PI * 1.85);
        minis.push([
          s[0] + Math.cos(b) * s[2] * r.range(0.5, 0.8),
          s[1] + Math.sin(b) * s[3] * r.range(0.5, 0.8),
          s[2] * r.range(0.4, 0.6),
          s[3] * r.range(0.4, 0.6),
        ]);
      }
    }
  }
  const all = [...mains, ...subs, ...minis];

  // soft photographic cumulus: every puff is a feathered radial gradient —
  // no outlines, no etched contours, just stacked vapor. The gradient must be
  // authored in the transformed space (canvas transforms hit gradients too).
  const withAlpha = (core: string, a: number) => core.replace(/[\d.]+\)$/, `${a})`);
  const puff = (x: number, y: number, rx: number, ry: number, core: string, alpha: number) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
    grad.addColorStop(0, core);
    grad.addColorStop(0.5, withAlpha(core, alpha * 0.5));
    grad.addColorStop(1, withAlpha(core, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  // 1) shadowed vapor mass
  for (const [x, y, rx, ry] of all) puff(x, y + ry * 0.25, rx * 1.2, ry * 1.1, 'rgba(168,182,201,0.5)', 0.5);
  // 2) mid body
  for (const [x, y, rx, ry] of all) puff(x, y, rx, ry, 'rgba(222,230,240,0.75)', 0.75);
  // 3) sunlit tops — brightest where the sun hits (upper left of each puff)
  for (const [x, y, rx, ry] of all) {
    puff(x - rx * 0.15, y - ry * 0.3, rx * 0.72, ry * 0.6, 'rgba(255,253,248,0.9)', 0.9);
  }
  for (const [x, y, rx, ry] of mains) {
    puff(x - rx * 0.1, y - ry * 0.45, rx * 0.5, ry * 0.42, 'rgba(255,255,255,0.95)', 0.95);
  }
  // 4) darker underbelly
  for (const [x, y, rx, ry] of mains) {
    puff(x + rx * 0.15, y + ry * 0.55, rx * 0.8, ry * 0.4, 'rgba(142,158,180,0.45)', 0.45);
  }
  // 5) feathered flat-ish base: fade out rather than hard-cut
  const fade = g.createLinearGradient(0, baseY - 22, 0, baseY + 26);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fade;
  g.fillRect(0, baseY - 22, W, H - baseY + 22);
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Clouds() {
  const texs = useMemo(() => [55, 71, 89, 103, 121].map(cloudTexture), []);
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = mulberry32(31);
    // high, wide cumulus — big enough to read as clouds, never low enough
    // to swallow the plaza
    return Array.from({ length: 24 }, (_, i) => ({
      x: r.range(-1200, 1200),
      y: r.range(260, 420),
      z: r.range(-1200, 1200),
      s: r.range(160, 340),
      v: r.range(1.5, 4), // drift speed
      t: i % texs.length,
      flip: r.next() > 0.5 ? -1 : 1,
      o: r.range(0.75, 0.95),
      sy: r.range(0.45, 0.62),
    }));
  }, [texs.length]);
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
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s * c.flip, c.s * c.sy, 1]} userData={{ v: c.v }}>
          <spriteMaterial map={texs[c.t]!} transparent depthWrite={false} opacity={c.o} fog={false} />
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
