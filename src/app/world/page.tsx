import type { Metadata } from 'next';
import { WorldScreen } from './WorldScreen';
import type { DoorDestination } from '../../components/world/types';

export const metadata: Metadata = { title: 'The Agora — Gamifying the Grind' };

// Doorway → destination map. Order maps to the courtyard slots: left-near,
// left-far, right-far, right-near (walking north from the entry gate).
const DESTINATIONS: DoorDestination[] = [
  { slug: 'self-development', name: 'Hall of Self-Development', href: '/games/g1', accent: 0xd9a84e, gameSlug: 'g1', sculptureHall: true },
  { slug: 'library', name: 'The Library', href: '/books', accent: 0x7d9fd1 },
  { slug: 'gallery', name: 'The Gallery', href: '/sculpture', accent: 0xa878d9 },
  { slug: 'ledger', name: 'The Ledger', href: '/ledger', accent: 0xc9a227 },
];

export default function WorldPage() {
  return <WorldScreen destinations={DESTINATIONS} />;
}
