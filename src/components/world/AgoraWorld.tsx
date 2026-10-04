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

  const openQuest = (q: QuestTarget) => {
    document.exitPointerLock?.();
    setQuest(q);
  };
  const closeQuest = () => {
    setQuest(null);
    setBoardV((v) => v + 1); // re-pull the board so panels reflect the check-in
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
        shadows="percentage"
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
        {/* cool sky-bounce fill so south faces (incl. the statue's front) aren't flat shadow */}
        <directionalLight position={[-15, 30, 60]} intensity={0.45} color={0xcfe0f5} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -22, 0]}>
            <Player />
            <Courtyard destinations={destinations} onDoorChange={setDoor} onQuest={openQuest} boardVersion={boardV} />
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
      {!locked && !devView && (
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
