/**
 * Decorative far-field nebulas for the isolated demo scenario. Each nebula is a
 * cluster of planets only: no services, skills, voyages or labels are inferred
 * for them, so they can never be mistaken for observed catalogue entries.
 */
export interface DistantNebulaPlanet {
  offset: [number, number, number];
  radius: number;
  color: string;
}

export interface DistantNebula {
  id: string;
  center: [number, number, number];
  planets: DistantNebulaPlanet[];
  haloRadius: number;
  haloColor: string;
}

export const DISTANT_NEBULA_COUNT = 12;

const TONES = ['#8fd8ff', '#9fe8c9', '#f0c98a', '#c7b3ff'] as const;

/** FNV-1a over the identity: stable across renders and independent of array order. */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0) / 0x1_0000_0000;
}

export function distantNebulae(seed: string, ringRadius: number, count = DISTANT_NEBULA_COUNT): DistantNebula[] {
  const radius = Number.isFinite(ringRadius) && ringRadius > 0 ? ringRadius : 20;
  const clusters = Math.max(1, Math.floor(count));
  return Array.from({ length: clusters }, (_, index) => {
    const unit = (channel: string) => hash(`${seed}:distant:${index}:${channel}`);
    const angle = index * 2.399963 + unit('angle') * 0.7;
    const distance = radius * (1.5 + unit('distance') * 0.6);
    const lift = (0.25 + unit('lift') * 0.5) * radius * 0.8;
    const span = radius * (0.08 + unit('span') * 0.06);
    const planetCount = 10 + Math.floor(unit('count') * 3);
    const planets = Array.from({ length: planetCount }, (_, planet) => {
      const part = (channel: string) => hash(`${seed}:distant:${index}:${planet}:${channel}`);
      const theta = part('theta') * Math.PI * 2;
      const phi = Math.acos(2 * part('phi') - 1);
      const spread = span * Math.cbrt(part('spread'));
      return {
        offset: [
          Math.sin(phi) * Math.cos(theta) * spread,
          Math.cos(phi) * spread * 0.7,
          Math.sin(phi) * Math.sin(theta) * spread,
        ] as [number, number, number],
        radius: radius * (0.008 + part('size') * 0.01),
        color: TONES[Math.floor(part('tone') * TONES.length) % TONES.length],
      };
    });
    return {
      id: `demo:distant-nebula:${index}`,
      center: [Math.cos(angle) * distance, lift, Math.sin(angle) * distance],
      planets,
      haloRadius: span * 2.2,
      haloColor: TONES[index % TONES.length],
    };
  });
}
