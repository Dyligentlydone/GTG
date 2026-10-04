'use client';
// First-person controller: dynamic Rapier capsule driven by WASD + pointer-locked camera.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';

const SPAWN: [number, number, number] = [0, 1.2, 24];
// ?cam=DEG → spawn DEG degrees around the statue facing it (screenshot/dev use)
const devCam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cam') : null;
const devSpawn = devCam === null ? null : (() => {
  const [d, r] = devCam.split(',').map(Number);
  const a = (d ?? 0) * Math.PI / 180;
  return [(r ?? 18) * Math.sin(a), 1.2, (r ?? 18) * Math.cos(a)] as [number, number, number];
})();
const EYE = 0.62;
const WALK = 4.4;
const RUN = 7.5;
const JUMP = 7.5;
const UP = new THREE.Vector3(0, 1, 0);

export function Player() {
  const rb = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const { world, rapier } = useRapier();
  const keys = useRef<Record<string, boolean>>({});
  const aimed = useRef(false);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const dir = useRef(new THREE.Vector3());
  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame(() => {
    const body = rb.current;
    if (!body) return;
    const t = body.translation();
    camera.position.set(t.x, t.y + EYE, t.z);
    if (devSpawn && !aimed.current) { camera.lookAt(0, 2.6, 0); aimed.current = true; }

    const k = keys.current;
    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    fwd.current.normalize();
    right.current.crossVectors(fwd.current, UP);

    dir.current.set(0, 0, 0);
    if (k['KeyW'] || k['ArrowUp']) dir.current.add(fwd.current);
    if (k['KeyS'] || k['ArrowDown']) dir.current.sub(fwd.current);
    if (k['KeyD'] || k['ArrowRight']) dir.current.add(right.current);
    if (k['KeyA'] || k['ArrowLeft']) dir.current.sub(right.current);
    if (dir.current.lengthSq() > 0) dir.current.normalize();

    const speed = k['ShiftLeft'] || k['ShiftRight'] ? RUN : WALK;
    const vel = body.linvel();

    const ray = new rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const grounded = !!world.castRay(ray, 1.15, true, undefined, undefined, undefined, body);

    const jump = (k['Space'] && grounded) ? JUMP : vel.y;
    body.setLinvel({ x: dir.current.x * speed, y: jump, z: dir.current.z * speed }, true);
  });

  return (
    <RigidBody
      ref={rb}
      colliders={false}
      position={devSpawn ?? SPAWN}
      enabledRotations={[false, false, false]}
      ccd
      friction={0}
      linearDamping={0}
    >
      <CapsuleCollider args={[0.65, 0.35]} />
    </RigidBody>
  );
}
