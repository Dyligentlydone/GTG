import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunriseUtc } from './sunrise';
import { localTime, toMs } from './time';

// Expected values (UTC):
// - New York 2026-06-21 05:25 EDT (09:25Z) and 2026-12-21 07:16 EST (12:16Z): the NOAA Solar
//   Calculator / US Naval Observatory published sunrise for NYC around the solstices
//   (timeanddate.com lists the same minutes).
// - San José, CR 2026-06-21 ~05:17 CST (11:17Z) and 2026-12-21 ~05:48 CST (11:48Z): could not
//   fetch a live table from this environment, so these were cross-checked against an independent
//   implementation of the simplified "sunrise equation" (Wikipedia), which agreed within 1 minute.
// Tolerance per SPEC §4.2: ±3 minutes.
const TOLERANCE_MS = 3 * 60_000;

function assertNear(actual: string | null, expected: string) {
  assert.ok(actual, 'expected a sunrise');
  const diff = Math.abs(toMs(actual) - toMs(expected));
  assert.ok(diff <= TOLERANCE_MS, `${actual} is ${Math.round(diff / 1000)}s from ${expected}`);
}

test('San José, Costa Rica', () => {
  assertNear(sunriseUtc('2026-06-21', 9.93, -84.08), '2026-06-21T11:17:00Z');
  assertNear(sunriseUtc('2026-12-21', 9.93, -84.08), '2026-12-21T11:48:00Z');
});

test('New York', () => {
  const june = sunriseUtc('2026-06-21', 40.71, -74.01);
  assertNear(june, '2026-06-21T09:25:00Z');
  assert.equal(localTime(june!, 'America/New_York'), '05:25');
  const dec = sunriseUtc('2026-12-21', 40.71, -74.01);
  assertNear(dec, '2026-12-21T12:16:00Z');
  assert.equal(localTime(dec!, 'America/New_York'), '07:16');
});

test('Tromsø polar day and polar night are null', () => {
  assert.equal(sunriseUtc('2026-06-21', 69.65, 18.96), null);
  assert.equal(sunriseUtc('2026-12-21', 69.65, 18.96), null);
});

test('far-east longitude: sunrise for the local date falls on the previous UTC date', () => {
  const s = sunriseUtc('2026-06-21', -36.85, 174.76); // Auckland, ~07:33 NZST
  assert.ok(s);
  assert.equal(s.slice(0, 10), '2026-06-20');
  assert.equal(localTime(s, 'Pacific/Auckland').slice(0, 2), '07');
});

test('rejects invalid input', () => {
  assert.throws(() => sunriseUtc('2026-02-30', 0, 0), RangeError);
  assert.throws(() => sunriseUtc('2026-02-03', 91, 0), RangeError);
});
