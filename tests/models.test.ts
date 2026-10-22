import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createUniverseModel, UNIVERSE_MODEL_IDS } from '../src/visual-assets/models';

const epsilon = 1e-5;
const dimensions = (id: string) => new Box3().setFromObject(createUniverseModel(id));

test('all reusable assets are genuine finite 3D geometry within the GLB size budget', async () => {
  for (const id of UNIVERSE_MODEL_IDS) {
    const data = await readFile(new URL(`../public/models/universe-v1/${id}.glb`, import.meta.url));
    assert.equal(data.readUInt32LE(0), 0x46546c67, `${id} has GLB magic`);
    assert.equal(data.readUInt32LE(4), 2, `${id} uses glTF 2.0`);
    assert.ok(data.length > 10_000 && data.length < 900_000, `${id} has an appropriate size (${data.length})`);
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const imported = await new GLTFLoader().parseAsync(arrayBuffer, '');
    let meshCount = 0;
    imported.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      meshCount++;
      const position = object.geometry.getAttribute('position');
      assert.ok(position.count >= 3, `${id}/${object.name} has vertices`);
      for (let i = 0; i < position.count; i++) {
        assert.ok(Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i)), `${id} contains finite coordinates`);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert.equal('map' in material ? material.map : null, null, `${id} needs no bitmap texture`);
      }
    });
    assert.ok(meshCount >= 10, `${id} contains composed model parts`);
    const bounds = new Box3().setFromObject(imported.scene);
    const size = bounds.getSize(new Vector3());
    assert.ok(size.x > .1 && size.y > .1 && size.z > .1, `${id} has volume in three axes`);
    const source = dimensions(id);
    assert.ok(bounds.min.distanceTo(source.min) < epsilon && bounds.max.distanceTo(source.max) < epsilon, `${id} retains its construction bounds through GLB export/import`);
  }
});

test('all building types have identical ground lots and total height', () => {
  const expected = new Vector3(4, 2, 4);
  for (const id of ['workshop-base', 'workshop-advanced', 'academy', 'service-factory']) {
    const bounds = dimensions(id);
    assert.ok(bounds.getSize(new Vector3()).distanceTo(expected) < epsilon, `${id} has the 4 x 4 x 2 envelope`);
    assert.ok(Math.abs(bounds.min.y) < epsilon, `${id} is grounded`);
  }
});

test('device orbs have distinct engineered shells, exposed emissive cores and compact geometry', () => {
  const hub = createUniverseModel('planet-hub'), peripheral = createUniverseModel('planet-peripheral');
  for (const model of [hub, peripheral]) {
    assert.ok(model.getObjectByName('dyson-structural-lattice'));
    assert.ok(model.getObjectByName('dyson-collector-panels'));
    const coreBounds = new Box3().setFromObject(model.getObjectByName(model === hub ? 'amber-reactor-core' : 'cyan-compute-core')!);
    const shellBounds = new Box3().setFromObject(model.getObjectByName('dyson-structural-lattice')!);
    assert.ok(coreBounds.getSize(new Vector3()).length() / shellBounds.getSize(new Vector3()).length() < .3, 'a small sun remains separate from the outer shell');
  }
  assert.ok(hub.getObjectByName('reactor-orbital-infrastructure'));
  assert.ok(peripheral.getObjectByName('compute-orbital-infrastructure'));
  for (const [model, coreName] of [[hub, 'amber-reactor-core'], [peripheral, 'cyan-compute-core']] as const) {
    const core = model.getObjectByName(coreName) as Mesh;
    assert.ok(core.material instanceof MeshStandardMaterial);
    assert.ok(core.material.emissiveIntensity >= 2 && core.material.emissive.getHex() !== 0, 'core emits light without a bitmap');
    assert.equal(model.getObjectByName('ocean-and-continents'), undefined, 'device identity uses mechanical construction');
    let meshCount = 0, farthest = 0;
    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      meshCount++;
      const positions = object.geometry.getAttribute('position');
      const vertex = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        farthest = Math.max(farthest, vertex.length());
      }
    });
    assert.ok(meshCount <= 24, 'repeated shell and relay geometry is merged to limit device draw calls');
    assert.ok(farthest < 1.5 && farthest > 1.1, 'all orbital detail stays within the existing interaction envelope');
  }
});

test('constructors produce independent objects and reject unknown model identifiers', () => {
  const a = createUniverseModel('agent-base'), b = createUniverseModel('agent-base');
  a.position.x = 100;
  assert.equal(b.position.x, 0);
  assert.notEqual(a.children[0], b.children[0]);
  assert.throws(() => createUniverseModel('missing-model'), /Unknown universe model/);
});
