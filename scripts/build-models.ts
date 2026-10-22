import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createUniverseModel, UNIVERSE_MODEL_IDS, UNIVERSE_MODEL_REVISION } from '../src/visual-assets/models';

// GLTFExporter's binary writer expects the browser FileReader contract, but no DOM or
// canvas is needed: these original models use geometry, vertex colours and materials.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: ((event: { target: NodeFileReader }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.({ target: this }); }).catch(error => this.onerror?.(error));
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.({ target: this }); }).catch(error => this.onerror?.(error));
  }
}
if (!globalThis.FileReader) Object.assign(globalThis, { FileReader: NodeFileReader });

const output = fileURLToPath(new URL('../public/models/universe-v1/', import.meta.url));
await mkdir(output, { recursive: true });
const manifest = [];
for (const id of UNIVERSE_MODEL_IDS) {
  const model = createUniverseModel(id);
  const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
  if (!(data instanceof ArrayBuffer)) throw new Error(`Expected binary GLB for ${id}`);
  await writeFile(`${output}${id}.glb`, Buffer.from(data));
  const bounds = new Box3().setFromObject(model), size = bounds.getSize(new Vector3());
  let meshes = 0, triangles = 0;
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
  });
  manifest.push({ id, url: `/models/universe-v1/${id}.glb`, bytes: data.byteLength, meshes, triangles, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() } });
  console.log(`${id}: ${(data.byteLength / 1024).toFixed(1)} KiB, ${meshes} meshes, ${triangles} triangles`);
}
await writeFile(`${output}manifest.json`, `${JSON.stringify({ version: 2, revision: UNIVERSE_MODEL_REVISION, generator: 'scripts/build-models.ts', coordinateSystem: 'Y up; planets centred; buildings and agents grounded; ships forward -Z', assets: manifest }, null, 2)}\n`);
