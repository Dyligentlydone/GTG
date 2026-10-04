'use client';
// The agora itself: plaza floor, perimeter colonnade, temples, braziers,
// statue centerpiece, cypress ring, ground, and boundary colliders.
import { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { buildStatue } from '../../lib/three/statue';
import { mulberry32 } from '../../sculpture/rng';
import { Column, Brazier, Temple } from './structures';
import type { DoorDestination } from './types';

const HALF = 30; // plaza half-size

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
  const trees = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2 + r.range(-0.1, 0.1);
      const rad = r.range(42, 68);
      return { x: Math.cos(a) * rad, z: Math.sin(a) * rad, h: r.range(7, 13), s: r.range(0.8, 1.4) };
    });
  }, []);

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={0x0c0a09} roughness={1} />
      </mesh>
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

      {/* cypress ring outside the walls */}
      {trees.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]} scale={[t.s, t.h / 8, t.s]}>
          <coneGeometry args={[1.6, 8, 8]} />
          <meshStandardMaterial color={0x0d1a12} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
