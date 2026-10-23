import type { VoyageKind } from '../read-model/types';
import { voyageMotion, type VoyageMotionState } from '../read-model/voyages';
import { stableNodeHash } from './layout';

/**
 * Display-only motion for observed session voyages. The refresh cycle itself is
 * owned by read-model/voyages.ts: this module only turns a cycle clock into
 * stable berth angles, elevated route samples, and ship poses. It deliberately
 * imports no three.js objects so the rules stay testable without a scene.
 */

export const VOYAGE_SAMPLES_PER_LEG = 12;
export const VOYAGE_MAX_VOYAGES = 8;
export const VOYAGE_LIFT_MIN = 1.5;
export const VOYAGE_LIFT_MAX = 4;
export const VOYAGE_BOW_MAX = 1.1;
export const VOYAGE_BERTH_RADIUS_FACTOR = 3.2;
export const VOYAGE_OUTER_RING_FACTOR = 1.15;
export const VOYAGE_DEFAULT_CYCLE_MS = 180_000;
export const VOYAGE_MAX_FRAME_SECONDS = 0.1;
export const VOYAGE_PALETTE = {
  session: '#8fe8f2',
  acp: '#c9a6f2',
  error: '#ef8f7a',
} as const;

const TAU = Math.PI * 2;
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(finite(value), 0, 1);

export interface VoyagePointLike { x: number; y: number; z: number }
export type VoyagePoint = [number, number, number];

/** A stable value in [0, 1); the same identity and channel always land in the same place. */
export function voyageUnit(identity: string, channel = 'voyage'): number {
  return (stableNodeHash(`${channel}:${identity}`) >>> 0) / 0x1_0000_0000;
}

/** Angle in radians, stable for the identity and independent of array order. */
export function voyageAngle(identity: string, channel = 'voyage'): number {
  return voyageUnit(identity, channel) * TAU;
}

/** Per-leg vertical arc height. The sampled curve always rises 1.5–4 world units. */
export function voyageLift(identity: string, leg: number): number {
  return VOYAGE_LIFT_MIN + voyageUnit(identity, `lift:${leg}`) * (VOYAGE_LIFT_MAX - VOYAGE_LIFT_MIN);
}

/** A small lateral bow keeps overlapping routes readable without moving their endpoints. */
export function voyageBow(identity: string): number {
  return (voyageUnit(identity, 'bow') * 2 - 1) * VOYAGE_BOW_MAX;
}

/** Ships sharing one project berth fan out by less than a berth radius. */
export function voyageLateral(identity: string): number {
  return (voyageUnit(identity, 'berth-offset') * 2 - 1) * 0.5;
}

export function voyageColor(kind: VoyageKind, error = false): string {
  if (error) return VOYAGE_PALETTE.error;
  return kind === 'acp' ? VOYAGE_PALETTE.acp : VOYAGE_PALETTE.session;
}

export function voyageHasError(stops: readonly { status: string }[]): boolean {
  return stops.some((stop) => stop.status === 'error');
}

/** Number of sampled route points whose count stays 10–14 per leg. */
export function voyageRouteSamples(stopCount: number): number {
  const legs = Math.max(0, Math.floor(finite(stopCount)));
  return legs * VOYAGE_SAMPLES_PER_LEG;
}

/**
 * The berth sits on a ring around the origin device instead of inside it, so the
 * route starts outside the planet and the small ship stays visible at the dock.
 */
export function writeVoyageBerthPoint(out: VoyagePointLike, center: VoyagePointLike, radius: number, angle: number, lateral = 0): void {
  const distance = Math.max(0, finite(radius));
  const offset = clamp(finite(lateral), -1, 1);
  const heading = finite(angle) + offset * 0.22;
  out.x = center.x + Math.cos(heading) * distance;
  out.y = center.y + Math.abs(offset) * 0.35;
  out.z = center.z + Math.sin(heading) * distance;
}

export function voyageBerthPoint(center: VoyagePointLike, radius: number, angle: number, lateral = 0): VoyagePoint {
  const out: VoyagePointLike = { x: 0, y: 0, z: 0 };
  writeVoyageBerthPoint(out, center, radius, angle, lateral);
  return [out.x, out.y, out.z];
}

/**
 * The shared ship GLB is about four units long. A voyage craft is deliberately
 * smaller than the capability orbit: roughly one third of that ring radius,
 * which also keeps it larger than a single Skill star point.
 */
