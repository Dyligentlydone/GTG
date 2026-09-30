import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANCHORS, ARCHETYPES, HEAD_REGION_MAX_Y, MAX_CRACKS_PER_SHARD, PlaceholderStatueProvider, SHARD_COUNT, STATUE_PROFILE,
  area, canReroll, clampPieces, crackIntensity, cracksPerShard, generateRock, generateShards, isHeadShard, mulberry32,
  onDeckShards, pointInPolygon, renderSculptureSvg, revealOrder, sculptureModel, shardCrackLines,
} from './index';

const SEEDS = [1, 2, 3, 7, 42, 1234, 99999, 4294967295, ...Array.from({ length: 24 }, (_, i) => 1000 + i * 7919)];

test('rng: same seed gives the same sequence; different seeds differ', () => {
  const a = mulberry32(5);
  const b = mulberry32(5);
  const c = mulberry32(6);
  const sa = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(sa, Array.from({ length: 20 }, () => b.next()));
  assert.notDeepEqual(sa, Array.from({ length: 20 }, () => c.next()));
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test('rock: deterministic, taller than wide, 6–12 cracks, different per seed', () => {
  const r1 = generateRock(1);
  assert.deepEqual(generateRock(1), r1);
  assert.notDeepEqual(generateRock(2).outline, r1.outline);
  for (const seed of SEEDS) {
    const r = generateRock(seed);
    assert.ok(r.bbox.height > r.bbox.width, `seed ${seed} taller than wide`);
    assert.ok(r.cracks.length >= 6 && r.cracks.length <= 12, `seed ${seed} cracks ${r.cracks.length}`);
    assert.ok(r.facets.length >= 6);
  }
});

test('rock always covers the statue profile (every archetype) and hugs it', () => {
  for (const seed of SEEDS) {
    const r = generateRock(seed);
    for (const p of STATUE_PROFILE) {
      const inset = { x: p.x + Math.sign(300 - p.x) * 0.5, y: p.y + Math.sign(400 - p.y) * 0.5 };
      assert.ok(pointInPolygon(inset, r.outline), `seed ${seed}: profile point ${p.x},${p.y} inside rock`);
    }
    // Tight: no more than ~70px of extra rock beyond the profile on any side.
    assert.ok(r.bbox.x > 140 - 70 && r.bbox.x + r.bbox.width < 460 + 70, `seed ${seed} rock hugs the statue`);
  }
});

test('shards: exactly 120, covering the rock within 2% of its area', () => {
  for (const seed of SEEDS) {
    const { rock, shards } = sculptureModel(seed);
    assert.equal(shards.length, 120);
    assert.equal(SHARD_COUNT, 120);
    for (const s of shards) assert.ok(s.polygon.length >= 3 && s.area > 0, `seed ${seed} shard ${s.index} non-empty`);
    const sum = shards.reduce((t, s) => t + s.area, 0);
    const rockArea = area(rock.outline);
    assert.ok(Math.abs(sum - rockArea) / rockArea < 0.02, `seed ${seed}: ${sum} vs ${rockArea}`);
  }
  assert.deepEqual(generateShards(generateRock(3)), generateShards(generateRock(3)));
});

test('reveal order: a deterministic permutation of 0..119, bottom-up', () => {
  for (const seed of SEEDS) {
    const { shards, order } = sculptureModel(seed);
    assert.equal(order.length, 120);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 120 }, (_, i) => i));
    assert.deepEqual(revealOrder(seed, shards), order);
    const meanY = (xs: number[]) => xs.reduce((t, i) => t + shards[i]!.centroid.y, 0) / xs.length;
    assert.ok(meanY(order.slice(0, 20)) > meanY(order.slice(60, 80)), 'early pieces are lower');
    assert.ok(meanY(order.slice(60, 80)) > meanY(order.slice(100, 110)), 'later pieces are higher');
  }
});

test('face last: the last 10 shards are in the head region and cover the whole head', () => {
  for (const seed of SEEDS) {
    const { shards, order } = sculptureModel(seed);
    const last10 = order.slice(-10);
    for (const i of last10) {
      assert.ok(isHeadShard(shards[i]!), `seed ${seed} shard ${i} in head region`);
      assert.ok(shards[i]!.centroid.y < HEAD_REGION_MAX_Y);
    }
    for (const i of order.slice(0, 110)) assert.ok(!isHeadShard(shards[i]!), `seed ${seed}: head shard ${i} revealed early`);
    // Every point of the head (face, hair, beard) lies in one of the last 10 shards.
    const { x: hx, y: hy } = ANCHORS.headCenter;
    const { x: rx, y: ry } = ANCHORS.headRadius;
    for (let a = 0; a < 24; a++) {
      for (const f of [0, 0.5, 0.95]) {
        const p = { x: hx + Math.cos((a / 24) * Math.PI * 2) * rx * f, y: hy + Math.sin((a / 24) * Math.PI * 2) * ry * f };
        const owner = shards.find((s) => pointInPolygon(p, s.polygon));
        assert.ok(owner, `seed ${seed}: head point covered`);
        assert.ok(last10.includes(owner.index), `seed ${seed}: head point ${p.x.toFixed(0)},${p.y.toFixed(0)} in last 10`);
      }
    }
    const beardTip = shards.find((s) => pointInPolygon({ x: 300, y: 160 }, s.polygon));
    assert.ok(beardTip && last10.includes(beardTip.index), `seed ${seed}: beard tip in last 10`);
  }
});

