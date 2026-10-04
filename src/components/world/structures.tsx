'use client';
// Parametric Greek structures for the agora: columns, temples, braziers.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import { marbleMaterial } from '../../lib/three/materials';
import type { DoorDestination } from './types';

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

export function Column({ position, height = 4.4, radius = 0.34, material, collider = true }: {
  position: [number, number, number];
  height?: number;
  radius?: number;
  material: THREE.Material;
  collider?: boolean;
}) {
  const geo = useColumnGeometry(height, radius);
  const mesh = (
    <mesh geometry={geo} material={material} position={position} castShadow receiveShadow />
  );
  if (!collider) return mesh;
  return (
    <RigidBody type="fixed" colliders={false}>
      {mesh}
      <CylinderCollider args={[height / 2, radius * 0.9]} position={[position[0], position[1] + height / 2, position[2]]} />
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

const TRI = (() => {
  const s = new THREE.Shape();
  s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
  return s;
})();

export function Temple({ destination, position, rotationY, onDoorChange }: {
  destination: DoorDestination;
  position: [number, number, number];
  rotationY: number;
  onDoorChange: (d: DoorDestination | null) => void;
}) {
  const W = 12, D = 13, COL_H = 4.4, FLOOR = 0.75;
  const marble = useMemo(() => marbleMaterial([226, 219, 205], [148, 140, 128], 5, 0.52), []);
  const darkStone = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.9 }), []);
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
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        {/* steps — visual */}
        {[0, 1, 2].map(i => (
          <mesh key={i} material={marble} position={[0, 0.12 + i * 0.25, -1.1 - (2 - i) * 0]} receiveShadow castShadow>
            <boxGeometry args={[W + 2.6 - i * 0.7, 0.24, D + 2.6 - i * 0.7]} />
          </mesh>
        ))}
        {/* steps — ramp collider at the front so the capsule walks up */}
        <CuboidCollider
          args={[W / 2 + 1.3, 0.55, 1.6]}
          position={[0, 0.28, -D / 2 - 1.6]}
          rotation={[-Math.atan2(0.75, 3.2), 0, 0]}
        />
        {/* platform */}
        <CuboidCollider args={[W / 2 + 0.6, 0.38, D / 2 + 0.6]} position={[0, 0.37, 0]} />
        {/* cella walls: back, sides, front split around door */}
        <CuboidCollider args={[W / 2 - 1.5, 1.9, 0.25]} position={[0, FLOOR + 1.9, D / 2 - 0.25]} />
        <CuboidCollider args={[0.25, 1.9, D / 2 - 0.5]} position={[-W / 2 + 1.75, FLOOR + 1.9, 0]} />
        <CuboidCollider args={[0.25, 1.9, D / 2 - 0.5]} position={[W / 2 - 1.75, FLOOR + 1.9, 0]} />
        <CuboidCollider args={[(W / 2 - 1.5 - 0.9) / 2, 1.9, 0.25]} position={[-(0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 1.9, doorZ]} />
        <CuboidCollider args={[(W / 2 - 1.5 - 0.9) / 2, 1.9, 0.25]} position={[(0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 1.9, doorZ]} />
        <CuboidCollider args={[0.95, 0.55, 0.25]} position={[0, FLOOR + 3.35, doorZ]} />
        {/* portico columns */}
        {colXs.map(x => (
          <CylinderCollider key={x} args={[COL_H / 2, 0.31]} position={[x, FLOOR + COL_H / 2, -D / 2 + 1.1]} />
        ))}
      </RigidBody>

      {/* cella walls — visual */}
      <mesh material={darkStone} position={[0, FLOOR + 1.9, D / 2 - 0.25]} castShadow receiveShadow>
        <boxGeometry args={[W - 3, 3.8, 0.5]} />
      </mesh>
      <mesh material={darkStone} position={[-W / 2 + 1.75, FLOOR + 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 3.8, D - 1]} />
      </mesh>
      <mesh material={darkStone} position={[W / 2 - 1.75, FLOOR + 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 3.8, D - 1]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} material={darkStone} position={[s * (0.9 + (W / 2 - 1.5 - 0.9) / 2), FLOOR + 1.9, doorZ]} castShadow receiveShadow>
          <boxGeometry args={[W / 2 - 1.5 - 0.9, 3.8, 0.5]} />
        </mesh>
      ))}
      <mesh material={darkStone} position={[0, FLOOR + 3.35, doorZ]} castShadow>
        <boxGeometry args={[1.9, 1.1, 0.5]} />
      </mesh>
      {/* door glow — emissive plane recessed inside */}
      <mesh material={glowMat} position={[0, FLOOR + 1.4, doorZ + 0.8]}>
        <planeGeometry args={[1.8, 2.8]} />
      </mesh>
      <pointLight position={[0, FLOOR + 2.2, doorZ - 1.5]} color={destination.accent} intensity={14} distance={12} decay={2} />

      {/* portico columns — visual */}
      {colXs.map(x => <Column key={x} position={[x, FLOOR, -D / 2 + 1.1]} height={COL_H} radius={0.34} material={marble} collider={false} />)}
      {/* architrave + pediment */}
      <mesh material={marble} position={[0, FLOOR + COL_H + 0.3, -D / 2 + 1.1]} castShadow>
        <boxGeometry args={[W + 0.6, 0.6, 1.1]} />
      </mesh>
      <mesh material={marble} position={[0, FLOOR + COL_H + 0.55, D / 2 - 0.4]} castShadow>
        <boxGeometry args={[W + 0.6, 0.5, D - 0.6]} />
      </mesh>
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + COL_H + 0.82, -D / 2 + 1.1]} scale={[W / 2 + 0.35, 1.5, 1]} castShadow />
      <mesh geometry={pedimentGeo} material={marble} position={[0, FLOOR + COL_H + 0.82, D / 2 - 0.4]} scale={[W / 2 + 0.35, 1.5, 1]} castShadow />

      {/* door sensor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[0.95, 1.4, 0.9]}
          position={[0, FLOOR + 1.4, doorZ + 0.2]}
          onIntersectionEnter={() => onDoorChange(destination)}
          onIntersectionExit={() => onDoorChange(null)}
        />
      </RigidBody>

      <Html position={[0, FLOOR + COL_H + 2.8, -D / 2 + 1.1]} center distanceFactor={26} zIndexRange={[10, 0]}>
        <div className="world-name">{destination.name}</div>
      </Html>
    </group>
  );
}
