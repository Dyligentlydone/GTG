'use client';
// Hall interior for a game: the live quest board rendered as wall shrines.
// The side walls split like the wheel — the LEFT wall (from the door) holds
// the external pillars (money, connect, reset, play), the RIGHT wall the
// internal ones (read, exercise, journal, stillness). Each panel is a canvas
// slab (glyph, title, XP, week pips, streak, state) that is clickable while
// pointer-locked — aim the crosshair, click or press E, and the check-in
// opens in-world. A frieze on the back wall shows the week + pillars.
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { marbleMaterial } from '../../lib/three/materials';
import { PILLAR_ORDER, PILLAR_SYMBOLS } from '../../sculpture/symbols';
import type { PillarId, ProofSpec } from '../../core/types';
import type { DoorDestination, QuestTarget } from './types';

interface QuestPanel {
  id: string; title: string; description?: string; why?: string;
  pillar: PillarId; xp: number; cadence: string;
  state: 'done' | 'due' | 'locked' | 'weekDone' | 'rest';
  activeToday: boolean; proof: ProofSpec;
  weekDone: number; weekDue: number; streak: number; streakUnit: 'day' | 'week';
}

interface BoardData {
  title: string; dayLabel: string; weekDone: number; weekDue: number;
  litPillars: PillarId[]; touchedPillars: PillarId[];
  books: { id: string; title: string }[]; quests: QuestPanel[];
}

const FLOOR = 0.75;
// Cella side walls sit at |x| = 4.25 with their inner face at 4.0 — panels
// float just off the face. Walking in (+z), the player's LEFT is local +x.
const WALL_X = 3.95;
const PANEL_Y = FLOOR + 1.8;
const PANEL_ZS = [-3.6, -1.2, 1.2, 3.6];
const INTERNAL = new Set<PillarId>(['mental', 'physical', 'emotional', 'spiritual']);

