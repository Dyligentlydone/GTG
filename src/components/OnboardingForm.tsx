'use client';

// Onboarding (SPEC §10.1): handle, display name, time zone, optional location,
// face photo + consent, archetype pick — then the "vision" moment.
// Profile writes go through the user's own session (RLS column grants).
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { renderSculptureSvg, ARCHETYPES, type Archetype } from '../sculpture';
import { PILLAR_SYMBOLS } from '../sculpture/symbols';

const STEPS = ['Name', 'Place', 'Face', 'Archetype', 'Vision'] as const;

const ARCHETYPE_COPY: Record<Archetype, string> = {
  philosopher: 'Bearded, robed, scroll in hand — the thinker.',
  athlete: 'Heroic build mid-motion — the body at work.',
  warrior: 'Shield and spear, helmet pushed up — the fighter.',
  orator: 'Draped, arm raised mid-argument — the voice.',
};

export function OnboardingForm({ timeZone }: { timeZone: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/home';
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tz, setTz] = useState(timeZone);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [archetype, setArchetype] = useState<Archetype>('philosopher');
  const [seed, setSeed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vision, setVision] = useState(false);

  const zones = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone'); } catch { return [tz]; }
  }, [tz]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLon(pos.coords.longitude); setLocating(false); },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  const handleOk = /^[a-z0-9_]{3,30}$/.test(handle);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired — sign in again.');
      let facePath: string | null = null;
      if (faceFile) {
        facePath = `${user.id}/face-${Date.now()}`;
        const { error: upErr } = await supabase.storage.from('faces').upload(facePath, faceFile, { upsert: true });
        if (upErr) throw new Error(`Face upload failed: ${upErr.message}. Create a private "faces" bucket or skip the photo.`);
      }
      const update: Record<string, unknown> = {
        handle, display_name: displayName || null, time_zone: tz,
        lat, lon,
      };
      if (facePath) { update.face_photo_path = facePath; update.face_consent_at = new Date().toISOString(); }
      const { error: upErr } = await supabase.from('profiles').update(update).eq('id', user.id);
      if (upErr) throw new Error(upErr.message.includes('handle') ? 'That handle is taken — try another.' : upErr.message);
      // Archetype choice lands on the sealed sculpture (sculpture rows are service-writes).
      const res = await fetch('/api/sculpture', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archetype }),
      });
      if (!res.ok) throw new Error('Could not set your archetype.');
      const { seed: s } = (await res.json()) as { seed?: number };
      if (typeof s === 'number') setSeed(s);
      const ref = search.get('ref');
      if (ref) await fetch('/api/referrals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shareSlug: ref }) });
      setVision(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (vision) {
    const statue = renderSculptureSvg({ seed: seed ?? 1, piecesRevealed: 120, weekProgressPct: 0, archetype, idPrefix: 'vision' });
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-sm tracking-[0.3em] text-gold">THIS IS WHO YOU ARE BECOMING</p>
        <div className="mx-auto mt-4 max-w-xs" dangerouslySetInnerHTML={{ __html: statue }} />
        <p className="mt-4 text-shadow">Every week you show up, marble falls. Face last.</p>
        <button className="btn btn-primary mt-6" onClick={() => router.push(next)}>Seal it in the rock</button>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-line'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="handle">Handle (3–30 letters, digits, _)</label>
            <input id="handle" className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="your_handle" />
          </div>
          <div>
            <label className="label" htmlFor="display">Display name (optional)</label>
            <input id="display" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What statues will whisper about" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="tz">Time zone</label>
            <select id="tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Location for sunrise (optional)</span>
            {lat !== null && lon !== null
              ? <p className="text-sm text-marble">{lat.toFixed(2)}, {lon.toFixed(2)} — dawn check-ins use your real sunrise.</p>
              : <p className="text-sm text-shadow">Without it, dawn check-ins use a 6:00 fallback.</p>}
            <button type="button" className="btn mt-2" onClick={locate} disabled={locating}>
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-shadow">
            Your statue wears your face. Upload a clear selfie; it is only ever used for your own sculpture.
          </p>
          <input type="file" accept="image/*" className="input" onChange={(e) => setFaceFile(e.target.files?.[0] ?? null)} />
          <label className="flex items-start gap-2 text-sm text-marble">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I consent to my face being used to generate my statue.
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-2 gap-3">
          {ARCHETYPES.map((a) => (
            <button key={a} type="button" onClick={() => setArchetype(a)}
              className={`rounded-lg border p-4 text-left ${archetype === a ? 'border-gold bg-gold/10' : 'border-line'}`}>
              <svg width="28" height="28" viewBox="-9 -9 18 18"><path d={PILLAR_SYMBOLS.physical} fill="none" stroke={archetype === a ? '#C9A227' : '#6e6a63'} strokeWidth="1.3" /></svg>
              <p className="mt-2 font-display text-marble">{a[0]!.toUpperCase() + a.slice(1)}</p>
              <p className="mt-1 text-xs text-shadow">{ARCHETYPE_COPY[a]}</p>
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <p className="text-shadow">Ready. One last look at what the next year of mornings buys you.</p>
      )}

      {error && <p className="mt-4 text-sm text-[#e88]">{error}</p>}
      <div className="mt-6 flex justify-between">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
        {step < STEPS.length - 1
          ? <button type="button" className="btn btn-primary" disabled={step === 0 && !handleOk || step === 2 && !!faceFile && !consent} onClick={() => setStep((s) => s + 1)}>Next</button>
          : <button type="button" className="btn btn-primary" disabled={busy || (faceFile !== null && !consent)} onClick={finish}>{busy ? 'Carving…' : 'See the statue'}</button>}
      </div>
    </div>
  );
}

