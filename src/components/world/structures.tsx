'use client';
// Parametric Greek structures for the agora: columns, temples, braziers.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { HallBoard } from './HallBoard';
import { HallSculpture } from './HallSculpture';
import type { DoorDestination, QuestTarget } from './types';

/** Fluted column geometry (shared): lathe profile + sinusoidal fluting. */
export function useColumnGeometry(height: number, radius: number) {
  return useMemo(() => {
    const h = height;
    const profile = [
      [radius * 1.16, 0], [radius * 1.16, 0.1], [radius * 0.98, 0.14], [radius * 0.9, 0.28],
      [radius * 0.84, h * 0.45], [radius * 0.78, h - 0.5],
      [radius * 0.8, h - 0.22], [radius * 1.0, h - 0.1], [radius * 1.1, h],
    ].map(([x, y]) => new THREE.Vector2(x!, y!));
    const geo = new THREE.LatheGeometry(profile, 20);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      // flute only along the shaft
      if (y > 0.28 && y < h - 0.22) {
        const ang = Math.atan2(z, x);
        const r = Math.hypot(x, z) * (1 - 0.045 * (0.5 + 0.5 * Math.cos(ang * 20)));
        p.setXYZ(i, Math.cos(ang) * r, y, Math.sin(ang) * r);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [height, radius]);
}

export function Column({ position, height = 4.4, radius = 0.34, material, collider = true, base = false }: {
  position: [number, number, number];
  height?: number;
  radius?: number;
  material: THREE.Material;
  collider?: boolean;
  base?: boolean;
}) {
  const geo = useColumnGeometry(height, radius);
  const colY = position[1] + (base ? 0.48 : 0);
  const mesh = (
    <group>
      {base && (
        <mesh material={material} position={[position[0], position[1] + 0.24, position[2]]} castShadow receiveShadow>
          <boxGeometry args={[radius * 3.2, 0.48, radius * 3.2]} />
        </mesh>
      )}
      <mesh geometry={geo} material={material} position={[position[0], colY, position[2]]} castShadow receiveShadow />
    </group>
  );
  if (!collider) return mesh;
  return (
    <RigidBody type="fixed" colliders={false}>
      {mesh}
      <CylinderCollider args={[height / 2, radius * 0.9]} position={[position[0], colY + height / 2, position[2]]} />
      {base && <CuboidCollider args={[radius * 1.6, 0.24, radius * 1.6]} position={[position[0], position[1] + 0.24, position[2]]} />}
    </RigidBody>
  );
}

export function Brazier({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.PointLight>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const bowlGeo = useMemo(() => new THREE.LatheGeometry(
    [[0.08, 0], [0.3, 0.06], [0.38, 0.22], [0.34, 0.3], [0.42, 0.34]].map(([x, y]) => new THREE.Vector2(x!, y!)), 20,
  ), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (light.current) light.current.intensity = 26 + 7 * Math.sin(t * 11 + phase) + 4 * Math.sin(t * 23 + phase * 2);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.12, 0.9, 10]} />
        <meshStandardMaterial color={0x2a2018} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh geometry={bowlGeo} position={[0, 0.9, 0]} castShadow>
        <meshStandardMaterial color={0x241a10} roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color={0x000000} emissive={0xff8c30} emissiveIntensity={3.4} />
      </mesh>
      <pointLight ref={light} position={[0, 1.55, 0]} color={0xff9440} intensity={26} distance={17} decay={2} />
    </group>
  );
}

/** Temple name painted on canvas — carved-stone look, and no extra React
 *  root (drei <Html> sync-unmounts warn under React 19). */
function namePlateTexture(name: string): THREE.CanvasTexture {
  const w = 1024, h = 160;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '8px'; } catch { /* older canvas impls */ }
  let size = 72;
  const label = name.toUpperCase();
  ctx.font = `600 ${size}px Cinzel, Georgia, serif`;
  while (ctx.measureText(label).width > w - 70 && size > 24) {
    size -= 4;
    ctx.font = `600 ${size}px Cinzel, Georgia, serif`;
  }
  ctx.fillStyle = 'rgba(15, 12, 9, 0.6)';
  ctx.fillText(label, w / 2 + 3, h / 2 + 4);
  ctx.fillStyle = '#efe9dc';
  ctx.fillText(label, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const TRI = (() => {
  const s = new THREE.Shape();
  s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
  return s;
})();

export function Temple({ destination, position, rotationY, onDoorChange, onQuest, boardVersion }: {
  destination: DoorDestination;
  position: [number, number, number];
  rotationY: number;
  onDoorChange: (d: DoorDestination | null) => void;
  onQuest: (q: QuestTarget) => void;
  boardVersion: number;
}) {
  const W = 12, D = 13, COL_H = 5.0, FLOOR = 0.75;
  const marble = useMemo(() => marbleMaterial([226, 219, 205], [148, 140, 128], 5, 0.52), []);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { document.fonts?.ready.then(() => setFontReady(true)); }, []);
  const nameTex = useMemo(() => namePlateTexture(destination.name), [destination.name, fontReady]);
  useEffect(() => () => nameTex.dispose(), [nameTex]);

  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: new THREE.Color(destination.accent), emissiveIntensity: 1.6,
  }), [destination.accent]);
  const pedimentGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(TRI, { depth: 1.4, bevelEnabled: false });
    g.translate(0, 0, -0.7);
    return g;
  }, []);
  const doorZ = -D / 2 + 0.25; // front wall (local -z faces plaza after rotation)
  const colXs = [-W / 2 + 0.9, -W / 6, W / 6, W / 2 - 0.9];
  // Front staircase: 5 marble steps from plaza floor to the platform top.
  // Visual slabs and colliders are the same boxes — you climb real stairs.
  const STAIR = { w: 7, z0: -10.0, z1: -6.5, rise: FLOOR, steps: 5 };
  const run = STAIR.z1 - STAIR.z0;
  const stepRise = STAIR.rise / STAIR.steps;
  const stepRun = run / STAIR.steps;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        {/* steps — visual */}
        {[0, 1, 2].map(i => (
          <mesh key={i} material={marble} position={[0, 0.12 + i * 0.25, -1.1 - (2 - i) * 0]} receiveShadow castShadow>
            <boxGeometry args={[W + 2.6 - i * 0.7, 0.24, D + 2.6 - i * 0.7]} />
          </mesh>
        ))}
        {/* stair steps — colliders match the visual slabs exactly */}
        {Array.from({ length: STAIR.steps }, (_, i) => (
          <CuboidCollider key={i}
            args={[STAIR.w / 2, (stepRise * (i + 1)) / 2, (STAIR.z1 - (STAIR.z0 + i * stepRun)) / 2]}
            position={[0, (stepRise * (i + 1)) / 2, (STAIR.z0 + i * stepRun + STAIR.z1) / 2]}
          />
        ))}
        {/* krepis tiers — colliders notched around the stair corridor */}
        {[0, 1, 2].map(i => {
          const halfW = (W + 2.6 - i * 0.7) / 2;
          const segW = halfW - STAIR.w / 2 - 0.05;
          return [-1, 1].map(s => (
            <CuboidCollider key={`${i}-${s}`}
              args={[segW / 2, 0.12, (D + 2.6 - i * 0.7) / 2]}
              position={[s * (STAIR.w / 2 + 0.05 + segW / 2), 0.12 + i * 0.25, -1.1]}
            />
          ));
        })}
        {/* platform */}
        <CuboidCollider args={[W / 2 + 0.6, 0.38, D / 2 + 0.6]} position={[0, 0.37, 0]} />
        {/* cella walls: back, sides, front split around door */}
        <CuboidCollider args={[W / 2 - 1.5, 2.3, 0.25]} position={[0, FLOOR + 2.3, D / 2 - 0.25]} />
        <CuboidCollider args={[0.25, 2.3, D / 2 - 0.5]} position={[-W / 2 + 1.75, FLOOR + 2.3, 0]} />
        <CuboidCollider args={[0.25, 2.3, D / 2 - 0.5]} position={[W / 2 - 1.75, FLOOR + 2.3, 0]} />
        <CuboidCollider args={[(W / 2 - 1.5 - 0.9) / 2, 2.3, 0.25]} position={[-(0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 2.3, doorZ]} />
        <CuboidCollider args={[(W / 2 - 1.5 - 0.9) / 2, 2.3, 0.25]} position={[(0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 2.3, doorZ]} />
        <CuboidCollider args={[0.95, 0.55, 0.25]} position={[0, FLOOR + 3.35, doorZ]} />
        {/* portico columns */}
        {colXs.map(x => (
          <CylinderCollider key={x} args={[COL_H / 2, 0.4]} position={[x, FLOOR + COL_H / 2, -D / 2 + 1.1]} />
        ))}
      </RigidBody>

      {/* front staircase — solid stacked slabs, each a tread-and-riser */}
      {Array.from({ length: STAIR.steps }, (_, i) => {
        const top = stepRise * (i + 1);
        return (
          <mesh key={i} material={marble}
            position={[0, top / 2, (STAIR.z0 + i * stepRun + STAIR.z1) / 2]}
            castShadow receiveShadow>
            <boxGeometry args={[STAIR.w, top, STAIR.z1 - (STAIR.z0 + i * stepRun)]} />
          </mesh>
        );
      })}

      {/* cella walls — visual */}
      <mesh material={marble} position={[0, FLOOR + 2.3, D / 2 - 0.25]} castShadow receiveShadow>
        <boxGeometry args={[W - 3, 4.6, 0.5]} />
      </mesh>
      <mesh material={marble} position={[-W / 2 + 1.75, FLOOR + 2.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 4.6, D - 1]} />
      </mesh>
      <mesh material={marble} position={[W / 2 - 1.75, FLOOR + 2.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 4.6, D - 1]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} material={marble} position={[s * (0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 2.3, doorZ]} castShadow receiveShadow>
          <boxGeometry args={[W / 2 - 1.5 - 0.9, 4.6, 0.5]} />
        </mesh>
      ))}
      <mesh material={marble} position={[0, FLOOR + 3.35, doorZ]} castShadow>
        <boxGeometry args={[1.9, 1.1, 0.5]} />
      </mesh>
      {/* door glow — emissive plane recessed inside */}
      <mesh material={glowMat} position={[0, FLOOR + 1.4, doorZ + 0.8]}>
        <planeGeometry args={[1.8, 2.8]} />
      </mesh>
      <pointLight position={[0, FLOOR + 2.2, doorZ - 1.5]} color={destination.accent} intensity={14} distance={12} decay={2} />
      {/* warm interior fill — the roof is fully closed now, so the cella needs its own light */}
      <pointLight position={[0, FLOOR + 3.6, 1.5]} color={0xffd9a0} intensity={9} distance={15} decay={2} />

      {/* portico columns — visual */}
      {colXs.map(x => <Column key={x} position={[x, FLOOR, -D / 2 + 1.1]} height={COL_H} radius={0.44} material={marble} collider={false} />)}
      {/* architrave + pediment */}
      <mesh material={marble} position={[0, FLOOR + COL_H + 0.3, -D / 2 + 1.1]} castShadow>
        <boxGeometry args={[W + 0.6, 0.6, 1.1]} />
      </mesh>
      <mesh material={marble} position={[0, FLOOR + COL_H + 0.55, 0.15]} castShadow>
        <boxGeometry args={[W + 0.8, 0.5, D + 0.4]} />
      </mesh>
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + COL_H + 0.82, -D / 2 + 1.1]} scale={[W / 2 + 0.35, 1.5, 1]} castShadow />
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + COL_H + 0.82, D / 2 - 0.4]} scale={[W / 2 + 0.35, 1.5, 1]} castShadow />

      {/* hall zone — whole platform + ramp top, so E works anywhere inside */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[W / 2 + 0.5, 2.2, D / 2 + 2.6]}
          position={[0, FLOOR + 1.6, -2.0]}
          onIntersectionEnter={() => onDoorChange(destination)}
          onIntersectionExit={() => onDoorChange(null)}
        />
      </RigidBody>

      {/* interior — game halls render their live board as shrines */}
      {destination.gameSlug && (
        <HallBoard gameSlug={destination.gameSlug} destination={destination} onDoorChange={onDoorChange}
          onQuest={onQuest} version={boardVersion} />
      )}
      {/* the player's marble waits in the self-development hall to be struck */}
      {destination.sculptureHall && (
        <HallSculpture destination={destination} onDoorChange={onDoorChange} />
      )}

      {/* temple name — carved onto the pediment face */}
      <mesh position={[0, FLOOR + COL_H + 1.5, -D / 2 + 0.38]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.6, 0.72]} />
        <meshBasicMaterial map={nameTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Monumental gate-hall at the plaza's north end — a propylaea: steps up to a
 *  columned porch, bronze doors swung open, and a full-depth hall behind them.
 *  Interior is the whole footprint, not just the doorway. */
export function NorthGate({ position = [0, 0, -23] }: { position?: [number, number, number] }) {
  const W = 20, D = 13, FLOOR = 0.75;
  const COL_H = 6.2;          // porch columns, taller than the temples'
  const WALL_H = 7.6;         // wall height
  const DOOR_W = 5.6, DOOR_H = 5.0;
  const marble = useMemo(() => marbleMaterial([226, 219, 205], [148, 140, 128], 9, 0.52), []);
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x3d2c14, metalness: 0.85, roughness: 0.42 }), []);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { document.fonts?.ready.then(() => setFontReady(true)); }, []);
  const nameTex = useMemo(() => namePlateTexture('Gamifying the Grind'), [fontReady]);
  useEffect(() => () => nameTex.dispose(), [nameTex]);
  const logoTex = useLoader(THREE.TextureLoader, '/gtg-mark.png');
  useMemo(() => { logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4; }, [logoTex]);
  const pedimentGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(TRI, { depth: 1.4, bevelEnabled: false });
    g.translate(0, 0, -0.7);
    return g;
  }, []);

  const segW = (W - DOOR_W) / 2;                       // front wall halves flanking the entry
  const STAIR = { w: 15, z0: D / 2 + 4.2, z1: D / 2 + 0.5, rise: FLOOR, steps: 5 };
  const stepRise = STAIR.rise / STAIR.steps;
  const stepRun = (STAIR.z0 - STAIR.z1) / STAIR.steps;
  const colXs = [-8.8, -6.0, -3.6, 3.6, 6.0, 8.8];     // porch columns, clear of the entry
  const DOOR_SWING = 1.9;                              // ~109° — leaves swung into the hall
  const leafOff = DOOR_W / 4 - 0.03;                   // leaf center offset from its hinge
  // leaf world position: hinge at ±DOOR_W/2, offset rotated by the group's swing
  const doorLeaf = (s: 1 | -1): [number, number, number] => [
    s * (DOOR_W / 2 - leafOff * Math.cos(DOOR_SWING)),
    FLOOR + DOOR_H / 2,
    D / 2 - 0.6 - leafOff * Math.sin(DOOR_SWING),
  ];

  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        {/* steps — each slab runs from its outer edge back to the platform */}
        {Array.from({ length: STAIR.steps }, (_, i) => {
          const front = STAIR.z0 - i * stepRun;
          return (
            <CuboidCollider key={i}
              args={[STAIR.w / 2, (stepRise * (i + 1)) / 2, (front - STAIR.z1) / 2]}
              position={[0, (stepRise * (i + 1)) / 2, (STAIR.z1 + front) / 2]}
            />
          );
        })}
        {/* krepis tiers beside the stair corridor */}
        {[0, 1, 2].map(i => {
          const halfW = (W + 2.6 - i * 0.7) / 2;
          const seg = halfW - STAIR.w / 2 - 0.05;
          return [-1, 1].map(s => (
            <CuboidCollider key={`${i}-${s}`}
              args={[seg / 2, 0.12, (D + 2.6 - i * 0.7) / 2]}
              position={[s * (STAIR.w / 2 + 0.05 + seg / 2), 0.12 + i * 0.25, 0]}
            />
          ));
        })}
        {/* platform */}
        <CuboidCollider args={[W / 2 + 0.6, 0.38, D / 2 + 0.6]} position={[0, 0.37, 0]} />
        {/* walls: back, sides, front halves — the entry itself stays open */}
        <CuboidCollider args={[W / 2 - 0.4, WALL_H / 2, 0.3]} position={[0, FLOOR + WALL_H / 2, -D / 2 + 0.3]} />
        {[-1, 1].map(s => (
          <CuboidCollider key={s} args={[0.3, WALL_H / 2, D / 2 - 0.4]} position={[s * (W / 2 - 0.3), FLOOR + WALL_H / 2, -0.1]} />
        ))}
        {[-1, 1].map(s => (
          <CuboidCollider key={`f${s}`} args={[segW / 2, WALL_H / 2, 0.3]} position={[s * (DOOR_W / 2 + segW / 2), FLOOR + WALL_H / 2, D / 2 - 0.3]} />
        ))}
        {/* swung-open door leaves */}
        {([-1, 1] as const).map(s => (
          <CuboidCollider key={`d${s}`} args={[DOOR_W / 4, DOOR_H / 2, 0.12]}
            position={doorLeaf(s)} rotation={[0, s * -DOOR_SWING, 0]} />
        ))}
        {colXs.map(x => (
          <CylinderCollider key={x} args={[COL_H / 2, 0.42]} position={[x, FLOOR + COL_H / 2, D / 2 + 0.7]} />
        ))}
      </RigidBody>

      {/* steps — visual slabs matching the colliders */}
      {Array.from({ length: STAIR.steps }, (_, i) => {
        const top = stepRise * (i + 1);
        const z1 = STAIR.z0 - i * stepRun;
        const z0 = z1 - stepRun;
        return (
          <mesh key={i} material={marble} position={[0, top / 2, (z0 + z1) / 2]} castShadow receiveShadow>
            <boxGeometry args={[STAIR.w, top, stepRun]} />
          </mesh>
        );
      })}
      {/* krepis tiers — visual */}
      {[0, 1, 2].map(i => (
        <mesh key={i} material={marble} position={[0, 0.12 + i * 0.25, 0]} receiveShadow castShadow>
          <boxGeometry args={[W + 2.6 - i * 0.7, 0.24, D + 2.6 - i * 0.7]} />
        </mesh>
      ))}

      {/* walls — back (closed), sides, and the front halves around the entry */}
      <mesh material={marble} position={[0, FLOOR + WALL_H / 2, -D / 2 + 0.25]} castShadow receiveShadow>
        <boxGeometry args={[W - 0.6, WALL_H, 0.5]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} material={marble} position={[s * (W / 2 - 0.25), FLOOR + WALL_H / 2, -0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.5, WALL_H, D - 0.4]} />
        </mesh>
      ))}
      {[-1, 1].map(s => (
        <mesh key={`f${s}`} material={marble} position={[s * (DOOR_W / 2 + segW / 2), FLOOR + WALL_H / 2, D / 2 - 0.25]} castShadow receiveShadow>
          <boxGeometry args={[segW, WALL_H, 0.5]} />
        </mesh>
      ))}
      {/* lintel over the entry */}
      <mesh material={marble} position={[0, FLOOR + DOOR_H + (WALL_H - DOOR_H) / 2, D / 2 - 0.25]} castShadow>
        <boxGeometry args={[DOOR_W + 0.8, WALL_H - DOOR_H, 0.5]} />
      </mesh>

      {/* bronze doors swung open into the hall, ring handles facing the plaza */}
      {([-1, 1] as const).map(s => (
        <group key={`door${s}`} position={[s * DOOR_W / 2, 0, D / 2 - 0.6]} rotation={[0, s * -DOOR_SWING, 0]}>
          <mesh material={bronze} position={[s * -(DOOR_W / 4 - 0.03), FLOOR + DOOR_H / 2, 0]} castShadow>
            <boxGeometry args={[DOOR_W / 2 - 0.06, DOOR_H, 0.14]} />
          </mesh>
          <mesh position={[s * -(DOOR_W / 4 - 0.03) - s * 0.6, FLOOR + 2.2, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.05, 8, 20]} />
            <meshStandardMaterial color={0x6a4d1c} metalness={0.9} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* porch columns + architrave + roof + pediments (front and back) */}
      {colXs.map(x => <Column key={x} position={[x, FLOOR, D / 2 + 0.7]} height={COL_H} radius={0.46} material={marble} collider={false} />)}
      <mesh material={marble} position={[0, FLOOR + COL_H + 0.3, D / 2 + 0.7]} castShadow>
        <boxGeometry args={[W + 0.8, 0.6, 1.4]} />
      </mesh>
      <mesh material={marble} position={[0, FLOOR + WALL_H + 0.35, 0]} castShadow>
        <boxGeometry args={[W + 0.8, 0.5, D + 0.8]} />
      </mesh>
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + WALL_H + 0.85, D / 2 + 0.7]} scale={[W / 2 + 0.45, 1.9, 1]} castShadow />
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + WALL_H + 0.85, -D / 2 - 0.1]} rotation={[0, Math.PI, 0]} scale={[W / 2 + 0.45, 1.9, 1]} castShadow />

      {/* interior floor inlay + braziers + warm fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR + 0.02, 0]}>
        <ringGeometry args={[2.6, 3.0, 48]} />
        <meshStandardMaterial color={0x8a6a2f} roughness={0.4} metalness={0.6} />
      </mesh>
      <Brazier position={[-7.6, FLOOR, -4.6]} />
      <Brazier position={[7.6, FLOOR, -4.6]} />
      <pointLight position={[0, FLOOR + 4.2, -0.5]} color={0xffd9a0} intensity={12} distance={20} decay={2} />

      {/* name carved over the gate + GTG mark above it on the pediment */}
      <mesh position={[0, FLOOR + WALL_H + 1.25, D / 2 + 1.42]}>
        <planeGeometry args={[9.4, 1.15]} />
        <meshBasicMaterial map={nameTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, FLOOR + WALL_H + 1.95, D / 2 + 1.42]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial map={logoTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
