'use client';

// Admin (/admin): game catalog editor skeleton — edit quest title/xp inline through
// the admin session (admins have write grants on catalog tables).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import type { AchievementRow, GameRow, QuestRow } from '../lib/repos/types';

export function AdminPanel({ game, quests, achievements }: { game: GameRow; quests: QuestRow[]; achievements: AchievementRow[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveQuest(q: QuestRow, patch: Partial<QuestRow>) {
    setBusy(q.id); setError(null);
    const { error: err } = await supabase.from('quests').update(patch).eq('id', q.id);
    setBusy(null);
    if (err) setError(err.message); else router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-marble">{game.title}</h2>
          <span className="text-xs uppercase tracking-wider text-shadow">{game.status} · {game.type}</span>
        </div>
      </div>

      <section className="card p-5">
        <h3 className="font-display text-lg text-marble">Quests</h3>
        <div className="mt-3 space-y-2">
          {quests.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
              <div className="min-w-0 flex-1">
                <input className="input text-sm" defaultValue={q.title}
                  onBlur={(e) => e.target.value !== q.title && saveQuest(q, { title: e.target.value })} />
                <p className="mt-1 text-xs text-shadow">{q.key} · {q.pillar} · {q.schedule.kind === 'daily' ? 'daily' : `${q.schedule.perWeek}/week`}</p>
              </div>
              <div className="w-20">
                <input className="input text-sm" type="number" min={0} defaultValue={q.xp}
                  onBlur={(e) => Number(e.target.value) !== q.xp && saveQuest(q, { xp: Number(e.target.value) })} />
                <p className="mt-1 text-center text-xs text-shadow">XP</p>
              </div>
              {busy === q.id && <span className="text-xs text-gold">saving…</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h3 className="font-display text-lg text-marble">Achievements</h3>
        <div className="mt-3 space-y-1">
          {achievements.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-line/30">
              <span className="flex-1 text-marble">{a.name}</span>
              <span className="text-xs text-shadow">{a.key} · {a.scope}{a.hidden ? ' · hidden' : ''}</span>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-[#e88]">{error}</p>}
    </div>
  );
}
