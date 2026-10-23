import type { InterleavedBufferAttribute, Vector3 } from 'three';
import type { LineGeometry } from 'three-stdlib';

/** Update the existing GPU buffers instead of allocating new attributes on every frame. */
export function updateEvidenceLine(geometry: LineGeometry, from: Vector3, to: Vector3): void {
  const start = geometry.getAttribute('instanceStart') as InterleavedBufferAttribute;
  const end = geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute;
  const distanceStart = geometry.getAttribute('instanceDistanceStart') as InterleavedBufferAttribute;
  const distanceEnd = geometry.getAttribute('instanceDistanceEnd') as InterleavedBufferAttribute;
  if (!start || !end || !distanceStart || !distanceEnd) return;
  let x = from.x, y = from.y, z = from.z, distance = 0;
  for (let index = 0; index < start.count; index++) {
    const t = (index + 1) / start.count;
    const nextX = from.x * (1 - t) + to.x * t;
    const nextY = from.y * (1 - t) + to.y * t + Math.sin(t * Math.PI) * 3;
    const nextZ = from.z * (1 - t) + to.z * t;
    start.setXYZ(index, x, y, z); end.setXYZ(index, nextX, nextY, nextZ);
    distanceStart.setX(index, distance);
    distance += Math.hypot(nextX - x, nextY - y, nextZ - z);
    distanceEnd.setX(index, distance);
    x = nextX; y = nextY; z = nextZ;
  }
  start.data.needsUpdate = true;
  distanceStart.data.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}
