// Invite helpers shared by /api/invite and /auth/callback.

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function makeInviteCode(): string {
  const h = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return `GTG-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}
