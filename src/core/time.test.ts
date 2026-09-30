import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, dateRange, daysBetween, isLocalDate, isoDayOfWeek, localDate, localTime,
  monthOf, toInstant, tzOffsetMs, weekDates, weekStart, zonedTimeToUtc,
} from './time';

describe('calendar arithmetic', () => {
  test('addDays across month/year/leap boundaries', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2026-06-10', 0), '2026-06-10');
  });

  test('daysBetween is signed', () => {
    assert.equal(daysBetween('2026-01-01', '2026-12-31'), 364);
    assert.equal(daysBetween('2026-03-10', '2026-03-01'), -9);
    // DST in any zone does not affect calendar arithmetic
    assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  });

  test('weekStart returns the Monday on or before', () => {
    assert.equal(weekStart('2026-09-28'), '2026-09-28'); // Monday
    assert.equal(weekStart('2026-10-04'), '2026-09-28'); // Sunday
    assert.equal(weekStart('2026-09-30'), '2026-09-28'); // Wednesday
    assert.equal(weekStart('2027-01-01'), '2026-12-28'); // across year
    assert.equal(isoDayOfWeek('2026-10-04'), 6);
    assert.deepEqual(weekDates('2026-09-28').at(-1), '2026-10-04');
  });

  test('validation', () => {
    assert.equal(isLocalDate('2026-02-30'), false);
    assert.equal(isLocalDate('2026-2-3'), false);
    assert.equal(isLocalDate('2028-02-29'), true);
    assert.throws(() => addDays('2026-13-01', 1), RangeError);
    assert.throws(() => zonedTimeToUtc('2026-01-01', '24:00', 'UTC'), RangeError);
    assert.throws(() => localDate('not a date', 'UTC'), RangeError);
    assert.throws(() => localDate(0, 'Not/AZone'), RangeError);
  });

  test('dateRange and monthOf', () => {
    assert.deepEqual(dateRange('2026-01-30', '2026-02-02'), ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    assert.deepEqual(dateRange('2026-01-02', '2026-01-01'), []);
    assert.equal(monthOf('2026-01-30'), '2026-01');
  });
});

describe('America/Costa_Rica (UTC-6, no DST)', () => {
  const tz = 'America/Costa_Rica';
  test('local date/time', () => {
    assert.equal(localDate('2026-06-21T05:59:00Z', tz), '2026-06-20');
    assert.equal(localDate('2026-06-21T06:00:00Z', tz), '2026-06-21');
    assert.equal(localTime('2026-06-21T11:15:00Z', tz), '05:15');
  });
  test('zonedTimeToUtc summer and winter use the same offset', () => {
    assert.equal(zonedTimeToUtc('2026-06-21', '06:00', tz), '2026-06-21T12:00:00.000Z');
    assert.equal(zonedTimeToUtc('2026-12-21', '06:00', tz), '2026-12-21T12:00:00.000Z');
  });
});

describe('America/New_York across DST', () => {
  const tz = 'America/New_York';
  test('offsets before/after spring forward (2026-03-08)', () => {
    assert.equal(tzOffsetMs('2026-03-08T06:59:00Z', tz), -5 * 3600_000);
    assert.equal(tzOffsetMs('2026-03-08T07:00:00Z', tz), -4 * 3600_000);
  });
  test('spring forward: 01:30 EST, 03:30 EDT, skipped 02:30 resolves forward', () => {
    assert.equal(zonedTimeToUtc('2026-03-08', '01:30', tz), '2026-03-08T06:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-03-08', '03:30', tz), '2026-03-08T07:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-03-08', '02:30', tz), '2026-03-08T07:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-03-08', '00:00', tz), '2026-03-08T05:00:00.000Z');
    assert.equal(zonedTimeToUtc('2026-03-09', '00:00', tz), '2026-03-09T04:00:00.000Z');
  });
  test('fall back (2026-11-01): repeated 01:30 resolves to first (EDT) occurrence', () => {
    assert.equal(zonedTimeToUtc('2026-11-01', '01:30', tz), '2026-11-01T05:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-11-01', '00:30', tz), '2026-11-01T04:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-11-01', '03:00', tz), '2026-11-01T08:00:00.000Z');
    assert.equal(localTime('2026-11-01T06:30:00Z', tz), '01:30'); // second occurrence (EST)
  });
  test('local date near midnight in both regimes', () => {
    assert.equal(localDate('2026-03-08T04:59:59Z', tz), '2026-03-07');
    assert.equal(localDate('2026-03-08T05:00:00Z', tz), '2026-03-08');
    assert.equal(localDate('2026-11-02T04:59:00Z', tz), '2026-11-01');
    assert.equal(localDate('2026-11-02T05:00:00Z', tz), '2026-11-02');
  });
  test('round trip every local hour on transition days', () => {
    for (const d of ['2026-03-08', '2026-11-01']) {
      for (let h = 0; h < 24; h++) {
        if (d === '2026-03-08' && h === 2) continue; // does not exist
        const t = `${String(h).padStart(2, '0')}:15`;
        const inst = zonedTimeToUtc(d, t, tz);
        assert.equal(localDate(inst, tz), d);
        assert.equal(localTime(inst, tz), t);
      }
    }
  });
});

describe('Asia/Kolkata (+05:30)', () => {
  const tz = 'Asia/Kolkata';
  test('half-hour offset', () => {
    assert.equal(tzOffsetMs('2026-06-01T00:00:00Z', tz), 5.5 * 3600_000);
    assert.equal(localDate('2026-06-01T18:29:00Z', tz), '2026-06-01');
    assert.equal(localDate('2026-06-01T18:30:00Z', tz), '2026-06-02');
    assert.equal(localTime('2026-06-01T00:00:00Z', tz), '05:30');
    assert.equal(zonedTimeToUtc('2026-06-02', '00:00', tz), '2026-06-01T18:30:00.000Z');
  });
});

describe('Pacific/Auckland week boundary', () => {
  const tz = 'Pacific/Auckland';
  test('Monday in Auckland while the US is still on Sunday', () => {
    // 2026-10-04 is a Sunday. NZ is on NZDT (+13) from 2026-09-27.
    const inst = '2026-10-04T12:30:00Z'; // Mon 01:30 NZDT, Sun 08:30 EDT
    assert.equal(localDate(inst, tz), '2026-10-05');
    assert.equal(weekStart(localDate(inst, tz)), '2026-10-05');
    assert.equal(localDate(inst, 'America/New_York'), '2026-10-04');
    assert.equal(weekStart(localDate(inst, 'America/New_York')), '2026-09-28');
  });
  test('week start instant', () => {
    assert.equal(zonedTimeToUtc('2026-10-05', '00:00', tz), '2026-10-04T11:00:00.000Z');
    // Winter (NZST +12)
    assert.equal(zonedTimeToUtc('2026-07-06', '00:00', tz), '2026-07-05T12:00:00.000Z');
  });
});

test('toInstant normalizes inputs', () => {
  assert.equal(toInstant(0), '1970-01-01T00:00:00.000Z');
  assert.equal(toInstant(new Date('2026-01-01T00:00:00Z')), '2026-01-01T00:00:00.000Z');
  assert.equal(toInstant('2026-01-01T01:00:00+01:00'), '2026-01-01T00:00:00.000Z');
});
