// Game 1 scenario tests (SPEC §6.6): players simulated day by day with the real config.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { game1 } from './config';
import { GameSimulator } from '../simulator';
import { addDays, sunriseUtc, localTime, weekStart, zonedTimeToUtc } from '../../core';

const TZ = 'America/Costa_Rica';
const SAN_JOSE = { lat: 9.93, lon: -84.08 };
const newPlayer = (joinDate: string, extra: { bookPages?: number } = {}) =>
  new GameSimulator({ game: game1, timeZone: TZ, joinedAt: zonedTimeToUtc(joinDate, '09:00', TZ), ...SAN_JOSE, ...extra });

describe('Scenario 1: new player joining on a Wednesday', () => {
  test('week 1 due counts are prorated; only mental/physical unlocked', () => {
    const sim = newPlayer('2026-01-07'); // Wednesday
    sim.run('2026-01-07', '2026-01-11', GameSimulator.perfectDay);
    const w1 = sim.weekResults[0]!;
    assert.equal(w1.weekStart, '2026-01-05');
    assert.equal(w1.stage, 'initiate');
    const due = Object.fromEntries(w1.quests.map((l) => [l.questId, l.due]));
    // 5 active days (Wed–Sun): read daily 5; exercise ceil(2·5/7)=2; dawn ceil(2·5/7)=2.
    assert.deepEqual(due, { 'g1.read': 5, 'g1.exercise': 2, 'g1.dawn': 2 });
    assert.deepEqual([...new Set(w1.quests.map((l) => l.pillar))].sort(), ['mental', 'physical']);
    assert.equal(w1.due, 9);
    assert.equal(w1.done, 9);
    assert.equal(w1.pieces, 5);
    assert.equal(w1.balancedWeek, false);
    // The initiate stage only asks for 5 pages.
    assert.equal(sim.completions.find((c) => c.questId === 'g1.read')?.payload.pages, 5);
  });
});

describe('Scenario 2: perfect player joining on a Monday, 30 weeks', () => {
  const sim = newPlayer('2026-01-05', { bookPages: 150 });
  sim.run('2026-01-05', addDays('2026-01-05', 30 * 7 - 1), GameSimulator.perfectDay);

  test('reaches 120 pieces exactly at week 24 and never exceeds 120; ≤ 5 per week', () => {
    assert.equal(sim.chisel.length, 30);
    for (const c of sim.chisel) {
      assert.equal(c.tierPieces, 5);
      assert.ok(c.applied <= 5);
      assert.ok(c.piecesRevealed <= 120);
    }
    assert.equal(sim.chisel[22]!.piecesRevealed, 115);
    assert.equal(sim.chisel[23]!.piecesRevealed, 120);
    assert.equal(sim.chisel.findIndex((c) => c.piecesRevealed === 120), 23);
    assert.ok(sim.chisel.slice(24).every((c) => c.applied === 0 && c.piecesRevealed === 120));
    assert.equal(sim.piecesRevealed, 120);
  });

  test('every week is perfect; balanced from week 4 (all eight pillars)', () => {
    assert.ok(sim.weekResults.every((w) => w.perfectWeek && w.completionPct === 1));
    assert.deepEqual(sim.weekResults.map((w) => w.due).slice(0, 5), [11, 23, 32, 42, 42]);
    assert.deepEqual(sim.weekResults.filter((w) => w.balancedWeek).map((w) => w.weekIndex)[0], 4);
    assert.equal(sim.weekResults.filter((w) => w.balancedWeek).length, 27);
  });

  test('achievements and decorations', () => {
    const expected = [
      'bookworm', 'finisher', 'the_library', 'first_light', 'early_riser', 'dawn_patrol', 'iron_will', 'unbroken',
      'inner_peace', 'money_minded', 'connector', 'clean_slate', 'well_played', 'master_inner', 'master_outer',
      'well_rounded', 'full_protocol', 'unstoppable',
    ];
    assert.deepEqual([...sim.earned].sort(), [...expected].sort());
    const count = (t: string) => sim.decorations.filter((d) => d.type === t).length;
    assert.equal(count('gold_vein'), 30);       // one per Perfect Week
    assert.equal(count('plinth_carving'), 27);  // one per Balanced Week
    assert.equal(count('laurel_leaf'), sim.booksFinished);
    assert.ok(sim.booksFinished >= 12);
    assert.equal(count('inner_ring'), 1);
    assert.equal(count('outer_ring'), 1);
    assert.equal(count('plinth_symbol_physical'), 2);
  });

  test('XP includes quest, weekly bonus and book XP; streaks unbroken', () => {
    const by = (s: string) => sim.xpEvents.filter((e) => e.sourceType === s).reduce((a, e) => a + e.amount, 0);
    assert.equal(by('perfect_week'), 30 * 250);
    assert.equal(by('balanced_week'), 27 * 100);
    assert.equal(by('book_finished'), sim.booksFinished * 150);
    assert.ok(by('full_set') > 0);
    assert.equal(sim.totalXp, sim.xpEvents.reduce((a, e) => a + e.amount, 0));
    const today = addDays('2026-01-05', 30 * 7 - 1);
    const streaks = sim.streaks(today).streaks;
    assert.equal(streaks['g1.read']?.current, 210);
    assert.equal(streaks['g1.journal']?.current, 203);
  });

  test('closing a week twice changes nothing', () => {
    const before = { pieces: sim.piecesRevealed, xp: sim.totalXp, weeks: sim.weekResults.length };
    sim.closeWeek('2026-01-05');
    assert.deepEqual({ pieces: sim.piecesRevealed, xp: sim.totalXp, weeks: sim.weekResults.length }, before);
  });
});

