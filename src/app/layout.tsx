import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Gamifying the Grind', template: '%s · Gamifying the Grind' },
  description: 'Turn the daily grind into a marble statue. Quests, streaks, XP — and a block of marble that reveals you, one piece at a time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