export const VOYAGE_SHIP_MODEL_LENGTH = 4;
export const VOYAGE_SHIP_LENGTH_FACTOR = 0.36;
export const VOYAGE_DESTINATION_ORBIT_FACTOR = 1.55;
export const VOYAGE_ORBIT_SPEED = 0.34;

export function voyageShipScale(planetRadius: number): number {
  const radius = Math.max(0.2, finite(planetRadius, 1));
  return clamp(radius * VOYAGE_SHIP_LENGTH_FACTOR / VOYAGE_SHIP_MODEL_LENGTH, 0.075, 0.28);
}

/** Continuous angle so an arrived craft keeps circling its destination. */
export function voyageOrbitAngle(identity: string, elapsedMs: number, speed = VOYAGE_ORBIT_SPEED): number {
  return voyageAngle(identity, 'destination-orbit') + Math.max(0, finite(elapsedMs)) / 1000 * finite(speed, VOYAGE_ORBIT_SPEED);
}

/** A slightly inclined circular holding pattern around a destination. */
export function writeVoyageOrbitPoint(out: VoyagePointLike, center: VoyagePointLike, radius: number, angle: number, lift = 0): void {
  const distance = Math.max(0, finite(radius));
  out.x = center.x + Math.cos(angle) * distance;
  out.y = center.y + Math.sin(angle * 0.7) * Math.max(0, finite(lift));
  out.z = center.z + Math.sin(angle) * distance;
}

export function voyageOrbitPoint(center: VoyagePointLike, radius: number, angle: number, lift = 0): VoyagePoint {
  const out: VoyagePointLike = { x: 0, y: 0, z: 0 };
  writeVoyageOrbitPoint(out, center, radius, angle, lift);
  return [out.x, out.y, out.z];
}

export function voyageOrbitTangent(angle: number): VoyagePoint {
  return [-Math.sin(angle), 0, Math.cos(angle)];
}

/** An unresolved stop, or a stop whose device has no live position, docks on the outer ring. */
export function writeVoyageOuterDockPoint(out: VoyagePointLike, layoutRadius: number, stopId: string, height = 0.3): void {
  const radius = Math.max(1, finite(layoutRadius)) * VOYAGE_OUTER_RING_FACTOR;
  const angle = voyageAngle(stopId, 'dock');
  out.x = Math.cos(angle) * radius;
  out.y = finite(height, 0.3);
  out.z = Math.sin(angle) * radius;
}

export function voyageOuterDockPoint(layoutRadius: number, stopId: string, height = 0.3): VoyagePoint {
  const out: VoyagePointLike = { x: 0, y: 0, z: 0 };
  writeVoyageOuterDockPoint(out, layoutRadius, stopId, height);
  return [out.x, out.y, out.z];
}

/**
 * A quadratic-looking arc: linear travel plus a sine lift and a small sideways
 * bow. Endpoints are returned exactly, so dock and arrived poses match the
 * sampled waypoint even in strict equality tests.
 */
