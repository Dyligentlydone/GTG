'use client';
// Social row for the landing gate. Icons always render; hrefs come from the
// NEXT_PUBLIC_SOCIAL_* env vars — until set, the icon is a dead placeholder.
import { FaInstagram, FaFacebookF, FaYoutube, FaXTwitter, FaDiscord } from 'react-icons/fa6';

const LINKS = [
  { label: 'Instagram', Icon: FaInstagram, href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { label: 'Facebook', Icon: FaFacebookF, href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
  { label: 'YouTube', Icon: FaYoutube, href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
  { label: 'X', Icon: FaXTwitter, href: process.env.NEXT_PUBLIC_SOCIAL_X },
  { label: 'Discord', Icon: FaDiscord, href: process.env.NEXT_PUBLIC_SOCIAL_DISCORD },
] as const;

export function SocialLinks() {
  return (
    <nav className="pointer-events-auto flex items-center gap-5">
      {LINKS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href ?? '#'}
          onClick={href ? undefined : (e) => e.preventDefault()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={`transition-colors ${href ? 'text-gold/45 hover:text-gold' : 'cursor-default text-gold/25'}`}
        >
          <Icon size={19} />
        </a>
      ))}
    </nav>
  );
}
