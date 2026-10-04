'use client';
import dynamic from 'next/dynamic';
import type { DoorDestination } from '../../components/world/types';

const AgoraWorld = dynamic(() => import('../../components/world/AgoraWorld').then(m => m.AgoraWorld), {
  ssr: false,
  loading: () => (
    <div className="world-root">
      <div className="world-veil">
        <div className="world-veil-card">
          <div className="label text-gold">GAMIFYING THE GRIND</div>
          <h1 className="font-display text-4xl tracking-[0.14em] text-marble">THE AGORA</h1>
          <p className="world-sub">Raising the columns…</p>
        </div>
      </div>
    </div>
  ),
});

export function WorldScreen({ destinations }: { destinations: DoorDestination[] }) {
  return <AgoraWorld destinations={destinations} />;
}
