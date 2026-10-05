'use client';
// Full-screen walkable agora. Owns the canvas, physics world, HUD overlay,
// pointer-lock lifecycle, and door → route transitions.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls, Sky, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { Suspense } from 'react';
import { Courtyard } from './Courtyard';
import { Player } from './Player';
import { CheckinForm } from '../CheckinForm';
import type { DoorDestination, QuestTarget } from './types';

const BLOCKED_MSG: Record<NonNullable<QuestTarget['blocked']>, string> = {
  done: 'Already chiseled today.',
  rest: 'Not an active day for this quest.',
  locked: 'This shrine is still sealed.',
};

export function AgoraWorld({ destinations }: { destinations: DoorDestination[] }) {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  // ?dev → render without the enter-veil (for screenshotting / visual iteration)
  const [devView] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));
  const [door, setDoor] = useState<DoorDestination | null>(null);
  const doorRef = useRef<DoorDestination | null>(null);
  doorRef.current = door;
  const [quest, setQuest] = useState<QuestTarget | null>(null);
  const questRef = useRef<QuestTarget | null>(null);
  questRef.current = quest;
  const [boardV, setBoardV] = useState(0);
  const plc = useRef<PointerLockControlsImpl>(null);

  const openQuest = (q: QuestTarget) => {
    document.exitPointerLock?.();
    setQuest(q);
  };
  const closeQuest = () => {
    setQuest(null);
    setBoardV((v) => v + 1); // re-pull the board so panels reflect the check-in
    // The closing click/Esc is still a live user gesture — relock straight
    // back into the hall instead of resurfacing the enter-veil.
    try {
      (plc.current?.domElement?.requestPointerLock() as Promise<void> | undefined)
        ?.catch(() => { /* gesture refused → veil is already showing */ });
    } catch { /* impls without a promise return */ }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && questRef.current) { closeQuest(); return; }
      // while a check-in modal is open — or any field has focus — the
      // keyboard belongs to the form, not the world
      if (questRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.code === 'KeyE') && doorRef.current) {
        const d = doorRef.current;
        if (d.quest) openQuest(d.quest);
        else {
          document.exitPointerLock?.();
          router.push(d.href);
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [router]);

  useEffect(() => () => document.exitPointerLock?.(), []);

  return (
    <div className="world-root">
      <Canvas
        shadows="soft"
        dpr={[1, 1.75]}
        camera={{ fov: 72, near: 0.1, far: 3200, position: [0, 1.8, 24] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <fog attach="fog" args={['#b9c9da', 110, 1700]} />
        {/* tight mie halo → a crisp sun disc instead of a giant glow blob */}
        <Sky distance={45000} sunPosition={[70, 55, -60]} turbidity={3.5} rayleigh={0.9} mieCoefficient={0.0012} mieDirectionalG={0.97} />
        {/* image-based lighting: a procedural "sky dome + sun" env map gives the
            marble and bronze real reflections and soft directional ambience */}
        <Environment frames={1} resolution={256} background={false} environmentIntensity={0.5}>
          <color attach="background" args={['#5a7696']} />
          <Lightformer form="rect" intensity={0.9} color="#fff4e0" position={[18, 14, -15]} scale={[10, 10, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.25} color="#b9d2ef" position={[0, 22, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[60, 60, 1]} />
          <Lightformer form="rect" intensity={0.12} color="#c9b89a" position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[60, 60, 1]} />
        </Environment>
        <hemisphereLight args={['#7ea4d4', '#7a6a4c', 0.55]} />
        <directionalLight
          position={[70, 80, -60]}
          intensity={2.7}
          color={0xffeed2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-52}
          shadow-camera-right={52}
          shadow-camera-top={52}
          shadow-camera-bottom={-52}
          shadow-camera-far={200}
          shadow-bias={-0.00022}
          shadow-normalBias={0.02}
        />
        {/* cool sky-bounce fill so south faces (incl. the statue's front) aren't flat shadow */}
        <directionalLight position={[-15, 30, 60]} intensity={0.35} color={0xcfe0f5} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -22, 0]}>
            <Player />
            <Courtyard destinations={destinations} onDoorChange={setDoor} onQuest={openQuest} boardVersion={boardV} />
          </Physics>
        </Suspense>
        {/* the photographic glue: contact-shadow AO, gentle highlight bloom,
            and a subtle lens vignette */}
        <EffectComposer multisampling={4}>
          <N8AO halfRes aoRadius={1.8} intensity={2.6} distanceFalloff={2.2} quality="performance" />
          <Bloom mipmapBlur luminanceThreshold={1.0} intensity={0.32} radius={0.65} />
          <Vignette eskil={false} offset={0.18} darkness={0.62} />
        </EffectComposer>
        <PointerLockControls
          ref={plc}
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
            <span>{door.prompt ?? `Enter ${door.name}`}</span>
            {door.quest && <span className="text-shadow">· or click</span>}
          </div>
        )}
        <div className="world-exit"><Link href="/profile">← your profile</Link></div>
      </div>

      {/* in-world quest check-in — the same form as the quest page */}
      {quest && (
        <div className="world-modal" onClick={closeQuest}>
          <div className="world-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="label text-gold">{quest.pillar} · +{quest.xp} XP</p>
                <h2 className="font-display text-2xl text-marble">{quest.title}</h2>
                {quest.description && <p className="mt-1.5 text-sm leading-relaxed text-shadow">{quest.description}</p>}
              </div>
              <button onClick={closeQuest} className="btn px-3 py-1 text-sm" aria-label="Close">✕</button>
            </div>
            {quest.blocked ? (
              <div className="card p-6 text-center">
                <p className="font-display text-xl text-gold">{BLOCKED_MSG[quest.blocked]}</p>
                <p className="mt-2 text-sm text-shadow">Come back when it's due — the board keeps your streak either way.</p>
              </div>
            ) : (
              <CheckinForm
                gameSlug={quest.gameSlug}
                questKey={quest.questKey}
                proof={quest.proof}
                books={quest.books}
                minSeconds={quest.proof.type === 'timer' ? quest.proof.minSeconds : undefined}
                onDone={() => setBoardV((v) => v + 1)}
                onClose={closeQuest}
              />
            )}
            <p className="mt-3 text-center">
              <a href={`/games/${quest.gameSlug}/quest/${quest.questKey}`} className="text-xs text-shadow underline">
                open the full quest page
              </a>
            </p>
          </div>
        </div>
      )}

      {/* start / pause overlay */}
      {!locked && !devView && !quest && (
        <div className="world-veil">
          <div className="world-veil-card">
            <div className="label text-gold">GAMIFYING THE GRIND</div>
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
            <Link href="/profile" className="world-back">back to your profile</Link>
          </div>
        </div>
      )}
    </div>
  );
}
