'use client';
// Canvas host for the 3D sculpture stage. Owns the SculptureScene lifecycle and
// forwards prop changes. Loaded only client-side via next/dynamic in SculptureHero.
import { useEffect, useRef, useState } from 'react';
import { SculptureScene } from '../lib/three/sculptureScene';

export interface SculptureCanvasProps {
  seed: number;
  piecesRevealed: number;
  weekPct: number;
  /**
   * Pieces to animate falling shortly after mount — the lobby passes a recent
   * Chisel Day's count so returning players watch their week land for real.
   * The scene starts at piecesRevealed - autoChisel and carves the rest live.
   */
  autoChisel?: number;
}

export function SculptureCanvas({ seed, piecesRevealed, weekPct, autoChisel = 0 }: SculptureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SculptureScene | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const pending = Math.min(Math.max(0, autoChisel), piecesRevealed);
    let scene: SculptureScene;
    try {
      scene = new SculptureScene(canvasRef.current, {
        seed,
        piecesRevealed: piecesRevealed - pending,
        weekPct,
      });
    } catch {
      // No WebGL (old GPU, blocked context) — the SVG statue underneath stays as the fallback.
      setWebglFailed(true);
      return;
    }
    sceneRef.current = scene;
    const timer = pending > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? window.setTimeout(() => scene.chisel(pending), 1400)
      : (pending > 0 ? (scene.chisel(pending), 0) : 0);
    return () => {
      window.clearTimeout(timer);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps -- scene is built once per seed

  useEffect(() => {
    sceneRef.current?.setWeekPct(weekPct);
  }, [weekPct]);

  if (webglFailed) return null;
  return <canvas ref={canvasRef} className="block h-full w-full" aria-label="3D view of your marble statue being carved. Drag to rotate." />;
}
