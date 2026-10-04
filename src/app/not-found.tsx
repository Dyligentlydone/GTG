import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-4xl text-gold">404</p>
      <p className="text-shadow">This marble slab doesn't exist.</p>
      <Link href="/" className="btn">Back to the board</Link>
    </main>
  );
}
