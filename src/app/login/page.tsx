// /login — email magic link for returning members (SPEC §10.1).
// New accounts are invite-only: they enter through the landing gate at /.
import { redirect } from 'next/navigation';
import { optionalViewer } from '../../lib/viewer';
import { LoginForm } from '../../components/LoginForm';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const viewer = await optionalViewer('/login');
  if (viewer) redirect('/world');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <p className="font-display text-sm tracking-[0.35em] text-gold">GAMIFYING THE GRIND</p>
        <h1 className="mt-3 font-display text-3xl text-marble">Enter the agora</h1>
        <p className="mt-2 text-sm text-shadow">
          Returning member — your email carries you back in. New here?{' '}
          <a href="/" className="text-gold underline">The gate asks for a key.</a>
        </p>
      </div>
      <LoginForm next={params.next} error={params.error} />
    </main>
  );
}
