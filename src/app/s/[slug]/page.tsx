// /s/[slug] — public share page (SPEC §10.1): renders the stored card, links back
// with the ref so sign-ups are credited via /api/referrals.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '../../../lib/supabase/public';
import { getPublicShare } from '../../../lib/repos/shares';
import { renderShareCardSvg } from '../../../share/cards';
import type { ShareCardModel, ShareItem } from '../../../share/model';
import type { ShareScope } from '../../../share/scopes';
import { env } from '../../../lib/env';

export const dynamic = 'force-dynamic';

async function loadModel(slug: string): Promise<{ model: ShareCardModel; variant: 'light' | 'dark' } | null> {
  const share = await getPublicShare(createPublicClient(), slug);
  if (!share || !share.handle) return null;
  const model: ShareCardModel = {
    scope: share.scope as ShareScope,
    handle: share.handle,
    ...(share.display_name ? { displayName: share.display_name } : {}),
    items: (share.item_refs ?? []) as ShareItem[],
    includeJournal: share.include_journal,
  };
  return { model, variant: share.template === 'dark' ? 'dark' : 'light' };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadModel(slug).catch(() => null);
  const appUrl = env.appUrl();
  return {
    title: found ? `@${found.model.handle} on Gamify the Grind` : 'Gamify the Grind',
    openGraph: { images: [`${appUrl}/api/share/${slug}/image`] },
  };
}

export default async function PublicSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await loadModel(slug).catch(() => null);
  if (!found) notFound();
  const { model, variant } = found;
  const svg = renderShareCardSvg(model, { variant, idPrefix: 'public' });
  const joinUrl = `/login?next=${encodeURIComponent(`/onboarding?ref=${slug}`)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="w-full overflow-hidden rounded-xl border border-line" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="text-center">
        <p className="font-display text-xl text-marble">@{model.handle} is carving a statue out of their daily grind.</p>
        <p className="mt-1 text-sm text-shadow">120 pieces of marble. One week at a time. Face last.</p>
        <Link href={joinUrl} className="btn btn-primary mt-5">Start your own statue</Link>
      </div>
    </main>
  );
}