const STATE_COLOR: Record<QuestPanel['state'], string> = {
  due: '#C9A227', done: '#66bb6a', weekDone: '#8a8578', rest: '#6e6a63', locked: '#55504a',
};
const STATE_WORD: Record<QuestPanel['state'], string> = {
  due: 'DO', done: 'DONE', weekDone: 'DONE THIS WEEK', rest: 'REST DAY', locked: 'LOCKED',
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
  ctx.fillText(`${d.dayLabel} · ${d.weekDone} done`, w / 2, 106);

  const lit = new Set(d.litPillars);
  const touched = new Set(d.touchedPillars);
  PILLAR_ORDER.forEach((p, i) => {
    const x = 172 + i * 97;
    if (lit.has(p)) {
      // quota met — full gold with a glow
      const g = ctx.createRadialGradient(x, 200, 2, x, 200, 34);
      g.addColorStop(0, 'rgba(201,162,39,0.35)'); g.addColorStop(1, 'rgba(201,162,39,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, 200, 34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(x, 200); ctx.scale(5.4, 5.4);
    ctx.strokeStyle = lit.has(p) ? '#C9A227' : touched.has(p) ? '#a8863d' : '#4a463f';
    ctx.lineWidth = 0.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(PILLAR_SYMBOLS[p]));
    ctx.restore();
  });
  ctx.font = '15px Inter, Georgia, serif';
  ctx.fillStyle = '#8a8578';
  ctx.fillText('inner world →', w / 2 - 330, 264);
  ctx.fillText('← outer world', w / 2 + 330, 264);
  ctx.fillStyle = '#6e6a63';
  ctx.fillText('aim at a panel · click or press E to check in', w / 2, 264);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function WallShrine({ q, target, side, z, tex, marble, onOpen, onDoorChange, destination }: {
  q: QuestPanel;
  target: QuestTarget;
  side: 1 | -1;          // +1 → local +x wall (player's left), -1 → -x wall
  z: number;
  tex?: THREE.CanvasTexture;
  marble: THREE.Material;
  onOpen: () => void;
  onDoorChange: (d: DoorDestination | null) => void;
  destination: DoorDestination;
}) {
  const [hovered, setHovered] = useState(false);
  // plane normal must face the room: +x wall looks -x, -x wall looks +x
  const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group position={[side * WALL_X, 0, z]}>
      {/* marble backing slab — the panel is set into the wall */}
      <mesh material={marble} position={[side * 0.09, PANEL_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1.4, 1.86]} />
      </mesh>
      {/* hover glow behind the panel edge */}
      {hovered && (
        <mesh position={[side * 0.03, PANEL_Y, 0]} rotation={[0, rotY, 0]}>
          <planeGeometry args={[1.62, 1.18]} />
          <meshBasicMaterial color={0xC9A227} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {tex && (
        <mesh
          position={[0, PANEL_Y, 0]} rotation={[0, rotY, 0]}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[1.5, 1.05]} />
          <meshBasicMaterial map={tex} />
        </mesh>
      )}
      {/* standing-in-front sensor → E prompt targets this quest */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[0.75, 1.6, 0.95]}
          position={[-side * 0.62, PANEL_Y, 0]}
          onIntersectionEnter={() => onDoorChange({
            slug: q.id, name: q.title, href: `/games/${destination.gameSlug}/quest/${q.id}`,
            accent: destination.accent, prompt: `Check in — ${q.title}`, quest: target,
          })}
          onIntersectionExit={() => onDoorChange(destination)}
        />
      </RigidBody>
    </group>
  );
}

export function HallBoard({ gameSlug, destination, onDoorChange, onQuest, version }: {
  gameSlug: string;
  destination: DoorDestination;
  onDoorChange: (d: DoorDestination | null) => void;
  onQuest: (q: QuestTarget) => void;
  version: number;
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
  }, [load, version]);

  const questTex = useMemo(() => board?.quests.map(questTexture) ?? [], [board, fontReady]);
  const friezeTex = useMemo(() => (board ? friezeTexture(board) : null), [board, fontReady]);
  useEffect(() => () => {
    questTex.forEach((t) => t.dispose());
    friezeTex?.dispose();
  }, [questTex, friezeTex]);

  const toTarget = useCallback((q: QuestPanel): QuestTarget => ({
    gameSlug, questKey: q.id, title: q.title, description: q.description, why: q.why,
    xp: q.xp, pillar: q.pillar,
    proof: q.proof, books: board?.books ?? [],
    blocked: q.state === 'done' ? 'done' : q.state === 'locked' ? 'locked' : !q.activeToday ? 'rest' : undefined,
  }), [gameSlug, board]);

  // walking in (+z), the player's left wall is local +x → external pillars;
  // right wall is local -x → internal pillars
  const walls = useMemo(() => {
    const left: { q: QuestPanel; i: number }[] = [];
    const right: { q: QuestPanel; i: number }[] = [];
    board?.quests.forEach((q, i) => (INTERNAL.has(q.pillar) ? right : left).push({ q, i }));
    return { left, right };
  }, [board]);

  return (
    <group>
      {/* back-wall frieze — the week at a glance */}
      {friezeTex && (
        <mesh position={[0, FLOOR + 3.35, 5.85]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[7.4, 2.08]} />
          <meshBasicMaterial map={friezeTex} />
        </mesh>
      )}

      {walls.left.map(({ q, i }, slot) => {
        const target = toTarget(q);
        return (
          <WallShrine key={q.id} q={q} target={target} side={1} z={PANEL_ZS[slot] ?? 0} tex={questTex[i]} marble={marble}
            onOpen={() => onQuest(target)} onDoorChange={onDoorChange} destination={destination} />
        );
      })}
      {walls.right.map(({ q, i }, slot) => {
        const target = toTarget(q);
        return (
          <WallShrine key={q.id} q={q} target={target} side={-1} z={PANEL_ZS[slot] ?? 0} tex={questTex[i]} marble={marble}
            onOpen={() => onQuest(target)} onDoorChange={onDoorChange} destination={destination} />
        );
      })}
    </group>
  );
}