test('on deck: the next 5 shards in the reveal order', () => {
  const { order } = sculptureModel(1);
  assert.deepEqual(onDeckShards(order, 0), order.slice(0, 5));
  assert.deepEqual(onDeckShards(order, 60), order.slice(60, 65));
  assert.deepEqual(onDeckShards(order, 117), order.slice(117, 120));
  assert.deepEqual(onDeckShards(order, 120), []);
  assert.deepEqual(onDeckShards(order, 500), []);
  assert.deepEqual(onDeckShards(order, -4), order.slice(0, 5));
});

test('piecesRevealed clamps to 0..120', () => {
  assert.equal(clampPieces(-5), 0);
  assert.equal(clampPieces(0), 0);
  assert.equal(clampPieces(7.9), 7);
  assert.equal(clampPieces(120), 120);
  assert.equal(clampPieces(121), 120);
  assert.equal(clampPieces(Number.NaN), 0);
  assert.equal(clampPieces(Infinity), 0);
  assert.match(renderSculptureSvg({ seed: 1, piecesRevealed: 999, weekProgressPct: 0 }), /120 of 120 pieces/);
  assert.match(renderSculptureSvg({ seed: 1, piecesRevealed: -3, weekProgressPct: 0 }), /0 of 120 pieces/);
  assert.equal(renderSculptureSvg({ seed: 1, piecesRevealed: 500, weekProgressPct: 0 }), renderSculptureSvg({ seed: 1, piecesRevealed: 120, weekProgressPct: 0 }));
});

test('cracks: intensity = min(1, progress / 0.75); more progress never removes cracks', () => {
  assert.equal(crackIntensity(0), 0);
  assert.equal(crackIntensity(-1), 0);
  assert.equal(crackIntensity(0.375), 0.5);
  assert.equal(crackIntensity(0.75), 1);
  assert.equal(crackIntensity(3), 1);
  assert.equal(cracksPerShard(0), 0);
  assert.equal(cracksPerShard(1), MAX_CRACKS_PER_SHARD);
  const { shards } = sculptureModel(1);
  const few = shardCrackLines(1, shards[10]!, 1);
  const many = shardCrackLines(1, shards[10]!, 3);
  assert.deepEqual(many.slice(0, few.length), few);
  // Rendering: cracks appear with week progress, but the revealed count is unchanged.
  const count = (svg: string) => (svg.match(/stroke="#1E1B18"/g) ?? []).length;
  const at0 = renderSculptureSvg({ seed: 1, piecesRevealed: 60, weekProgressPct: 0 });
  const at50 = renderSculptureSvg({ seed: 1, piecesRevealed: 60, weekProgressPct: 0.5 });
  const at100 = renderSculptureSvg({ seed: 1, piecesRevealed: 60, weekProgressPct: 1 });
  assert.equal(count(at0), 0);
  assert.ok(count(at50) > 0 && count(at100) > count(at50));
  for (const svg of [at0, at50, at100]) assert.match(svg, /60 of 120 pieces/);
});

test('render: deterministic SVG for every archetype, decorations and images', () => {
  const input = { seed: 9, piecesRevealed: 77, weekProgressPct: 0.4, decorations: ['laurel_leaf', { type: 'gold_vein', count: 3 }, 'inner_ring'] };
  assert.equal(renderSculptureSvg(input), renderSculptureSvg(input));
  assert.notEqual(renderSculptureSvg(input), renderSculptureSvg({ ...input, seed: 10 }));
  for (const archetype of ARCHETYPES) {
    for (const piecesRevealed of [0, 60, 120]) {
      const svg = renderSculptureSvg({ seed: 2, piecesRevealed, weekProgressPct: 0.5, archetype, decorations: ['outer_ring', 'plinth_carving', 'plinth_symbol_mental'] });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
    }
  }
  const withImages = renderSculptureSvg({ seed: 1, piecesRevealed: 50, weekProgressPct: 0, finalImageHref: 'https://x.test/a.png?a=1&b="2"', roughImageHref: 'https://x.test/r.png' });
  assert.match(withImages, /href="https:\/\/x\.test\/a\.png\?a=1&amp;b=&quot;2&quot;"/);
  assert.match(withImages, /href="https:\/\/x\.test\/r\.png"/);
  // Complete statue: no rock left.
  assert.doesNotMatch(renderSculptureSvg({ seed: 1, piecesRevealed: 120, weekProgressPct: 1 }), /-unrevealed\)"/);
});

test('statue provider: placeholder returns final and rough SVGs per archetype', async () => {
  const provider = new PlaceholderStatueProvider();
  for (const archetype of ARCHETYPES) {
    const out = await provider.generate({ facePhotoUrl: null, archetype, name: 'Ada', seed: 3 });
    assert.match(out.finalImageUrl, /^data:image\/svg\+xml/);
    assert.match(out.roughImageUrl, /^data:image\/svg\+xml/);
    assert.notEqual(out.finalImageUrl, out.roughImageUrl);
  }
  assert.equal(canReroll(0, 1), true);
  assert.equal(canReroll(1, 1), false);
  assert.equal(canReroll(99, null), true);
});

test('sculpture core is pure: no Math.random, Date.now or imports outside the core', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/, f);
    for (const m of src.matchAll(/from '([^']+)'/g)) assert.ok(m[1]!.startsWith('.'), `${f} imports ${m[1]}`);
  }
});
