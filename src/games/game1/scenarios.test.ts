// Game 1 scenario tests (SPEC §6.6): players simulated day by day with the real config.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { game1 } from './config';
import { GameSimulator } from '../simulator';
import { addDays, weekStart, zonedTimeToUtc } from '../../core';

const TZ = 'America/Costa_Rica';
const SAN_JOSE = { lat: 9.93, lon: -84.08 };
const newPlayer = (joinDate: string, extra: { bookPages?: number } = {}) =>
  new GameSimulator({ game: game1, timeZone: TZ, joinedAt: zonedTimeToUtc(joinDate, '09:00', TZ), ...SAN_JOSE, ...extra });

describe('Scenario 1: new player joining on a Wednesday', () => {
  test('week 1 due counts are prorated; all eight quests unlocked', () => {
    const sim = newPlayer('2026-01-07'); // Wednesday
    sim.run('2026-01-07', '2026-01-11', GameSimulator.perfectDay);
    const w1 = sim.weekResults[0]!;
    assert.equal(w1.weekStart, '2026-01-05');
    assert.equal(w1.stage, 'initiate');
    const due = Object.fromEntries(w1.quests.map((l) => [l.questId, l.due]));
    // 5 active days (Wed–Sun): dailies 5 each; weekly quotas prorate by 5/7 —
    // exercise 4 → ceil(20/7)=3, stillness 5 → ceil(25/7)=4, money 2 → ceil(10/7)=2,
    // connect/reset/play 3 → 3.
    assert.deepEqual(due, {
      'g1.read': 5, 'g1.journal': 5,
      'g1.exercise': 3, 'g1.stillness': 4, 'g1.money': 2,
      'g1.connect': 3, 'g1.reset': 3, 'g1.play': 3,
    });
    assert.deepEqual([...new Set(w1.quests.map((l) => l.pillar))].sort(),
      ['emotional', 'environmental', 'financial', 'mental', 'physical', 'recreational', 'social', 'spiritual']);
    assert.equal(w1.due, 28);
    assert.equal(w1.done, 28);
    assert.equal(w1.pieces, 18); // banked quota: 3+4+2+3+3+3 (10 daily completions chip live)
    assert.equal(w1.balancedWeek, true);
    assert.equal(sim.completions.find((c) => c.questId === 'g1.read')?.payload.pages, 10);
  });
});

