import type { UniversePlot } from './universe-layout';

const TWO_PI = Math.PI * 2;
export const ORBIT_CENTER_Y = 0.3;
const MAX_FRAME_SECONDS = 0.1;

const finiteOr = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

/** Visual orbital tilt, in radians; this is not a physical orbit calculation. */
export function orbitInclination(): number {
  return 8 * Math.PI / 180;
}

/** Every device shares one speed: clockwise when viewed from above the ring. */
export function orbitAngularSpeed(): number {
  return 0.02;
}

/** A circle tilted about X, surrounding an empty centre at [0, 0.3, 0]. */
export function orbitRingPoint(radius: number, angle: number): [number, number, number] {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const phase = finiteOr(angle, 0) % TWO_PI;
  const inclination = orbitInclination();
  const along = safeRadius * Math.sin(phase);
  return [safeRadius * Math.cos(phase), ORBIT_CENTER_Y + along * Math.sin(inclination), along * Math.cos(inclination)];
}

/** Stable circular order plus a shared clock preserves equal neighbour spacing. */
export function orbitPosition(plot: UniversePlot, seconds: number): [number, number, number] {
  const x = finiteOr(plot.x, 0);
  const z = finiteOr(plot.z, 0);
  const fallbackRadius = Math.hypot(x, z);
  const radius = Number.isFinite(plot.orbitRadius) && plot.orbitRadius > 0 ? plot.orbitRadius
    : Number.isFinite(fallbackRadius) ? fallbackRadius : 0;
  const speed = orbitAngularSpeed();
  // Reduce the clock before multiplication, including a finite but extremely old clock.
  const elapsed = finiteOr(seconds, 0) % (TWO_PI / speed);
  return orbitRingPoint(radius, Math.atan2(z, x) + elapsed * speed);
}

/** Freeze the shared clock on pause and avoid jumps after an inactive browser tab. */
export function advanceOrbitTime(time: number, delta: number, animate: boolean): number {
  const safeTime = Number.isFinite(time) && time >= 0 ? time : 0;
  if (!animate || !Number.isFinite(delta) || delta <= 0) return safeTime;
  return safeTime + Math.min(delta, MAX_FRAME_SECONDS);
}
