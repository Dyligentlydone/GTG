// / — the landing gate. Visitors get the GTG clip on black, then a gold-circle
// invite-code entry; signed-in players are sent straight into the world.
// The old lobby (sculpture, games, rank) now lives at /profile.
import { redirect } from 'next/navigation';
import { optionalViewer } from '../lib/viewer';
import { LandingScreen } from '../components/LandingScreen';

export const dynamic = 'force-dynamic';

export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await optionalViewer('/');
  if (viewer) redirect('/world');
  const params = await searchParams;
  return <LandingScreen inviteError={params.invite} />;
}
