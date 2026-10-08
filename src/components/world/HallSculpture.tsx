'use client';
// The player's own marble on a pedestal inside the self-development hall.
// Deeds bank chisels (the next chunks glow gold); aiming and clicking knocks
// one loose — the statue is carved in the agora, one piece at a time.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { Suspense } from 'react';
import { CarvedRock } from '../CarvedRock';
import type { DoorDestination } from './types';

const FLOOR = 0.75;

interface ScState { revealed: number; pending: number; complete: boolean; seed: number }

export function HallSculpture({ destination, onDoorChange }: {
  destination: DoorDestination;
  onDoorChange: (d: DoorDestination | null) => void;
}) {
  const [st, setSt] = useState<ScState | null>(null);
  const [inside, setInside] = useState(false);
  const [entered, setEntered] = useState(false); // latches — merge once, then toggle visibility
  const marble = useMemo(() => marbleMaterial([206, 199, 186], [130, 122, 110], 9, 0.5), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sculpture', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok && data.sculpture) {
        setSt({
          revealed: data.sculpture.revealed, pending: data.sculpture.pending,
          complete: data.sculpture.status === 'complete', seed: data.sculpture.seed,
        });
      }
    } catch { /* world renders without the marble */ }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  const strike = useCallback(async () => {
    setSt((s) => (s && s.pending > 0 ? { ...s, revealed: s.revealed + 1, pending: s.pending - 1 } : s));
    try {
      const res = await fetch('/api/sculpture/chisel', { method: 'POST' });
      const data = await res.json();
      if (data?.ok) setSt((s) => (!s || data.revealed >= s.revealed
        ? { revealed: data.revealed, pending: data.pending, complete: data.complete, seed: s?.seed ?? 7 }
        : s));
    } catch { /* next strike reconciles */ }
  }, []);

  return (
    <group position={[0, FLOOR, 4.35]}>
      {/* pedestal */}
      <mesh material={marble} position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.6, 1.4]} />
      </mesh>
      <mesh material={marble} position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.1, 1.15]} />
      </mesh>

      {/* museum light — the marble is the hall's centerpiece */}
      <pointLight position={[0, 3.6, 1.0]} intensity={8} distance={7} decay={2} color={0xffe2b8} />

      {/* the rock mounts on first entry (decode+merge once) and hides when
          you leave — 1.5M tris never render from the courtyard */}
      {entered && st && (
        <group visible={inside}>
          <Suspense fallback={null}>
            <CarvedRock height={2.45} seed={st.seed} revealed={st.revealed} pending={st.pending}
              onStrike={strike} position={[0, 0.7, 0]} rotationY={Math.PI} />
          </Suspense>
        </group>
      )}

      {/* mounting gate: a wide sensor a step into the hall wakes the rock;
          leaving the hall unmounts it entirely */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[5.0, 3.0, 8.5]}
          position={[0, 2.0, -2.0]}
          onIntersectionEnter={() => { setInside(true); setEntered(true); }}
          onIntersectionExit={() => setInside(false)}
        />
        {/* you can't walk through the marble */}
        <CuboidCollider args={[0.8, 1.9, 0.8]} position={[0, 1.9, 0]} />
        {/* standing close → prompt; E opens the full view, click strikes */}
        <CuboidCollider
          sensor
          args={[2.0, 1.8, 2.0]}
          position={[0, 1.4, 0]}
          onIntersectionEnter={() => onDoorChange({
            slug: 'sculpture', name: 'Your Marble', href: '/sculpture', accent: 0xC9A227,
            prompt: st && st.pending > 0
              ? `${st.pending} chisel${st.pending === 1 ? '' : 's'} loaded — strike the marble`
              : 'Your marble awaits — deeds load the chisel',
          })}
          onIntersectionExit={() => onDoorChange(destination)}
        />
      </RigidBody>
    </group>
  );
}
