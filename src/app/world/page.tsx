import type { Metadata } from 'next';
import { WorldScreen } from './WorldScreen';
import type { DoorDestination } from '../../components/world/types';

export const metadata: Metadata = { title: 'The Agora — Gamifying the Grind' };

// Doorway → destination map. Order = north / east / west around the plaza.
const DESTINATIONS: DoorDestination[] = [
  { slug: 'self-development', name: 'Hall of Self-Development', href: '/games/g1', accent: 0xd9a84e, gameSlug: 'g1' },
  { slug: 'library', name: 'The Library', href: '/books', accent: 0x7d9fd1 },
  { slug: 'gallery', name: 'The Gallery', href: '/sculpture', accent: 0xa878d9 },
];

export default function WorldPage() {
  return <WorldScreen destinations={DESTINATIONS} />;
}