describe('Scenario 3: a player at ~80% for 10 weeks', () => {
  test('earns 50 pieces', () => {
    const sim = newPlayer('2026-01-05');
    let planned = new Set<string>();
    sim.run('2026-01-05', addDays('2026-01-05', 10 * 7 - 1), (date, s) => {
      if (date === weekStart(date)) {
        const slots = s.weekSlots(date);
        const skip = Math.floor(slots.length * 0.2);
        planned = new Set(slots.slice(0, slots.length - skip).map((x) => `${x.questId}|${x.date}`));
      }
      for (const key of planned) {
        const [questId, d] = key.split('|') as [string, string];
        if (d === date) s.checkIn(questId, date);
      }
    });
    assert.equal(sim.weekResults.length, 10);
    for (const w of sim.weekResults) {
      assert.ok(w.completionPct >= 0.75 && w.completionPct < 0.85, `week ${w.weekIndex}: ${w.completionPct}`);
      assert.equal(w.pieces, 5);
      assert.equal(w.perfectWeek, false);
    }
    assert.equal(sim.piecesRevealed, 50);
  });
});

describe('Scenario 4: a player who pauses 3 days (travel)', () => {
  test('due counts shrink; completion % is unaffected by the pause', () => {
    const week = '2026-01-26'; // week 4, full protocol
    const home = newPlayer('2026-01-05');
    const traveler = newPlayer('2026-01-05');
    traveler.pause('2026-01-27', '2026-01-28', '2026-01-29');
    for (const sim of [home, traveler]) sim.run('2026-01-05', '2026-02-01', GameSimulator.perfectDay);
    const h = home.weekResults.find((w) => w.weekStart === week)!;
    const t = traveler.weekResults.find((w) => w.weekStart === week)!;
    assert.equal(h.due, 42);
    // 4 active days: read 4, journal 4, exercise ceil(16/7)=3, dawn/stillness/money ceil(20/7)=3, connect/reset/play ceil(12/7)=2.
    assert.equal(t.due, 4 + 4 + 3 + 3 + 3 + 3 + 2 + 2 + 2);
    assert.ok(traveler.completions.every((c) => !['2026-01-27', '2026-01-28', '2026-01-29'].includes(c.localDate)));
    assert.equal(h.completionPct, 1);
    assert.equal(t.completionPct, 1);
    assert.equal(t.pieces, 5);
    assert.equal(t.perfectWeek, true);
    // The pause does not break (or spend freezes on) the daily streaks.
    const s = traveler.streaks('2026-02-01');
    assert.equal(s.freezesUsed.length, 0);
    assert.equal(s.streaks['g1.read']?.current, 28);
  });
});

describe('Scenario 5: dawn check-ins in San José', () => {
  test('02:59, 05:30 and 06:30 on a ~05:15 sunrise day → only 05:30 counts', () => {
    const day = '2026-05-15';
    assert.equal(localTime(sunriseUtc(day, SAN_JOSE.lat, SAN_JOSE.lon)!, TZ), '05:15');
    const sim = newPlayer('2026-01-05');
    const early = sim.checkIn('g1.dawn', day, { time: '02:59' });
    const ontime = sim.checkIn('g1.dawn', day, { time: '05:30' });
    const late = sim.checkIn('g1.dawn', day, { time: '06:30' });
    assert.equal(early.ok, false);
    assert.equal(ontime.ok, true);
    assert.equal(late.ok, false);
    assert.equal(sim.completions.length, 1);
    assert.equal(sim.completions[0]?.localDate, day);
  });
});

describe('Scenario 6: journal streak with a freeze, then a repair', () => {
  const misses = { read: ['2026-02-03'], journal: ['2026-02-10', '2026-02-17'] };
  const play = (repair: boolean) => {
    const sim = newPlayer('2026-01-05');
    sim.run('2026-01-12', '2026-02-20', (date, s) => {
      if (!misses.read.includes(date)) s.checkIn('g1.read', date);
      if (!misses.journal.includes(date)) s.checkIn('g1.journal', date);
      if (repair && date === '2026-02-18') s.checkIn('g1.journal', date, { time: '21:00', isRepair: true });
    });
    return sim.streaks('2026-02-20');
  };

  test('first journal miss is covered by a freeze; the second is repaired by a double day', () => {
    const out = play(true);
    // Freezes: Feb 3 (read miss) and Feb 10 (journal miss) use February's two freezes.
    assert.deepEqual(out.freezesUsed.map((f) => f.date), ['2026-02-03', '2026-02-10']);
    assert.equal(out.freezesLeftThisMonth, 0);
    // Journal unlocked Mon 2026-01-12; Jan 12 → Feb 20 is 40 days, all counted.
    assert.equal(out.streaks['g1.journal']?.current, 40);
    assert.equal(out.streaks['g1.journal']?.repairableDate, undefined);
  });

  test('without the double day the second miss breaks the streak (best is kept)', () => {
    const out = play(false);
    assert.equal(out.streaks['g1.journal']?.current, 3); // Feb 18, 19, 20
    assert.equal(out.streaks['g1.journal']?.longest, 36); // Jan 12 → Feb 16
  });
});