describe('Scenario 2: perfect player joining on a Monday, 30 weeks', () => {
  const sim = newPlayer('2026-01-05', { bookPages: 150 });
  sim.run('2026-01-05', addDays('2026-01-05', 30 * 7 - 1), GameSimulator.perfectDay);

  test('reaches 875 pieces during week 26 and never exceeds; 34/week (14 live + 20 banked)', () => {
    assert.equal(sim.chisel.length, 30);
    for (const c of sim.chisel) {
      assert.equal(c.banked, 20);
      assert.ok(c.applied <= 20);
      assert.ok(c.piecesRevealed <= 875);
    }
    assert.equal(sim.chisel[24]!.piecesRevealed, 850); // 25 × 34
    assert.equal(sim.chisel[25]!.piecesRevealed, 875); // 864 after the week's live chips → cascade caps
    assert.equal(sim.chisel[25]!.applied, 11);         // only 11 of the 20 banked land
    assert.equal(sim.chisel.findIndex((c) => c.piecesRevealed === 875), 25);
    assert.ok(sim.chisel.slice(26).every((c) => c.applied === 0 && c.piecesRevealed === 875));
    assert.equal(sim.piecesRevealed, 875);
  });

  test('every week is perfect; balanced from week 1 (all eight pillars)', () => {
    assert.ok(sim.weekResults.every((w) => w.perfectWeek && w.completionPct === 1));
    // every quest unlocked from day 1: dailies 7+7, quotas 4+5+2+3+3+3 → 34/wk
    assert.deepEqual(sim.weekResults.map((w) => w.due).slice(0, 5), [34, 34, 34, 34, 34]);
    assert.equal(sim.weekResults.filter((w) => w.balancedWeek)[0]?.weekIndex, 1);
    assert.equal(sim.weekResults.filter((w) => w.balancedWeek).length, 30);
  });

  test('achievements and decorations', () => {
    const expected = [
      'bookworm', 'finisher', 'the_library', 'iron_will', 'unbroken',
      'inner_peace', 'money_minded', 'connector', 'clean_slate', 'well_played', 'master_inner', 'master_outer',
      'well_rounded', 'full_protocol', 'unstoppable',
    ];
    assert.deepEqual([...sim.earned].sort(), [...expected].sort());
    const count = (t: string) => sim.decorations.filter((d) => d.type === t).length;
    assert.equal(count('gold_vein'), 30);       // one per Perfect Week
    assert.equal(count('plinth_carving'), 30);  // one per Balanced Week
    assert.equal(count('laurel_leaf'), sim.booksFinished);
    assert.ok(sim.booksFinished >= 12);
    assert.equal(count('inner_ring'), 1);
    assert.equal(count('outer_ring'), 1);
    assert.equal(count('plinth_symbol_physical'), 1);
  });

  test('XP includes quest, weekly bonus and book XP; streaks unbroken', () => {
    const by = (s: string) => sim.xpEvents.filter((e) => e.sourceType === s).reduce((a, e) => a + e.amount, 0);
    assert.equal(by('perfect_week'), 30 * 250);
    assert.equal(by('balanced_week'), 30 * 100);
    assert.equal(by('book_finished'), sim.booksFinished * 150);
    assert.ok(by('full_set') > 0);
    assert.equal(sim.totalXp, sim.xpEvents.reduce((a, e) => a + e.amount, 0));
    const today = addDays('2026-01-05', 30 * 7 - 1);
    const streaks = sim.streaks(today).streaks;
    assert.equal(streaks['g1.read']?.current, 210);
    assert.equal(streaks['g1.journal']?.current, 210);
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
      assert.equal(w.pieces, 19); // 19 of 20 quota slots done; 9 daily check-ins chip live
      assert.equal(w.perfectWeek, false);
    }
    assert.equal(sim.piecesRevealed, 280); // 10 × (19 banked + 9 live)
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
    assert.equal(h.due, 34);
    // 4 active days: read 4, journal 4, exercise ceil(16/7)=3, stillness ceil(20/7)=3,
    // money ceil(8/7)=2, connect/reset/play ceil(12/7)=2.
    assert.equal(t.due, 4 + 4 + 3 + 3 + 2 + 2 + 2 + 2);
    assert.ok(traveler.completions.every((c) => !['2026-01-27', '2026-01-28', '2026-01-29'].includes(c.localDate)));
    assert.equal(h.completionPct, 1);
    assert.equal(t.completionPct, 1);
    assert.equal(t.pieces, 14); // quotas over 4 days: 3+3+2+2+2+2
    assert.equal(t.perfectWeek, true);
    // The pause does not break (or spend freezes on) the daily streaks.
    const s = traveler.streaks('2026-02-01');
    assert.equal(s.freezesUsed.length, 0);
    assert.equal(s.streaks['g1.read']?.current, 28);
  });
});

// (The old dawn-quest scenario lives on in core proof tests — g1.dawn was cut.)

describe('Scenario 5: journal streak with a freeze, then a repair', () => {
  const misses = { read: ['2026-02-03'], journal: ['2026-02-10', '2026-02-17'] };
  const play = (repair: boolean) => {
    const sim = newPlayer('2026-01-05');
    sim.run('2026-01-05', '2026-02-20', (date, s) => {
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
    // Journal unlocks at join now; Jan 5 → Feb 20 is 47 days, all counted.
    assert.equal(out.streaks['g1.journal']?.current, 47);
    assert.equal(out.streaks['g1.journal']?.repairableDate, undefined);
  });

  test('without the double day the second miss breaks the streak (best is kept)', () => {
    const out = play(false);
    assert.equal(out.streaks['g1.journal']?.current, 3); // Feb 18, 19, 20
    assert.equal(out.streaks['g1.journal']?.longest, 43); // Jan 5 → Feb 16
  });
});
