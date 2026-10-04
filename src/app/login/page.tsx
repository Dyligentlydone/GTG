// /login — email magic link (SPEC §10.1).
import { Suspense } from 'react';
import { LoginForm } from '../../components/LoginForm';

export const metadata = { title: 'Sign in' };

function Form({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  return <LoginForm next={searchParams.next} error={searchParams.error} />;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <p className="font-display text-sm tracking-[0.35em] text-gold">GAMIFYING THE GRIND</p>
        <h1 className="mt-3 font-display text-3xl text-marble">Enter the agora</h1>
        <p className="mt-2 text-sm text-shadow">Magic link only — no passwords in the temple.</p>
      </div>
      <Suspense fallback={<div className="card p-6 text-center text-shadow">Loading…</div>}>
        <Form searchParams={params} />
      </Suspense>
    </main>
  );
}
