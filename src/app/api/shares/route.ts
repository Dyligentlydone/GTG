// POST /api/shares: builds + stores a share and awards share XP (+5, once per local day).
// Items are re-derived server-side from the player's own rows (loadShareCandidates) and
// re-validated through buildShareCardModel — a crafted body can't fabricate card content
// or smuggle journal text onto a public card.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { buildShareCardModel, isShareScope, suggestedPostText, xIntentUrl } from '../../../share';
import { localDate, shareXpEvent } from '../../../core';
import { loadProfile, loadXpEvents } from '../../../lib/repos/players';
import { loadShareCandidates } from '../../../lib/shareItems';
import { env } from '../../../lib/env';

function slug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Sign in first.' }, { status: 401 });

  let body: { scope?: unknown; itemIds?: unknown; includeJournal?: unknown; template?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Bad request.' }, { status: 400 });
  }
  if (!isShareScope(body.scope) || !Array.isArray(body.itemIds)) {
    return NextResponse.json({ ok: false, reason: 'Bad request.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const profile = await loadProfile(admin, user.id);
  if (!profile?.handle) return NextResponse.json({ ok: false, reason: 'Set a handle first.' }, { status: 422 });

  const candidates = await loadShareCandidates(admin, user.id);
  const eligible = (candidates[body.scope] ?? []).map((c) => c.item);
  const built = buildShareCardModel({
    scope: body.scope,
    handle: profile.handle,
    ...(profile.display_name ? { displayName: profile.display_name } : {}),
    items: eligible,
    selectedIds: body.itemIds.map(String),
    includeJournal: body.includeJournal === true,
  });
  if (!built.ok) return NextResponse.json(built, { status: 422 });

  const template = body.template === 'dark' ? 'dark' : 'light';
  const publicSlug = slug();
  const { data: share, error } = await admin.from('shares').insert({
    user_id: user.id,
    scope: built.model.scope,
    item_refs: built.model.items,
    template,
    include_journal: built.model.includeJournal,
    public_slug: publicSlug,
  }).select('id').single();
  if (error) throw error;

  // Share XP: +5, once per local day (idempotency key makes this retry-safe).
  const today = localDate(new Date(), profile.time_zone);
  const existing = await loadXpEvents(admin, user.id);
  const ev = shareXpEvent(user.id, share!.id as string, today, existing);
  if (ev) {
    const { error: e } = await admin.from('xp_events').insert({
      user_id: ev.userId, source_type: ev.sourceType, source_id: ev.sourceId,
      amount: ev.amount, idempotency_key: ev.idempotencyKey,
    });
    if (e && e.code !== '23505') throw e;
  }

  const url = `${env.appUrl()}/s/${publicSlug}`;
  const text = suggestedPostText(built.model);
  return NextResponse.json({ ok: true, slug: publicSlug, url, text, intentUrl: xIntentUrl({ text, url }), xpAwarded: ev ? 5 : 0 });
}
