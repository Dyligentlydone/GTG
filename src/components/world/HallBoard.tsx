'use client';
// Hall interior for a game: the live quest board rendered as marble shrines.
// Each shrine is a pedestal with a floating canvas panel (glyph, title, week
// pips, streak, state) and a proximity sensor that retargets the E prompt to
// that quest's check-in page. A frieze on the back wall shows the week total
// and the eight pillars. Data comes from /api/board/[slug].
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { PILLAR_ORDER, PILLAR_SYMBOLS } from '../../sculpture/symbols';
import type { PillarId } from '../../core/types';
import type { DoorDestination } from './types';

interface QuestPanel {
  id: string; title: string; pillar: PillarId; xp: number; cadence: string;
  state: 'done' | 'due' | 'locked' | 'weekDone' | 'rest';
  weekDone: number; weekDue: number; streak: number; streakUnit: 'day' | 'week';
}

interface BoardData {
  title: string; dayLabel: string; weekDone: number; weekDue: number;
  litPillars: PillarId[]; quests: QuestPanel[];
}

const FLOOR = 0.75;
const STATE_COLOR: Record<QuestPanel['state'], string> = {
  due: '#C9A227', done: '#7da87d', weekDone: '#8a8578', rest: '#6e6a63', locked: '#55504a',
};
const STATE_WORD: Record<QuestPanel['state'], string> = {
  due: 'DUE TODAY', done: 'DONE', weekDone: 'DONE THIS WEEK', rest: 'REST DAY', locked: 'LOCKED',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 3) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; lines++;
      if (lines >= maxLines - 1) { ctx.fillText(t.length > 34 ? `${t.slice(0, 33)}…` : t, x, y); return; }
      line = w;
    } else line = t;
  }
  ctx.fillText(line, x, y);
}

function marbleBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#221e19'); g.addColorStop(1, '#17140f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = 'rgba(200,190,170,0.05)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, 0);
    ctx.bezierCurveTo(Math.random() * w, h * 0.3, Math.random() * w, h * 0.7, Math.random() * w, h);
    ctx.stroke();
  }
}

