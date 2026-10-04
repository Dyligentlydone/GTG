'use client';

// Chisel Day countdown: time until next Monday 00:00 in the player's time zone.
import { useEffect, useState } from 'react';

function nextChiselUtc(timeZone: string): number {
  // Find the next instant that is Monday 00:00 local. Check midnight candidates day by day.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const day = new Date(now.getTime() + i * 86_400_000);
    const parts = fmt.formatToParts(day);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    if (get('weekday') === 'Mon' && i > 0) {
      // Monday local date → its 00:00 in the zone.
      return zonedMidnightUtc(`${get('year')}-${get('month')}-${get('day')}`, timeZone);
    }
  }
  return now.getTime();
}

function zonedMidnightUtc(date: string, timeZone: string): number {
  // Iterate: shift `guess` by the gap between the desired local wall time (midnight on
  // `date`) and the wall time `guess` actually lands on in the zone.
  const target = Date.parse(`${date}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    const hour = get('hour') === '24' ? '00' : get('hour');
    const wallMs = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`);
    guess += target - wallMs;
  }
  return guess;
}

export function ChiselCountdown({ timeZone }: { timeZone?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = nextChiselUtc(timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timeZone]);

  if (left === null) return <span className="text-shadow">…</span>;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <span className="font-display text-lg tabular-nums text-gold">
      {d > 0 ? `${d}d ` : ''}{h}h {m}m
    </span>
  );
}
