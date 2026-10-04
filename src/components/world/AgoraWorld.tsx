'use client';
// Full-screen walkable agora. Owns the canvas, physics world, HUD overlay,
// pointer-lock lifecycle, and door → route transitions.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls, Sky } from '@react-three/drei';
import { Suspense } from 'react';
import { Courtyard } from './Courtyard';
import { Player } from './Player';
import type { DoorDestination } from './types';

export function AgoraWorld({ destinations }: { destinations: DoorDestination[] }) {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  // ?dev → render without the enter-veil (for screenshotting / visual iteration)
  const [devView] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));
  const [door, setDoor] = useState<DoorDestination | null>(null);
  const doorRef = useRef<DoorDestination | null>(null);
  doorRef.current = door;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE') && doorRef.current) {
        const d = doorRef.current;
        document.exitPointerLock?.();
        router.push(d.href);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [router]);

  useEffect(() => () => document.exitPointerLock?.(), []);

  return (
    <div className="world-root">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 72, near: 0.1, far: 3200, position: [0, 1.8, 24] }}
        gl={{ antialias: true }}
      >
        <fog attach="fog" args={['#aec3d8', 90, 1600]} />
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
        <Suspense fallback={null}>
          <Physics gravity={[0, -22, 0]}>
            <Player />
            <Courtyard destinations={destinations} onDoorChange={setDoor} />
          </Physics>
        </Suspense>
        <PointerLockControls
          selector="#agora-enter"
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
        />
      </Canvas>

      {/* HUD */}
      <div className="world-hud">
        {locked && <div className="world-crosshair" />}
        {locked && door && (
          <div className="world-prompt">
            <span className="world-key">E</span>
            <span>Enter {door.name}</span>
          </div>
        )}
        <div className="world-exit"><Link href="/">← the lobby</Link></div>
      </div>

      {/* start / pause overlay */}
      {!locked && !devView && (
        <div className="world-veil">
          <div className="world-veil-card">
            <div className="label text-gold">GAMIFY THE GRIND</div>
            <h1 className="font-display text-4xl tracking-[0.14em] text-marble md:text-5xl">THE AGORA</h1>
            <p className="world-sub">
              Walk the courtyard. Each hall beyond the colonnade is a wing of the
              platform — step through a glowing doorway to enter it.
            </p>
            <button id="agora-enter" className="btn btn-primary world-enter">Step into the courtyard</button>
            <div className="world-controls">
              <span><b>WASD</b> move</span>
              <span><b>Mouse</b> look</span>
              <span><b>Shift</b> run</span>
              <span><b>Space</b> jump</span>
              <span><b>E</b> enter a doorway</span>
            </div>
            <Link href="/" className="world-back">back to the lobby</Link>
          </div>
        </div>
      )}
    </div>
  );
}
