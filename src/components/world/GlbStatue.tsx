'use client';
// Real GLB statue — the Hunyuan3D-generated gladiator mesh, normalized to
// stand on the plinth. Untextured shape export, so it wears marble.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

const H = 3.8;

export function GlbStatue({ position = [0, 0, 0] as [number, number, number] }) {
  const { scene } = useGLTF('/models/gladiator.glb');

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
        o.material = new THREE.MeshStandardMaterial({
          color: 0xefece4,
          roughness: 0.55,
          metalness: 0.02,
        });
      }
    });
  }, [scaled]);

  return <group position={position}><primitive object={scaled} /></group>;
}

useGLTF.preload('/models/gladiator.glb');
