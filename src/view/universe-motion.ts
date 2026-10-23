import type { UniversePlot } from './universe-layout';
import type { HierarchicalOrbit } from './galaxy-layout';
import { spatialOrbitOffset } from './spatial-motion';

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

export const GALACTIC_ANGULAR_SPEED = 0.006;
export const SOLAR_ANGULAR_SPEED = 0.035;

/** Slow revolution of an entire solar system around the DERP barycentre. */
export function galaxySystemPosition(system: Pick<HierarchicalOrbit, 'majorRadius' | 'majorPhase' | 'majorPlane'>, seconds: number): [number, number, number] {
  const elapsed = finiteOr(seconds, 0) % (TWO_PI / GALACTIC_ANGULAR_SPEED);
  const phase = finiteOr(system.majorPhase, 0) + elapsed * GALACTIC_ANGULAR_SPEED;
  if (!system.majorPlane) return orbitRingPoint(system.majorRadius, phase);
  const offset = spatialOrbitOffset(system.majorRadius, phase, system.majorPlane);
  return [offset[0], ORBIT_CENTER_Y + offset[1], offset[2]];
}

/** Local orbit displacement, before adding the moving service centre. */
export function solarOrbitOffset(radius: number, phase: number, inclination: number): [number, number, number] {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const angle = finiteOr(phase, 0) % TWO_PI, tilt = finiteOr(inclination, 0);
  return [safeRadius * Math.cos(angle), safeRadius * Math.sin(angle) * Math.sin(tilt), safeRadius * Math.sin(angle) * Math.cos(tilt)];
}

/** A circle tilted about X, surrounding the relay centre at [0, 0.3, 0]. */
export function orbitRingPoint(radius: number, angle: number): [number, number, number] {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const phase = finiteOr(angle, 0) % TWO_PI;
  const inclination = orbitInclination();
  const along = safeRadius * Math.sin(phase);
  return [safeRadius * Math.cos(phase), ORBIT_CENTER_Y + along * Math.sin(inclination), along * Math.cos(inclination)];
}

/** Stable circular order plus a shared clock preserves equal neighbour spacing. */
export function orbitPosition(plot: UniversePlot, seconds: number): [number, number, number] {
  if (plot.role === 'relay-center') return [0, ORBIT_CENTER_Y, 0];
  if (plot.galaxy) {
    const system = plot.galaxy;
    const center = galaxySystemPosition(system, seconds);
    const speed = Number.isFinite(system.minorSpeed) && system.minorSpeed! > 0 ? system.minorSpeed! : SOLAR_ANGULAR_SPEED;
    const elapsed = finiteOr(seconds, 0) % (TWO_PI / speed), phase = finiteOr(system.minorPhase, 0) + elapsed * speed;
    const local = system.minorPlane ? spatialOrbitOffset(system.minorRadius, phase, system.minorPlane)
      : solarOrbitOffset(system.minorRadius, phase, system.minorInclination);
    return center.map((value, index) => value + local[index]) as [number, number, number];
  }
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
