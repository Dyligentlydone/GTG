import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dawnWindow, dawnWindowFor, isInDawnWindow } from './dawn';
import { zonedTimeToUtc } from './time';
import type { PlayerContext } from './types';

const base: PlayerContext = {
  userId: 'u1', timeZone: 'America/Costa_Rica', joinedAt: '2026-01-01T12:00:00Z', pausedDates: [], level: 1,
};
const sanJose: PlayerContext = { ...base, lat: 9.93, lon: -84.08 };
const at = (date: string, time: string, tz = 'America/Costa_Rica') => zonedTimeToUtc(date, time, tz);

describe('dawn window', () => {
  test('San José: sunrise ~05:17 is before 06:00, so closesAt = 06:00; opensAt = 03:00', () => {
    const w = dawnWindow('2026-06-21', sanJose);
    assert.equal(w.opensAt, at('2026-06-21', '03:00'));
    assert.equal(w.closesAt, at('2026-06-21', '06:00'));
    assert.equal(w.source, 'fallback');
    assert.equal(isInDawnWindow(at('2026-06-21', '02:59'), w), false);
    assert.equal(isInDawnWindow(at('2026-06-21', '03:00'), w), true);
    assert.equal(isInDawnWindow(at('2026-06-21', '05:30'), w), true);
    assert.equal(isInDawnWindow(at('2026-06-21', '05:59'), w), true);
    assert.equal(isInDawnWindow(at('2026-06-21', '06:00'), w), false); // closesAt is exclusive
    assert.equal(isInDawnWindow(at('2026-06-21', '06:30'), w), false);
  });

  test('New York in December: sunrise 07:16 is after 06:00, so closesAt = sunrise', () => {
    const ny: PlayerContext = { ...base, timeZone: 'America/New_York', lat: 40.71, lon: -74.01 };
    const w = dawnWindow('2026-12-21', ny);
    assert.equal(w.source, 'sunrise');
    assert.equal(isInDawnWindow(at('2026-12-21', '07:10', 'America/New_York'), w), true);
    assert.equal(isInDawnWindow(at('2026-12-21', '07:20', 'America/New_York'), w), false);
  });

  test('unknown location or polar day uses the fallback', () => {
    assert.equal(dawnWindow('2026-06-21', base).source, 'fallback');
    const tromso: PlayerContext = { ...base, timeZone: 'Europe/Oslo', lat: 69.65, lon: 18.96 };
    const w = dawnWindow('2026-06-21', tromso);
    assert.equal(w.source, 'fallback');
    assert.equal(w.closesAt, at('2026-06-21', '06:00', 'Europe/Oslo'));
  });

  test('a check-in at 23:00 the night before never counts', () => {
    assert.equal(dawnWindowFor(at('2026-06-20', '23:00'), sanJose), null);
    assert.equal(dawnWindowFor(at('2026-06-21', '04:00'), sanJose)?.date, '2026-06-21');
  });

  test('DST day in New York: window computed in local wall time', () => {
    const ny: PlayerContext = { ...base, timeZone: 'America/New_York' };
    const w = dawnWindow('2026-03-08', ny);
    assert.equal(w.opensAt, '2026-03-08T07:00:00.000Z'); // 03:00 EDT
    assert.equal(w.closesAt, '2026-03-08T10:00:00.000Z'); // 06:00 EDT
  });

  test('custom wake window (night shift) replaces sunrise rules, may cross midnight', () => {
    const night: PlayerContext = { ...sanJose, customWakeWindow: { start: '14:00', end: '16:00' } };
    const w = dawnWindow('2026-06-21', night);
    assert.equal(w.source, 'custom');
    assert.equal(isInDawnWindow(at('2026-06-21', '15:00'), w), true);
    assert.equal(isInDawnWindow(at('2026-06-21', '05:30'), w), false);

    const cross: PlayerContext = { ...sanJose, customWakeWindow: { start: '22:00', end: '01:00' } };
    const hit = dawnWindowFor(at('2026-06-22', '00:30'), cross);
    assert.equal(hit?.date, '2026-06-21');
    assert.equal(dawnWindowFor(at('2026-06-22', '01:30'), cross), null);
  });
});
