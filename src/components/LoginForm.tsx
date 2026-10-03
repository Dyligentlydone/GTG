'use client';

// Email magic link (SPEC §10.1 /login).
import { useState } from 'react';
import { createClient } from '../lib/supabase/client';

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(error ?? null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const redirect = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    });
    setBusy(false);
    if (err) setMsg(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-xl text-gold">Check your email</p>
        <p className="mt-2 text-sm text-shadow">We sent a magic link to {email}. It opens this app.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      {msg && <p className="text-sm text-[#e88]">{msg}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={busy}>
        {busy ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
