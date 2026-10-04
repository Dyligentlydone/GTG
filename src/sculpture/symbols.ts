// Pillar emblems: small stroked SVG paths centred on (0, 0), about 14 units across.
// Shared by the sculpture's plinth symbols and the share cards.
import type { PillarId } from '../core/types';

export const PILLAR_ORDER: readonly PillarId[] = ['mental', 'physical', 'emotional', 'spiritual', 'financial', 'social', 'environmental', 'recreational'] as const;
export const PILLAR_SYMBOLS: Record<PillarId, string> = {
  mental: 'M-7 -4 Q-3.5 -6 0 -4 Q3.5 -6 7 -4 L7 5 Q3.5 3 0 5 Q-3.5 3 -7 5 Z M0 -4 L0 5',
  physical: 'M2 -7 L-4 1 L0 1 L-2 7 L4 -1 L0 -1 Z',
  emotional: 'M0 6 C-8 0 -7 -6 -3.5 -6 C-1.5 -6 0 -4.5 0 -3 C0 -4.5 1.5 -6 3.5 -6 C7 -6 8 0 0 6 Z',
  spiritual: 'M0 -3 A3 3 0 1 1 0 3 A3 3 0 1 1 0 -3 M0 -7 L0 -5 M0 5 L0 7 M-7 0 L-5 0 M5 0 L7 0 M-5 -5 L-3.6 -3.6 M5 5 L3.6 3.6 M5 -5 L3.6 -3.6 M-5 5 L-3.6 3.6',
  financial: 'M4 -4.6 C2 -6.8 -3.2 -6.8 -4.4 -4.2 C-5.5 -1.8 -2.5 -0.9 -0.2 -0.2 C2.2 0.5 5.2 1.5 4.6 4 C4 6.6 -3 7 -4.8 4.6 M0 -8 L0 8',
  social: 'M-2.5 -3.5 A3.5 3.5 0 1 1 -2.5 3.5 A3.5 3.5 0 1 1 -2.5 -3.5 M2.5 -3.5 A3.5 3.5 0 1 1 2.5 3.5 A3.5 3.5 0 1 1 2.5 -3.5',
  environmental: 'M-6 5 C-6 -3 0 -7 6 -6 C6 1 1 6 -6 5 Z M-6 5 L3 -3',
  recreational: 'M-4 6 L4 6 M-4 6 C-7 0 -6 -5 -3 -7 M4 6 C7 0 6 -5 3 -7 M-2 -3 L-2 5 M0 -3 L0 5 M2 -3 L2 5 M-4 -3 L4 -3',
};

