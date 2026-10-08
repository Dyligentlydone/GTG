'use client';
// The agora's centerpiece — the GTG marble figure (warrior wielding a
// keyboard), compressed draco GLB, normalized to stand on the plinth.
// Keeps its own authored materials — the red/blue paint streaks are part of it.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

const H = 3.8;

export function GlbStatue({ position = [0, 0, 0] as [number, number, number] }) {
  const { scene } = useGLTF('/models/gtg-logo.glb');

  const scaled = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const s = H / size.y;
    const center = box.getCenter(new THREE.Vector3());
    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    return clone;
  }, [scene]);

  useEffect(() => {
    scaled.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
  }, [scaled]);

  return (
    <group position={position} rotation={[0, -0.45, 0]}>
      <primitive object={scaled} />
    </group>
  );
}

useGLTF.preload('/models/gtg-logo.glb');
