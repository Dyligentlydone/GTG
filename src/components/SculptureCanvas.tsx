'use client';
// Canvas host for the lobby's 3D sculpture stage — the same real carved rock
// as /sculpture and the agora hall (one rock everywhere). Display-only: the
// lobby links to the hall for striking. autoChisel replays recent pieces
// falling shortly after mount so returning players watch their week land.
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import { CarvedRock } from './CarvedRock';
import type { SculptureRow } from '../lib/repos/types';

export interface SculptureCanvasProps {
  seed: number;
  archetype: SculptureRow['archetype'];
  piecesRevealed: number;
  /** Banked chisels — drives the gold on-deck markers. */
  pending: number;
  /**
   * Pieces to animate falling shortly after mount — the lobby passes a recent
   * chisel count so returning players watch their strikes land for real.
   * The scene starts at piecesRevealed - autoChisel and carves the rest live.
   */
  autoChisel?: number;
}

export function SculptureCanvas({ seed, archetype, piecesRevealed, pending, autoChisel = 0 }: SculptureCanvasProps) {
  const replay = Math.min(Math.max(0, autoChisel), piecesRevealed);
  const [revealed, setRevealed] = useState(piecesRevealed - replay);

  useEffect(() => {
    if (replay <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(piecesRevealed);
      return;
    }
    // stagger the replayed strikes so a big week reads as a crumbling wave
    const timers: number[] = [];
    for (let i = 1; i <= replay; i++) {
      timers.push(window.setTimeout(() => setRevealed(piecesRevealed - replay + i), 1400 + i * 260));
    }
    return () => timers.forEach(clearTimeout);
  }, [replay, piecesRevealed]);



  return (
    <Canvas shadows camera={{ position: [0, 2.3, 6.2], fov: 38 }}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 8, 5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[-4, 6, -4]} intensity={70} angle={0.5} penumbra={0.6} color={0xffe0b0} />
      <Suspense fallback={null}>
        <CarvedRock seed={seed} archetype={archetype} revealed={revealed} pending={pending} position={[0, 0, 0]} />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.5, 0]}
        minPolarAngle={0.9} maxPolarAngle={1.55} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
}
