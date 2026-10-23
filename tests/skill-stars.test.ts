import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Points, Raycaster, Vector3, type Intersection } from 'three';
import { raycastSkillStars } from '../src/view/skill-stars';

function stars(positions: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const points = new Points(geometry);
  points.raycast = raycastSkillStars;
  return points;
}
function pick(points: Points, x: number, y = 0, near = 0, far = Infinity) {
  points.updateWorldMatrix(true, false);
  const hits: Intersection[] = [];
  points.raycast(new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1), near, far), hits);
  return hits;
}

test('Skill picking selects the closest star to the pointer without the default wide point threshold', () => {
  const points = stars([0, 0, 0, .05, 0, 2]);
  assert.equal(pick(points, .01)[0]?.index, 0, 'a slightly nearer star in depth must not steal another star');
  assert.equal(pick(points, .05)[0]?.index, 1);
  assert.equal(pick(points, .2).length, 0, 'blank ring space cannot select a neighbouring Skill');
});

test('Skill picking respects inherited planet scale, tilted rings and ray clipping', () => {
  const points = stars([1.3, 0, 0]);
  const planet = new Group();
  planet.scale.setScalar(3);
  planet.rotation.z = Math.PI / 2;
  planet.add(points);
  assert.equal(pick(points, .12, 3.9)[0]?.index, 0);
  assert.equal(pick(points, .21, 3.9).length, 0);
  assert.equal(pick(points, 0, 3.9, 11).length, 0);
  assert.equal(pick(points, 0, 3.9, 0, 9).length, 0);
  planet.scale.setScalar(.25);
  assert.equal(pick(points, .01, .325)[0]?.index, 0);
  assert.equal(pick(points, .02, .325).length, 0, 'small planets retain a proportionate target');
});

test('overlapping Skill stars resolve one identity and updated catalogues refresh their hit bounds', () => {
  const points = stars([0, 0, 0, 0, 0, 2]);
  assert.deepEqual(pick(points, 0).map(hit => hit.index), [1], 'the frontmost star wins an exact overlap');
  points.geometry.setAttribute('position', new Float32BufferAttribute([5, 0, 0], 3));
  assert.equal(pick(points, 0).length, 0);
  assert.equal(pick(points, 5)[0]?.index, 0);
  assert.equal(pick(stars([]), 0).length, 0);
});

test('hidden Skill rings cannot intercept clicks after the planet becomes a distant point', () => {
  const points = stars([0, 0, 0]);
  const effects = new Group();
  effects.add(points);
  effects.visible = false;
  assert.equal(pick(points, 0).length, 0);
  effects.visible = true;
  assert.equal(pick(points, 0)[0]?.index, 0);
  points.visible = false;
  assert.equal(pick(points, 0).length, 0);
});
