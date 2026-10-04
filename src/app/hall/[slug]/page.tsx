import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TempleHeader } from '../../../components/TempleHeader';
import { optionalViewer } from '../../../lib/viewer';

const HALLS: Record<string, { title: string; desc: string; accent: string }> = {
  'self-development': {
    title: 'Hall of Self-Development',
    desc: 'The founding protocol will hold court here — the nine quests, the pillars, the chisel. Its doors are still being carved.',
    accent: '#d9a84e',
  },
  library: {
    title: 'The Library',
    desc: 'Rows of scrolls awaiting your reading list. The shelves are carved; the collection arrives soon.',
    accent: '#7d9fd1',
  },
  gallery: {
    title: 'The Gallery',
    desc: 'A long hall where the marble stands under a single beam of light. The full exhibition is on its way.',
    accent: '#a878d9',
  },
};

export default async function HallPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hall = HALLS[slug];
  if (!hall) notFound();
  const viewer = await optionalViewer();
  return (
    <>
      <TempleHeader handle={viewer?.profile.handle ?? null} />
      <main className="hall-page">
        <div className="label" style={{ color: hall.accent }}>YOU STEP THROUGH THE DOORWAY</div>
        <h1 className="font-display hall-title">{hall.title}</h1>
        <p className="hall-desc">{hall.desc}</p>
        <div className="hall-actions">
          <Link href="/world" className="btn btn-primary">Return to the Agora</Link>
          <Link href="/" className="btn">Back to the lobby</Link>
        </div>
      </main>
    </>
  );
}