function questTexture(q: QuestPanel): THREE.CanvasTexture {
  const w = 512, h = 360;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  marbleBg(ctx, w, h);
  const accent = STATE_COLOR[q.state];

  ctx.strokeStyle = accent; ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.save();
  ctx.translate(58, 62); ctx.scale(4.4, 4.4);
  ctx.strokeStyle = q.state === 'due' || q.state === 'done' ? '#C9A227' : '#7a7468';
  ctx.lineWidth = 0.34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(PILLAR_SYMBOLS[q.pillar]));
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = q.state === 'done' ? '#b8b2a4' : '#e8e2d5';
  ctx.font = '600 27px Cinzel, Georgia, serif';
  wrap(ctx, q.title, 112, 58, w - 140, 32);

  ctx.font = '19px Inter, Georgia, serif';
  ctx.fillStyle = '#9a958a';
  ctx.fillText(`+${q.xp} XP · ${q.cadence}`, 32, h - 118);

  ctx.font = '600 17px Cinzel, Georgia, serif';
  ctx.fillStyle = accent;
  ctx.fillText(STATE_WORD[q.state], 32, h - 88);

  const pipY = h - 50;
  for (let i = 0; i < q.weekDue; i++) {
    ctx.beginPath(); ctx.arc(40 + i * 26, pipY, 8, 0, Math.PI * 2);
    if (i < q.weekDone) { ctx.fillStyle = '#C9A227'; ctx.fill(); }
    else { ctx.strokeStyle = '#5a544a'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  if (q.streak > 0) {
    ctx.textAlign = 'right';
    ctx.font = '600 22px Cinzel, Georgia, serif';
    ctx.fillStyle = '#C9A227';
    ctx.fillText(`${q.streak}${q.streakUnit === 'week' ? 'w' : 'd'} streak`, w - 30, pipY + 7);
    ctx.textAlign = 'left';
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function friezeTexture(d: BoardData): THREE.CanvasTexture {
  const w = 1024, h = 288;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  marbleBg(ctx, w, h);
  ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.textAlign = 'center';
  ctx.font = '600 34px Cinzel, Georgia, serif';
  ctx.fillStyle = '#e8e2d5';
  ctx.fillText(d.title.toUpperCase(), w / 2, 68);
  ctx.font = '20px Inter, Georgia, serif';
  ctx.fillStyle = '#9a958a';
  ctx.fillText(`${d.dayLabel} · ${d.weekDone}/${d.weekDue} due this week`, w / 2, 106);

  const lit = new Set(d.litPillars);
  PILLAR_ORDER.forEach((p, i) => {
    ctx.save();
    ctx.translate(172 + i * 97, 200); ctx.scale(5.4, 5.4);
    ctx.strokeStyle = lit.has(p) ? '#C9A227' : '#4a463f';
    ctx.lineWidth = 0.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(PILLAR_SYMBOLS[p]));
    ctx.restore();
  });
  ctx.font = '14px Inter, Georgia, serif';
  ctx.fillStyle = '#6e6a63';
  ctx.fillText('walk to a shrine · press E to check in', w / 2, 264);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const SHRINE_XS = [-3.3, -1.1, 1.1, 3.3];
const SHRINE_ZS = [-1.0, 2.3];

export function HallBoard({ gameSlug, destination, onDoorChange }: {
  gameSlug: string;
  destination: DoorDestination;
  onDoorChange: (d: DoorDestination | null) => void;
}) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const marble = useMemo(() => marbleMaterial([226, 219, 205], [148, 140, 128], 4, 0.5), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${gameSlug}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) setBoard(data as BoardData);
    } catch { /* world still renders without the board */ }
  }, [gameSlug]);

  useEffect(() => {
    load();
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFocus);
    document.fonts?.ready.then(() => setFontReady(true));
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  const questTex = useMemo(() => board?.quests.map(questTexture) ?? [], [board, fontReady]);
  const friezeTex = useMemo(() => (board ? friezeTexture(board) : null), [board, fontReady]);
  useEffect(() => () => {
    questTex.forEach((t) => t.dispose());
    friezeTex?.dispose();
  }, [questTex, friezeTex]);

  return (
    <group>
      {/* back-wall frieze — the week at a glance */}
      {friezeTex && (
        <mesh position={[0, FLOOR + 3.35, 5.85]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[7.4, 2.08]} />
          <meshBasicMaterial map={friezeTex} />
        </mesh>
      )}

      {board?.quests.map((q, i) => {
        const x = SHRINE_XS[i % 4]!;
        const z = SHRINE_ZS[Math.floor(i / 4)]!;
        return (
          <group key={q.id} position={[x, 0, z]}>
            {/* pedestal — solid */}
            <mesh material={marble} position={[0, FLOOR + 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 0.6, 0.62]} />
            </mesh>
            <mesh material={marble} position={[0, FLOOR + 0.66, 0]} castShadow>
              <boxGeometry args={[0.5, 0.14, 0.5]} />
            </mesh>
            {/* floating panel — unlit canvas so it reads inside the cella */}
            {questTex[i] && (
              <mesh position={[0, FLOOR + 1.62, 0]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[1.3, 0.92]} />
                <meshBasicMaterial map={questTex[i]} />
              </mesh>
            )}
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.31, 0.45, 0.31]} position={[0, FLOOR + 0.45, 0]} />
              <CuboidCollider
                sensor
                args={[0.85, 1.7, 0.85]}
                position={[0, FLOOR + 1.5, 0]}
                onIntersectionEnter={() => onDoorChange({ slug: q.id, name: q.title, href: `/games/${gameSlug}/quest/${q.id}`, accent: destination.accent })}
                onIntersectionExit={() => onDoorChange(destination)}
              />
            </RigidBody>
          </group>
        );
      })}
    </group>
  );
}
