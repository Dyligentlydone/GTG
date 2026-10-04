'use client';
// Landing backdrop: the agora rendered live behind the login card. No player,
// no pointer lock — a slow distant orbit around the plaza so the world reads
// as a vista, not a game you can already walk.
import { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Sky } from '@react-three/drei';
import { Courtyard } from './Courtyard';
import type { DoorDestination } from './types';

function OrbitCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() * 0.035;
    camera.position.set(Math.sin(t) * 85, 30 + Math.sin(t * 0.6) * 5, Math.cos(t) * 85);
    camera.lookAt(0, 5, 0);
  });
  return null;
}

export function LandingWorld() {
  const noDestinations: DoorDestination[] = [];
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 55, near: 0.1, far: 3200, position: [0, 30, 85] }}
      gl={{ antialias: true }}
    >
      <fog attach="fog" args={['#aec3d8', 140, 1600]} />
      <Sky distance={45000} sunPosition={[70, 55, -60]} turbidity={5} rayleigh={0.8} />
      <hemisphereLight args={['#7ea4d4', '#7a6a4c', 1.0]} />
      <directionalLight
        position={[70, 80, -60]}
        intensity={2.6}
        color={0xfff2dd}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-15, 30, 60]} intensity={0.45} color={0xcfe0f5} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -22, 0]}>
          <Courtyard destinations={noDestinations} onDoorChange={() => {}} />
        </Physics>
      </Suspense>
      <OrbitCamera />
    </Canvas>
  );
}
