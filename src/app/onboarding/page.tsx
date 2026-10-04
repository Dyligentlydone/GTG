// /onboarding — name, place, face, archetype, then the vision moment.
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { loadProfile } from '../../lib/repos/players';
import { OnboardingForm } from '../../components/OnboardingForm';

export const metadata = { title: 'Onboarding' };

async function Inner({ ref }: { ref?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding';
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const profile = await loadProfile(supabase, user.id);
  if (profile?.handle) redirect('/world'); // already onboarded — straight to the agora
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || profile?.time_zone || 'UTC';
  return <OnboardingForm timeZone={tz} />;
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ref = params.ref;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <p className="font-display text-sm tracking-[0.35em] text-gold">GAMIFY THE GRIND</p>
        <h1 className="mt-3 font-display text-3xl text-marble">Claim your marble</h1>
      </div>
      <Suspense fallback={<div className="card p-6 text-center text-shadow">Loading…</div>}>
        <Inner ref={ref} />
      </Suspense>
    </main>
  );
}
