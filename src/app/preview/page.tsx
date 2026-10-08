// /preview — dev-only mock of the signed-in lobby so the experience can be seen
// without a Supabase project. Renders 404 in production.
import { notFound } from 'next/navigation';
import { LobbyView } from '../../components/LobbyView';
import type { SculptureRow } from '../../lib/repos/types';

export const metadata = { title: 'Lobby preview' };
export const dynamic = 'force-dynamic';

const MOCK_SCULPTURE: SculptureRow = {
  id: 'preview', user_id: 'preview', archetype: 'philosopher', seed: 7,
  pieces_total: 875, pieces_revealed: 340, pieces_earned: 345, status: 'carving',
  final_image_path: null, rough_image_path: null, completed_at: null,
};

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <LobbyView
      handle="preview"
      litPillars={['mental', 'physical', 'emotional']}
      sculpture={MOCK_SCULPTURE}
      decorations={[{ type: 'laurel_leaf', count: 2 }, { type: 'gold_vein', count: 1 }]}
      carvingWeekPct={0.62}
      recentChisel={5} // pretend a Chisel Day just landed — watch the pieces fall
      timeZone="America/New_York"
      hallHref="/preview"
      hallLabel="enter the hall →"
      level={{ level: 4, xpIntoLevel: 340, xpForNext: 600 }}
      games={[
        { slug: 'g1', title: 'Self-Development', badge: 'carves the marble', href: '/preview', doneToday: 4, dueToday: 6, weekPct: 62 },
        { slug: 'g2', title: 'The Iron Path', badge: 'free', href: '/preview', doneToday: 2, dueToday: 3, weekPct: 40 },
      ]}
      discover={[{ slug: 'g3', title: 'Ledger of the Deep', type: 'earning', cta: 'signin' }]}
    />
  );
}
