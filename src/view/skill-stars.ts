import { Sphere, Vector3, type Object3D, type Points } from 'three';

const bounds = new Sphere();
const star = new Vector3();
const closest = new Vector3();

/** Pick one catalogue point, accounting for the planet's inherited world scale. */
export const raycastSkillStars: Points['raycast'] = function (this: Points, raycaster, intersections) {
  for (let object: Object3D | null = this; object; object = object.parent) if (!object.visible) return;
  const positions = this.geometry.getAttribute('position');
  if (!positions?.count) return;
  const threshold = this.matrixWorld.getMaxScaleOnAxis() * .065;
  this.geometry.computeBoundingSphere();
  bounds.copy(this.geometry.boundingSphere!).applyMatrix4(this.matrixWorld);
  bounds.radius += threshold;
  if (!raycaster.ray.intersectsSphere(bounds)) return;

  let best: (typeof intersections)[number] | undefined;
  let bestDistanceSq = threshold * threshold;
  for (let index = 0; index < positions.count; index++) {
    star.fromBufferAttribute(positions, index).applyMatrix4(this.matrixWorld);
    const distanceSq = raycaster.ray.distanceSqToPoint(star);
    if (distanceSq > bestDistanceSq) continue;
    raycaster.ray.closestPointToPoint(star, closest);
    const distance = raycaster.ray.origin.distanceTo(closest);
    if (distance < raycaster.near || distance > raycaster.far || (distanceSq === bestDistanceSq && best && distance >= best.distance)) continue;
    bestDistanceSq = distanceSq;
    best = { distance, distanceToRay: Math.sqrt(distanceSq), point: closest.clone(), index, object: this };
  }
  if (best) intersections.push(best);
};
