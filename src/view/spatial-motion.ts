import { stableNodeHash } from './layout';

export interface OrbitPlane { inclination: number; longitude: number; aspect: number }
export interface PlanetSpin { axis: [number, number, number]; phase: number; speed: number }
const TAU = Math.PI * 2;
const radians = (degrees: number) => degrees * Math.PI / 180;
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** Mix the identity so similarly named devices still receive visibly different orientations. */
export function motionSeed(identity: string, channel: string): number {
  let value = stableNodeHash(`${channel}:${identity}`);
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

export function orbitPlane(identity: string, aspect = 0.94): OrbitPlane {
  return { inclination: radians(18 + motionSeed(identity, 'inclination') * 25),
    longitude: motionSeed(identity, 'longitude') * TAU, aspect };
}

/** A tilted ellipse with a shared horizontal projection keeps neighbouring phases safely separated. */
export function spatialOrbitOffset(radius: number, phase: number, plane: OrbitPlane): [number, number, number] {
  const r = Math.max(0, finite(radius)), angle = finite(phase) % TAU;
  const aspect = Math.max(0.8, Math.min(1, finite(plane.aspect, 0.94)));
  const tilt = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, finite(plane.inclination)));
  const node = finite(plane.longitude) % TAU;
  const x = r * Math.cos(angle), z = r * aspect * Math.sin(angle);
  return [x, (z * Math.cos(node) - x * Math.sin(node)) * Math.tan(tilt), z];
}

/** Conservative sphere bound for framing and separation of entire moving systems. */
export function spatialOrbitExtent(radius: number, plane: OrbitPlane): number {
  const tilt = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, finite(plane.inclination)));
  return Math.max(0, finite(radius)) / Math.cos(tilt);
}

export function orbitTrack(radius: number, plane: OrbitPlane, segments = 160): [number, number, number][] {
  return Array.from({ length: segments + 1 }, (_, index) => spatialOrbitOffset(radius, index / segments * TAU, plane));
}

export function planetSpin(identity: string): PlanetSpin {
  const tilt = radians(22 + motionSeed(identity, 'spin-tilt') * 57), yaw = motionSeed(identity, 'spin-yaw') * TAU;
  return { axis: [Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw)],
    phase: motionSeed(identity, 'spin-phase') * TAU,
    speed: (0.045 + motionSeed(identity, 'spin-speed') * 0.075) * (motionSeed(identity, 'spin-direction') < 0.22 ? -1 : 1) };
}

export function spinQuaternion(spin: PlanetSpin, seconds: number): [number, number, number, number] {
  const elapsed = finite(seconds) % (TAU / Math.abs(spin.speed));
  const half = (spin.phase + elapsed * spin.speed) / 2, sine = Math.sin(half);
  return [spin.axis[0] * sine, spin.axis[1] * sine, spin.axis[2] * sine, Math.cos(half)];
}

export function capabilityRingMotion(identity: string): { rotation: [number, number, number]; speed: number; phase: number } {
  return { rotation: [radians(18 + motionSeed(identity, 'ring-tilt') * 48), motionSeed(identity, 'ring-yaw') * TAU,
    (motionSeed(identity, 'ring-roll') - 0.5) * 0.6], speed: 0.022 + motionSeed(identity, 'ring-speed') * 0.03,
    phase: motionSeed(identity, 'ring-phase') * TAU };
}
