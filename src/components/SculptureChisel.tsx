'use client';
// The strike surface on /sculpture: the real fractured marble on its plinth.
// Deeds load chisels (the next chunks glow gold); each click knocks one loose.
// Optimistic per click — the server's atomic consume reconciles the count.
import { Suspense, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CarvedRock } from './CarvedRock';
import { marbleMaterial } from '../lib/three/materials';
import { useMemo } from 'react';

function Plinth() {
  const dark = useMemo(() => marbleMaterial([40, 40, 46], [22, 22, 26], 3, 0.55), []);
  const top = useMemo(() => marbleMaterial([52, 52, 58], [30, 30, 34], 5, 0.5), []);
  return (
    <group>
      <mesh material={dark} position={[0, 0.21, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.42, 1.4]} />
      </mesh>
      <mesh material={top} position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.08, 1.26]} />
      </mesh>
    </group>
  );
}

export function SculptureChisel({ revealed, pending, total, seed }: { revealed: number; pending: number; total: number; seed: number }) {
  const [st, setSt] = useState({ revealed, pending, complete: revealed >= total });

  const strike = useCallback(async () => {
    setSt((s) => (s.pending > 0 ? { ...s, revealed: s.revealed + 1, pending: s.pending - 1 } : s));
    try {
      const res = await fetch('/api/sculpture/chisel', { method: 'POST' });
      const data = await res.json();
      if (data?.ok) setSt((s) => (data.revealed >= s.revealed
        ? { revealed: data.revealed, pending: data.pending, complete: data.complete }
        : s));
    } catch { /* next strike reconciles */ }
  }, []);

  return (
    <div className="w-full">
      <div className="relative h-[380px] w-full overflow-hidden rounded-lg border border-line bg-[#121215]">
        <Canvas shadows camera={{ position: [0, 2.1, 5.6], fov: 40 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 8, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          <spotLight position={[-4, 6, -4]} intensity={60} angle={0.5} penumbra={0.6} color={0xffe0b0} />
          <Suspense fallback={null}>
            <Plinth />
            <CarvedRock seed={seed} revealed={st.revealed} pending={st.pending} onStrike={strike} position={[0, 0.5, 0]} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.9, 0]}
            minPolarAngle={0.9} maxPolarAngle={1.55} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center">
          {st.complete
            ? <p className="text-sm font-display tracking-[0.2em] text-gold">THE STATUE STANDS FREE</p>
            : st.pending > 0
              ? <p className="text-sm font-display tracking-[0.2em] text-gold">{st.pending} CHISEL{st.pending === 1 ? '' : 'S'} LOADED — STRIKE THE MARBLE</p>
              : <p className="text-sm font-display tracking-[0.2em] text-shadow">DO TODAY'S QUESTS TO LOAD CHISELS</p>}
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${(st.revealed / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-marble">{st.revealed} / {total} revealed · {st.pending} chisel{st.pending === 1 ? '' : 's'} loaded</p>
    </div>
  );
}
