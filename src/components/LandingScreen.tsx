'use client';
// The landing gate: live agora behind a login card. The world is a client-only
// dynamic import so the page shell renders instantly while WebGL warms up.
import dynamic from 'next/dynamic';
import { LoginForm } from './LoginForm';

const LandingWorld = dynamic(
  () => import('./world/LandingWorld').then((m) => m.LandingWorld),
  { ssr: false },
);

export function LandingScreen({ error }: { error?: string }) {
  return (
    <div className="world-root">
      <LandingWorld />
      <div className="landing-veil">
        <div className="world-veil-card">
          <div className="label text-gold">GAMIFY THE GRIND</div>
          <h1 className="font-display text-4xl tracking-[0.14em] text-marble md:text-5xl">THE AGORA</h1>
          <p className="world-sub">
            Beyond these columns waits your marble. Sign in and step through.
          </p>
          <div className="text-left">
            <LoginForm next="/world" error={error} />
          </div>
          <p className="text-xs text-shadow">Magic link only — no passwords in the temple.</p>
        </div>
      </div>
    </div>
  );
}