export function writeVoyageLegPoint(out: VoyagePointLike, from: VoyagePointLike, to: VoyagePointLike,
  t: number, lift = 0, bow = 0): void {
  const progress = clamp01(t);
  if (progress <= 0) {
    out.x = from.x; out.y = from.y; out.z = from.z;
    return;
  }
  if (progress >= 1) {
    out.x = to.x; out.y = to.y; out.z = to.z;
    return;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const horizontal = Math.hypot(dx, dz);
  const arc = Math.sin(Math.PI * progress);
  const sideways = horizontal > 1e-6 ? clamp(finite(bow), -VOYAGE_BOW_MAX, VOYAGE_BOW_MAX) * arc : 0;
  out.x = from.x + dx * progress + (horizontal > 1e-6 ? -dz / horizontal : 0) * sideways;
  out.y = from.y + dy * progress + Math.max(0, finite(lift)) * arc;
  out.z = from.z + dz * progress + (horizontal > 1e-6 ? dx / horizontal : 0) * sideways;
}

export function voyageLegPoint(from: VoyagePointLike, to: VoyagePointLike, t: number, lift = 0, bow = 0): VoyagePoint {
  const out: VoyagePointLike = { x: 0, y: 0, z: 0 };
  writeVoyageLegPoint(out, from, to, t, lift, bow);
  return [out.x, out.y, out.z];
}

/** The waypoint the ship currently occupies or left from. */
export function voyageWaypointIndex(state: VoyageMotionState, stopCount: number): number {
  const legs = Math.max(0, Math.floor(finite(stopCount)));
  if (legs === 0) return 0;
  if (state.phase === 'arrived') return legs;
  return clamp(state.leg, 0, legs);
}

/** Index of the dock that should pulse, or -1 while the ship is still in transit. */
export function voyageDockIndex(state: VoyageMotionState, stopCount: number): number {
  const legs = Math.max(0, Math.floor(finite(stopCount)));
  if (legs === 0) return -1;
  if (state.phase === 'dock') return clamp(state.leg, 1, legs);
  if (state.phase === 'arrived') return legs;
  return -1;
}

export interface VoyagePose extends VoyageMotionState {
  /** Index of the occupied / departed waypoint. */
  index: number;
  /** Next waypoint to steer towards, or -1 once parked. */
  targetIndex: number;
  x: number; y: number; z: number;
}

/**
 * Pure convenience wrapper used by tests and snapshots. The component calls
 * `voyageMotion` directly for its per-frame path so it never allocates this
 * object on the render loop.
 */
export function voyagePoseAt(waypoints: readonly VoyagePointLike[], elapsedMs: number, cycleMs: number,
  lifts: readonly number[] = [], bow = 0): VoyagePose {
  const stopCount = Math.max(0, waypoints.length - 1);
  const motion = voyageMotion(stopCount, elapsedMs, cycleMs);
  const state: VoyageMotionState = { ...motion, t: clamp01(motion.t), progress: clamp01(motion.progress) };
  if (!waypoints.length) return { ...state, index: -1, targetIndex: -1, x: 0, y: 0, z: 0 };
  const last = waypoints.length - 1;
  if (stopCount === 0) {
    const only = waypoints[0];
    return { ...state, index: 0, targetIndex: -1, x: only.x, y: only.y, z: only.z };
  }
  if (state.phase === 'travel') {
    const leg = clamp(state.leg, 0, last - 1);
    const point = voyageLegPoint(waypoints[leg], waypoints[leg + 1], state.t, lifts[leg] ?? 0, bow);
    return { ...state, leg, index: leg, targetIndex: Math.min(leg + 1, last), x: point[0], y: point[1], z: point[2] };
  }
  if (state.phase === 'dock') {
    const leg = clamp(state.leg, 1, last);
    const point = waypoints[leg];
    return { ...state, leg, index: leg, targetIndex: leg < last ? leg + 1 : -1, x: point.x, y: point.y, z: point.z };
  }
  if (state.phase === 'arrived') {
    const point = waypoints[last];
    return { ...state, leg: stopCount, index: last, targetIndex: -1, x: point.x, y: point.y, z: point.z };
  }
  const point = waypoints[0];
  return { ...state, leg: 0, index: 0, targetIndex: last > 0 ? 1 : -1, x: point.x, y: point.y, z: point.z };
}

/** Initial cycle clock. A missing or malformed timestamp starts at the berth. */
export function voyageElapsedFromCycleStart(cycleStart: string, now = Date.now(), cycleMs = VOYAGE_DEFAULT_CYCLE_MS): number {
  const cycle = Number.isFinite(cycleMs) && cycleMs > 0 ? cycleMs : VOYAGE_DEFAULT_CYCLE_MS;
  const started = Date.parse(cycleStart);
  const reference = Number.isFinite(now) ? now : Date.now();
  if (!Number.isFinite(started)) return 0;
  return clamp(reference - started, 0, cycle);
}

/**
 * Advance the snapshot's voyage clock. `animate=false` freezes the position
 * reached when the snapshot arrived; the elapsed value is never derived from
 * Date.now() on a frame, so pausing cannot drift.
 */
export function advanceVoyageElapsed(elapsedMs: number, deltaSeconds: number, cycleMs: number, animate: boolean): number {
  const cycle = Number.isFinite(cycleMs) && cycleMs > 0 ? cycleMs : VOYAGE_DEFAULT_CYCLE_MS;
  const elapsed = clamp(finite(elapsedMs), 0, cycle);
  if (!animate) return elapsed;
  const delta = finite(deltaSeconds);
  if (delta <= 0) return elapsed;
  return clamp(elapsed + Math.min(delta, VOYAGE_MAX_FRAME_SECONDS) * 1000, 0, cycle);
}
