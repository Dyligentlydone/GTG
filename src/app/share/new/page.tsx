// /share/new — the share sheet (SPEC §10.1): real candidates derived server-side,
// live client-side card preview, save → X intent.
import { requireViewer } from '../../../lib/viewer';
import { loadShareCandidates } from '../../../lib/shareItems';
import { env } from '../../../lib/env';
import { TempleHeader } from '../../../components/TempleHeader';
import { ShareSheet } from '../../../components/ShareSheet';

export const metadata = { title: 'Share' };
export const dynamic = 'force-dynamic';

export default async function ShareNewPage() {
  const { supabase, user, profile } = await requireViewer('/share/new');
  const candidates = await loadShareCandidates(supabase, user.id);
  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl text-marble">Share a card</h1>
        <p className="mb-6 mt-1 text-sm text-shadow">
          Cards are rendered from real rows — nothing goes out that didn't happen. +5 XP once a day.
        </p>
        <ShareSheet
          candidatesByScope={candidates}
          handle={profile.handle ?? ''}
          displayName={profile.display_name ?? undefined}
          appUrl={env.appUrl()}
        />
      </main>
    </div>
  );
}
