'use client';
// Ledger row share button: creates a public share for this completion, then
// offers platform intents (X / Facebook / LinkedIn / WhatsApp), copy link, and
// the SVG card download. The server re-derives card content — nothing private
// (journal text, payloads) can leak onto a public card.
import { useEffect, useRef, useState } from 'react';
import { FaXTwitter, FaFacebookF, FaLinkedinIn, FaWhatsapp, FaLink, FaImage } from 'react-icons/fa6';
import { postLengthWithUrl } from '../share/intent';

interface Saved { url: string; text: string; slug: string; }

const SLOGAN = 'Turn the grind into the game.';

/** Brand-voiced post body: quest, what the player actually wrote, XP, slogan. */
function postText(title: string, xp: number, detail: string, url: string): string {
  const tail = `+${xp} XP · ${SLOGAN} #GamifyingTheGrind`;
  const full = (d: string) => (d ? `${title} — ${d}\n${tail}` : `${title}\n${tail}`);
  const d = detail.trim();
  if (postLengthWithUrl(full(d), url) <= 280) return full(d);
  const words = d.split(' ');
  while (words.length && postLengthWithUrl(full(`${words.join(' ')}…`), url) > 280) words.pop();
  return full(words.length ? `${words.join(' ')}…` : '');
}

export function LedgerShareButton({ completionId, title, xp, detail }: {
  completionId: string; title: string; xp: number; detail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<Saved | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || share || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope: 'quest', itemIds: [completionId] }),
      });
      const data = (await res.json()) as { url?: string; text?: string; slug?: string; reason?: string; error?: string };
      if (!res.ok || !data.url || !data.slug) throw new Error(data.reason ?? data.error ?? 'Could not create the share.');
      setShare({ url: data.url, text: data.text ?? '', slug: data.slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const openIntent = (href: string) => window.open(href, '_blank', 'noopener');
  const enc = encodeURIComponent;
  const text = share ? postText(title, xp, detail ?? '', share.url) : '';
  const platforms = share
    ? [
        { label: 'X', Icon: FaXTwitter, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(share.url)}` },
        { label: 'Facebook', Icon: FaFacebookF, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(share.url)}` },
        { label: 'LinkedIn', Icon: FaLinkedinIn, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(share.url)}` },
        { label: 'WhatsApp', Icon: FaWhatsapp, href: `https://wa.me/?text=${enc(`${text} ${share.url}`)}` },
      ]
    : [];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-[11px] font-semibold tracking-[0.2em] text-shadow hover:text-gold"
      >
        SHARE
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-44 p-1.5" role="menu">
          {busy && <p className="px-3 py-2 text-xs text-shadow">Forging the card…</p>}
          {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}
          {share && (
            <>
              {platforms.map(({ label, Icon, href }) => (
                <button key={label} type="button" role="menuitem" onClick={() => { openIntent(href); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-sm text-shadow hover:bg-line/40 hover:text-marble">
                  <Icon size={13} /> {label}
                </button>
              ))}
              <button type="button" role="menuitem"
                onClick={() => { void navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-sm text-shadow hover:bg-line/40 hover:text-marble">
                <FaLink size={13} /> {copied ? 'Copied' : 'Copy link'}
              </button>
              <a role="menuitem" href={`/api/share/${share.slug}/image`} download={`gtg-${share.slug}.svg`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-sm text-shadow hover:bg-line/40 hover:text-marble">
                <FaImage size={13} /> Save card
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
