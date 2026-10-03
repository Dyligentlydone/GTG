// GET /api/share/[slug]/image (SPEC §10.2): the share card for link previews.
// Returns the SVG directly (the spec's option); swap for a PNG via next/og ImageResponse
// if a crawler needs raster.
import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient } from '../../../../../lib/supabase/public';
import { getPublicShare } from '../../../../../lib/repos/shares';
import { buildShareCardModel, renderShareCardSvg, isShareScope, type ShareItem } from '../../../../../share';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getPublicShare(createPublicClient(), slug);
  if (!share || !isShareScope(share.scope) || !share.handle) {
    return new NextResponse('Not found', { status: 404 });
  }
  // Items were validated at creation; re-building keeps the pillar derivation consistent.
  const items = share.item_refs as ShareItem[];
  const built = buildShareCardModel({
    scope: share.scope, handle: share.handle, displayName: share.display_name ?? undefined,
    items, selectedIds: items.map((i) => i.id), includeJournal: share.include_journal,
  });
  if (!built.ok) return new NextResponse('Not found', { status: 404 });
  const svg = renderShareCardSvg(built.model, { variant: share.template, idPrefix: `c${share.public_slug}` });
  return new NextResponse(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=300, immutable' },
  });
}
