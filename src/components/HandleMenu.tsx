'use client';
// @handle dropdown: Profile / Settings. Replaces the old plain link.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function HandleMenu({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-gold hover:text-marble"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        @{handle}
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-32 p-1 text-left" role="menu">
          <Link href="/profile" onClick={() => setOpen(false)} role="menuitem"
            className="block rounded-sm px-3 py-1.5 text-sm text-shadow hover:text-marble hover:bg-line/40">
            Profile
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} role="menuitem"
            className="block rounded-sm px-3 py-1.5 text-sm text-shadow hover:text-marble hover:bg-line/40">
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
