'use client';
// Ambient overlay for the lobby: a drifting marble-dust particle field (2D canvas)
// plus a film-grain layer handled in CSS. Fixed, pointer-events-none, and silent
// for prefers-reduced-motion. ~40 particles — cheap enough to run everywhere.
import { useEffect, useRef } from 'react';

interface Mote { x: number; y: number; r: number; vx: number; vy: number; o: number; }

export function AmbientLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const motes: Mote[] = [];
    const spawn = (anywhere: boolean): Mote => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 4,
      r: 0.4 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(0.05 + Math.random() * 0.15),
      o: 0.08 + Math.random() * 0.22,
    });
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    for (let i = 0; i < 42; i++) motes.push(spawn(true));
    window.addEventListener('resize', resize);

    let raf = 0;
    const tick = () => {
      if (document.hidden) { raf = requestAnimationFrame(tick); return; }
      ctx.clearRect(0, 0, w, h);
      for (const [i, m] of motes.entries()) {
        m.x += m.vx + Math.sin((m.y + i * 37) * 0.004) * 0.06;
        m.y += m.vy;
        if (m.y < -6 || m.x < -6 || m.x > w + 6) motes[i] = spawn(false);
        ctx.globalAlpha = m.o;
        ctx.fillStyle = '#e8e2d4';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40" />
      <div aria-hidden className="grain pointer-events-none fixed inset-0 z-40" />
    </>
  );
}
