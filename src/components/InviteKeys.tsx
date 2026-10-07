'use client';
import { useState } from 'react';

export function InviteKeys({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <ul className="mt-3 space-y-2">
      {codes.map((code) => (
        <li key={code} className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm tracking-[0.18em] text-gold">{code}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(code);
              setCopied(code);
              setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
            }}
            className="text-[11px] font-semibold tracking-[0.25em] text-shadow hover:text-gold"
          >
            {copied === code ? 'COPIED' : 'COPY'}
          </button>
        </li>
      ))}
    </ul>
  );
}
