import type { Metadata } from 'next';
import { WorldScreen } from './WorldScreen';
import type { DoorDestination } from '../../components/world/types';

export const metadata: Metadata = { title: 'The Agora — Gamify the Grind' };

// Doorway → destination map. Order = north / east / west around the plaza.
const DESTINATIONS: DoorDestination[] = [
  { slug: 'self-development', name: 'Hall of Self-Development', href: '/hall/self-development', accent: 0xd9a84e },
  { slug: 'library', name: 'The Library', href: '/hall/library', accent: 0x7d9fd1 },
  { slug: 'gallery', name: 'The Gallery', href: '/hall/gallery', accent: 0xa878d9 },
];

export default function WorldPage() {
  return <WorldScreen destinations={DESTINATIONS} />;
}
