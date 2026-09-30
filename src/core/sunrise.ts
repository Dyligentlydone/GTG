// Sunrise via the NOAA solar calculator algorithm (SPEC §4.2). No dependencies.
// Port of the equations in NOAA ESRL's "General Solar Position Calculations" / solar calculator
// (https://gml.noaa.gov/grad/solcalc/), which are based on Meeus, "Astronomical Algorithms".
import type { Instant, LocalDate } from './types';
import { isLocalDate, toInstant } from './time';

const RAD = Math.PI / 180;
const deg = (r: number) => r / RAD;

function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

const centuries = (jd: number) => (jd - 2451545.0) / 36525.0;

function geomMeanLongSun(t: number): number {
  const l0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
  return ((l0 % 360) + 360) % 360;
}
const geomMeanAnomalySun = (t: number) => 357.52911 + t * (35999.05029 - 0.0001537 * t);
const eccentricityEarthOrbit = (t: number) => 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

function sunEqOfCenter(t: number): number {
  const m = geomMeanAnomalySun(t) * RAD;
  return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * m) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * m) * 0.000289;
}

function sunApparentLong(t: number): number {
  const trueLong = geomMeanLongSun(t) + sunEqOfCenter(t);
  const omega = 125.04 - 1934.136 * t;
  return trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
}

function obliquityCorrection(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const e0 = 23 + (26 + seconds / 60) / 60;
  const omega = 125.04 - 1934.136 * t;
  return e0 + 0.00256 * Math.cos(omega * RAD);
}

function sunDeclination(t: number): number {
  const e = obliquityCorrection(t) * RAD;
  const lambda = sunApparentLong(t) * RAD;
  return deg(Math.asin(Math.sin(e) * Math.sin(lambda)));
}

/** Equation of time in minutes. */
function equationOfTime(t: number): number {
  const epsilon = obliquityCorrection(t) * RAD;
  const l0 = geomMeanLongSun(t) * RAD;
  const e = eccentricityEarthOrbit(t);
  const m = geomMeanAnomalySun(t) * RAD;
  const y = Math.tan(epsilon / 2) ** 2;
  const eTime = y * Math.sin(2 * l0)
    - 2 * e * Math.sin(m)
    + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
    - 0.5 * y * y * Math.sin(4 * l0)
    - 1.25 * e * e * Math.sin(2 * m);
  return deg(eTime) * 4;
}

/** Hour angle of sunrise in degrees (solar zenith 90.833°: refraction + solar radius), NaN if the sun never rises/sets. */
function hourAngleSunrise(lat: number, decl: number): number {
  const phi = lat * RAD;
  const d = decl * RAD;
  const cosH = Math.cos(90.833 * RAD) / (Math.cos(phi) * Math.cos(d)) - Math.tan(phi) * Math.tan(d);
  if (cosH < -1 || cosH > 1) return NaN;
  return deg(Math.acos(cosH));
}

/** Minutes after 00:00 UTC of the Julian day `jd` at which the sun rises (may be negative). */
function sunriseMinutesUtc(jd: number, lat: number, lon: number): number {
  const t = centuries(jd);
  const ha = hourAngleSunrise(lat, sunDeclination(t));
  const delta = lon + ha; // lon: degrees east positive
  return 720 - 4 * delta - equationOfTime(t);
}

/**
 * Sunrise for `date` at (lat, lon) (degrees; lon east positive), as a UTC instant,
 * or null when the sun does not rise that day (polar day or polar night).
 * The date is interpreted as the calendar date at that longitude; far-east longitudes
 * may yield an instant on the previous UTC date, which is correct.
 */
export function sunriseUtc(date: LocalDate, lat: number, lon: number): Instant | null {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: ${date}`);
  if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
    throw new RangeError(`Invalid coordinates: ${lat}, ${lon}`);
  }
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const jd = julianDay(y, m, d);
  // Two passes as in NOAA: first estimate, then recompute at the estimated time of day.
  const first = sunriseMinutesUtc(jd, lat, lon);
  if (!Number.isFinite(first)) return null;
  const refined = sunriseMinutesUtc(jd + first / 1440, lat, lon);
  if (!Number.isFinite(refined)) return null;
  return toInstant(Date.UTC(y, m - 1, d) + Math.round(refined * 60) * 1000);
}
