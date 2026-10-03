'use client';

// Settings (/settings): profile fields, wake window, pause days, face photo removal,
// account deletion (the dangerous one goes through /api/account so the service role
// can clean up server-side rows).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { localDate } from '../core/time';
import type { ProfileRow } from '../lib/repos/types';

export function SettingsPanels({ profile, pausedDates }: { profile: ProfileRow; pausedDates: string[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [handle, setHandle] = useState(profile.handle ?? '');
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [timeZone, setTimeZone] = useState(profile.time_zone);
  const [wakeStart, setWakeStart] = useState(profile.custom_wake_start?.slice(0, 5) ?? '');
  const [wakeEnd, setWakeEnd] = useState(profile.custom_wake_end?.slice(0, 5) ?? '');
  const [paused, setPaused] = useState<Set<string>>(new Set(pausedDates));
  const [confirmDelete, setConfirmDelete] = useState('');

  const today = localDate(new Date(), profile.time_zone);
  const upcoming = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setError(null);
    const { error: err } = await supabase.from('profiles').update({
      handle: handle || null, display_name: displayName || null, time_zone: timeZone,
      custom_wake_start: wakeStart || null, custom_wake_end: wakeEnd || null,
    }).eq('id', profile.id);
    setBusy(false);
    if (err) setError(err.message.includes('handle') ? 'That handle is taken.' : err.message);
    else { setMsg('Saved.'); router.refresh(); }
  }

  async function togglePause(date: string) {
    const next = new Set(paused);
    if (next.has(date)) next.delete(date); else next.add(date);
    setPaused(next);
    if (next.has(date)) {
      await supabase.from('paused_days').insert({ user_id: profile.id, local_date: date });
    } else {
      await supabase.from('paused_days').delete().eq('user_id', profile.id).eq('local_date', date);
    }
  }

  async function removeFace() {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('profiles').update({ face_photo_path: null, face_consent_at: null }).eq('id', profile.id);
    if (err) setError(err.message);
    else if (profile.face_photo_path) await supabase.storage.from('faces').remove([profile.face_photo_path]);
    setBusy(false);
    if (!err) { setMsg('Face photo removed.'); router.refresh(); }
  }

  async function deleteAccount() {
    setBusy(true); setError(null);
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (!res.ok) { setError('Could not delete the account — try again.'); setBusy(false); return; }
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-marble">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="handle">Handle</label>
            <input id="handle" className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} />
          </div>
          <div>
            <label className="label" htmlFor="display">Display name</label>
            <input id="display" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="tz">Time zone</label>
            <input id="tz" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="wake1">Wake from</label>
              <input id="wake1" className="input" type="time" value={wakeStart} onChange={(e) => setWakeStart(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="wake2">Wake until</label>
              <input id="wake2" className="input" type="time" value={wakeEnd} onChange={(e) => setWakeEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>

      <section className="card p-5">
        <h2 className="font-display text-lg text-marble">Pause days</h2>
        <p className="mt-1 text-sm text-shadow">Paused days don't count against streaks or weekly due. Tap days to pause them.</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {upcoming.map((d) => (
            <button key={d} type="button" onClick={() => togglePause(d)}
              className={`rounded-md border px-1 py-2 text-xs ${paused.has(d) ? 'border-gold bg-gold/15 text-gold' : 'border-line text-shadow'}`}>
              <span className="block">{d.slice(5)}</span>
              <span className="block opacity-60">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg text-marble">Face photo</h2>
        {profile.face_photo_path
          ? <p className="mt-1 text-sm text-shadow">A face photo is on file for your statue.</p>
          : <p className="mt-1 text-sm text-shadow">No face photo on file.</p>}
        {profile.face_photo_path && (
          <button type="button" className="btn mt-3" disabled={busy} onClick={removeFace}>Remove photo & consent</button>
        )}
      </section>

      <section className="card border-[#5a2e2e] p-5">
        <h2 className="font-display text-lg text-[#e88]">Delete account</h2>
        <p className="mt-1 text-sm text-shadow">Marks the profile deleted and wipes progress rows. Shares you made go dark. Type <span className="font-mono text-marble">delete</span> to confirm.</p>
        <div className="mt-3 flex gap-2">
          <input className="input w-40" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="delete" />
          <button type="button" className="btn border-[#5a2e2e] text-[#e88]" disabled={confirmDelete !== 'delete' || busy} onClick={deleteAccount}>
            Delete forever
          </button>
        </div>
      </section>

      {msg && <p className="text-sm text-gold">{msg}</p>}
      {error && <p className="text-sm text-[#e88]">{error}</p>}
    </div>
  );
}
