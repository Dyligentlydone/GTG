'use client';
// The landing gate: GTG clip on black, then a gold circle fades in above the
// closing emblem with the invite-code entry. A valid code unlocks the email
// step; the code rides along to /auth/callback, which claims it server-side.
import { useState, type FormEvent } from 'react';
import { createClient } from '../lib/supabase/client';
import { SocialLinks } from './SocialLinks';

type Phase = 'code' | 'email' | 'sent';

export function LandingScreen({ inviteError }: { inviteError?: string }) {
  const [gateOpen, setGateOpen] = useState(!!inviteError);
  const [phase, setPhase] = useState<Phase>('code');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(
    inviteError === 'invalid' ? 'That key has already been claimed.' : inviteError ? 'This door opens by invitation.' : '',
  );
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    const { ok } = (await res?.json().catch(() => null)) ?? { ok: false };
    setBusy(false);
    if (!ok) {
      setError('That key doesn\u2019t open the gate.');
      return;
    }
    setPhase('email');
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback?next=/world&invite=${encodeURIComponent(code.trim().toUpperCase())}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setPhase('sent');
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="relative inline-block leading-none">
        <video
          src="/gtg-clip.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration && v.currentTime >= v.duration - 1) setGateOpen(true);
          }}
          onEnded={() => setGateOpen(true)}
          onError={() => setGateOpen(true)}
          className="max-h-[56vh] max-w-[88vw] rounded-2xl border border-gold/15 shadow-[0_0_90px_rgba(201,162,39,0.12)]"
        />

        {/* gold circle gate — centered on the closing emblem */}
        <div
          className={`absolute left-1/2 top-[49%] z-10 flex h-[clamp(200px,32vh,270px)] w-[clamp(200px,32vh,270px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-gold/80 bg-black/75 text-center shadow-[0_0_70px_rgba(212,175,55,0.4)] backdrop-blur-sm transition-all duration-[2500ms] ease-out ${
            gateOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
          }`}
        >
          {phase === 'code' && (
            <form onSubmit={submitCode} className="flex w-[72%] flex-col items-center gap-2">
              <p className="label text-gold/90">invitation</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GTG-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full border-b border-gold/40 bg-transparent pb-1 text-center font-mono text-xs tracking-[0.18em] text-gold placeholder:text-gold/30 focus:outline-none"
              />
              <button type="submit" disabled={busy || !code.trim()} className="mt-1 text-[11px] font-semibold tracking-[0.3em] text-gold hover:text-marble disabled:opacity-40">
                {busy ? '…' : 'ENTER'}
              </button>
            </form>
          )}

          {phase === 'email' && (
            <form onSubmit={submitEmail} className="flex w-[72%] flex-col items-center gap-2">
              <p className="label text-gold/90">welcome</p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                className="w-full border-b border-gold/40 bg-transparent pb-1 text-center text-xs text-gold placeholder:text-gold/30 focus:outline-none"
              />
              <button type="submit" disabled={busy || !email.trim()} className="mt-1 text-[11px] font-semibold tracking-[0.3em] text-gold hover:text-marble disabled:opacity-40">
                {busy ? '…' : 'SEND LINK'}
              </button>
            </form>
          )}

          {phase === 'sent' && (
            <div className="flex w-[72%] flex-col items-center gap-2">
              <p className="font-display text-sm tracking-[0.2em] text-gold">CHECK YOUR EMAIL</p>
              <p className="text-[10px] leading-relaxed text-gold/60">Your link carries the key. Click it to step inside.</p>
            </div>
          )}

          {error && phase !== 'sent' && (
            <p className="absolute inset-x-4 bottom-[10%] text-[10px] leading-tight text-red-400">{error}</p>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <SocialLinks />
      </div>
    </div>
  );
}
