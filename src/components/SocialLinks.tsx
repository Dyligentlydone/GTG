'use client';
// Social row for the landing gate. Each icon only renders when its
// NEXT_PUBLIC_* env var is set — add the URLs in Railway when ready.
import { FaInstagram, FaFacebookF, FaYoutube, FaXTwitter, FaDiscord } from 'react-icons/fa6';

const LINKS = [
  { label: 'Instagram', Icon: FaInstagram, href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { label: 'Facebook', Icon: FaFacebookF, href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
  { label: 'YouTube', Icon: FaYoutube, href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
  { label: 'X', Icon: FaXTwitter, href: process.env.NEXT_PUBLIC_SOCIAL_X },
  { label: 'Discord', Icon: FaDiscord, href: process.env.NEXT_PUBLIC_SOCIAL_DISCORD },
] as const;

export function SocialLinks() {
  const links = LINKS.filter((l) => l.href);
  if (links.length === 0) return null;
  return (
    <nav className="pointer-events-auto flex items-center gap-5">
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-gold/45 transition-colors hover:text-gold"
        >
          <Icon size={19} />
        </a>
      ))}
    </nav>
  );
}
