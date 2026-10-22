export const UNIVERSE_OVERVIEW_FOV = 45;

/** Fit the ring and planet/fleet envelope in the narrower perspective field of view. */
export function universeOverviewDistance(ringRadius: number, planetRadius: number, aspect: number): number {
  const radius = Number.isFinite(ringRadius) && ringRadius > 0 ? ringRadius : 0;
  const planet = Number.isFinite(planetRadius) && planetRadius > 0 ? planetRadius : 1.05;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const verticalHalfFov = UNIVERSE_OVERVIEW_FOV * Math.PI / 360;
  const halfFov = Math.min(verticalHalfFov, Math.atan(Math.tan(verticalHalfFov) * ratio));
  // Leave clearance for projected labels and the navigation toolbar below the ring.
  return Math.max(18, (radius + planet * 2.4) / Math.sin(halfFov) * 1.3);
}
