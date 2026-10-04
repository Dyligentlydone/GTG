'use client';

// Join/leave a game via /api/enroll.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EnrollButton({ gameSlug, enrolled }: { gameSlug: string; enrolled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/enroll', {
      method: enrolled ? 'DELETE' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameSlug }),
    });
    setBusy(false);
    if (!res.ok) { setError('Something went wrong — try again.'); return; }
    if (!enrolled) router.push(`/games/${gameSlug}`);
    else router.refresh();
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" className={enrolled ? 'btn text-xs' : 'btn btn-primary'} disabled={busy} onClick={act}>
        {busy ? '…' : enrolled ? 'Leave' : 'Enter the game'}
      </button>
      {error && <span className="mt-1 text-xs text-[#e88]">{error}</span>}
    </span>
  );
}
