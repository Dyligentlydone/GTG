// Share reads/writes (SPEC §9–10).
import type { Db } from './types';

export interface PublicShare {
  public_slug: string;
  scope: string;
  template: 'light' | 'dark';
  item_refs: unknown[];
  include_journal: boolean;
  image_path: string | null;
  handle: string | null;
  display_name: string | null;
  created_at: string;
}

/** Public share lookup via the security-definer function (anon-safe). */
export async function getPublicShare(db: Db, slug: string): Promise<PublicShare | null> {
  const { data, error } = await db.rpc('get_public_share', { p_slug: slug });
  if (error) throw error;
  const rows = (data ?? []) as PublicShare[];
  return rows[0] ?? null;
}
