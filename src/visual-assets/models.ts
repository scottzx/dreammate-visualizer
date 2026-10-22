import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, Group,
  Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry,
  Vector3, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Asset IDs are stable: scenes use these IDs, never the original style-review PNGs. */
export const UNIVERSE_MODEL_IDS = [
  'planet-hub', 'planet-peripheral', 'ship-base', 'ship-advanced',
  'workshop-base', 'workshop-advanced', 'agent-base', 'agent-resident',
  'academy', 'service-factory',
] as const;
export type UniverseModelId = typeof UNIVERSE_MODEL_IDS[number];
export const UNIVERSE_MODEL_BASE_URL = '/models/universe-v1';
export const UNIVERSE_MODEL_REVISION = 'dyson-lattice-v3.1';
export const BUILDING_ENVELOPE = { width: 4, depth: 4, height: 2 } as const;

const PALETTE = {
  shell: '#d9e1e1', bright: '#f0ede4', frame: '#243547', dark: '#111f2e',
  steel: '#617b8c', orange: '#f99a35', blue: '#396b9d', cyan: '#58e8f3',
};

function materials() {
  const metal = (color: string, roughness = .47, metalness = .55) => new MeshStandardMaterial({ color, roughness, metalness });
  return {
    shell: metal(PALETTE.shell), bright: metal(PALETTE.bright, .35),
    frame: metal(PALETTE.frame, .46, .75), dark: metal(PALETTE.dark),
    steel: metal(PALETTE.steel), orange: metal(PALETTE.orange, .43, .35),
    blue: metal(PALETTE.blue),
    cyan: new MeshStandardMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 2, roughness: .3, metalness: .2 }),
    glass: new MeshStandardMaterial({ color: '#1a5370', emissive: '#123849', emissiveIntensity: .4, roughness: .18, metalness: .8 }),
  };
}
type Kit = ReturnType<typeof materials>;

function mesh(parent: Group, name: string, geometry: BufferGeometry, material: Material, at: [number, number, number] = [0, 0, 0]) {
  const object = new Mesh(geometry, material);
  object.name = name;
  object.position.set(...at);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: Group, name: string, size: [number, number, number], at: [number, number, number], material: Material, bevel = .035) {
  return mesh(parent, name, bevel > 0 ? new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(v => v / 4))) : new BoxGeometry(...size), material, at);
}

function ring(parent: Group, name: string, radius: number, tube: number, at: [number, number, number], material: Material, horizontal = true) {
  const object = mesh(parent, name, new TorusGeometry(radius, tube, 6, 48), material, at);
  if (horizontal) object.rotation.x = -Math.PI / 2;
  return object;
}

function cylinder(parent: Group, name: string, radius: number, height: number, at: [number, number, number], material: Material, radial = 24) {
  return mesh(parent, name, new CylinderGeometry(radius, radius, height, radial), material, at);
}

function mergedParts(parent: Group, name: string, geometries: BufferGeometry[], material: Material) {
  const geometry = mergeGeometries(geometries);
  if (!geometry) throw new Error(`Unable to merge ${name}`);
  geometries.forEach(part => part.dispose());
  return mesh(parent, name, geometry, material);
}

const luminous = (color: string, strength: number) => new MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: strength, roughness: .24, metalness: .25,
});

/** An open Dyson lattice with a small sun, collector tiles and fine structural ribs. */
function planet(hub: boolean) {
  const root = new Group();
  const warm = hub ? '#ffd18a' : '#a7e4f3';
  const frame = luminous(hub ? '#bd9660' : '#548eaa', .7);
  const seams = luminous(warm, 1.35);
  const collector = new MeshStandardMaterial({ color: hub ? '#b2a58a' : '#648497',
    emissive: hub ? '#f1cf96' : '#81b3ca', emissiveIntensity: .28, metalness: .48, roughness: .36, side: DoubleSide });
  const darkCollector = new MeshStandardMaterial({ color: '#17394d', emissive: '#1f6a85',
    emissiveIntensity: .35, metalness: .58, roughness: .4, side: DoubleSide });
  mesh(root, hub ? 'amber-reactor-core' : 'cyan-compute-core', new SphereGeometry(.27, 32, 20),
    luminous(hub ? '#ff9c13' : '#50ccff', 3.2));
  mesh(root, 'stellar-white-heart', new SphereGeometry(.17, 24, 16), luminous(hub ? '#fff0bd' : '#e1faff', 5));

  const ribs: BufferGeometry[] = [], tiles: BufferGeometry[] = [], blueTiles: BufferGeometry[] = [], lights: BufferGeometry[] = [];
  const meridians = 20;
  for (let i = 0; i < meridians; i++) {
    const phi = i / meridians * Math.PI * 2;
    const points = Array.from({ length: 25 }, (_, j) => {
      const theta = .11 + j / 24 * (Math.PI - .22);
      return new Vector3(-Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).multiplyScalar(1.02);
    });
    ribs.push(new TubeGeometry(new CatmullRomCurve3(points), 32, .0042, 3, false));
  }
  for (let band = 1; band < 10; band++) {
    const theta = band / 10 * Math.PI;
    const latitude = new TorusGeometry(Math.sin(theta) * 1.02, .004, 3, 80);
    latitude.rotateX(Math.PI / 2); latitude.translate(0, Math.cos(theta) * 1.02, 0);
    ribs.push(latitude);
    for (let sector = 0; sector < meridians; sector++) {
      // Fixed, irregular construction gaps expose the sun from every direction.
      const code = (sector * 17 + band * 31) % 13;
      if (code < 8 || (band === 5 && sector % 4 !== 0)) continue;
      const phi = sector / meridians * Math.PI * 2 + .025;
      const span = Math.PI * 2 / meridians - .05;
      const tile = new SphereGeometry(1.012, 2, 2, phi, span, theta + .022, Math.PI / 10 - .044);
      (code === 12 ? blueTiles : tiles).push(tile);
      lights.push(new SphereGeometry(1.024, 2, 1, phi, span, theta + .022, .007));
    }
  }
  mergedParts(root, 'dyson-structural-lattice', ribs, frame);
  mergedParts(root, 'dyson-collector-panels', tiles, collector);
  mergedParts(root, 'dyson-blue-collector-panels', blueTiles, darkCollector);
  mergedParts(root, 'dyson-panel-light-seams', lights, seams);

  const orbital = new Group(); orbital.name = hub ? 'reactor-orbital-infrastructure' : 'compute-orbital-infrastructure';
  orbital.rotation.set(.43, -.16, -.35);
  mesh(orbital, 'fine-orbital-track', new TorusGeometry(1.37, .005, 3, 128).rotateX(Math.PI / 2), seams);
  const relays: BufferGeometry[] = [], signals: BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const relay = new BoxGeometry(.06, .024, .045);
    relay.rotateY(-angle); relay.translate(Math.cos(angle) * 1.37, 0, Math.sin(angle) * 1.37); relays.push(relay);
    const signal = new SphereGeometry(.013, 5, 4);
    signal.translate(Math.cos(angle) * 1.37, .022, Math.sin(angle) * 1.37); signals.push(signal);
  }
  mergedParts(orbital, 'orbital-relay-modules', relays, collector);
  mergedParts(orbital, 'orbital-relay-signals', signals, seams);
  root.add(orbital);
  const polar = new Group(); polar.rotation.z = .28;
  mesh(polar, 'polar-skeletal-orbit', new TorusGeometry(1.13, .0035, 3, 96), frame);
  root.add(polar);
  return root;
}

function ship(advanced: boolean) {
  const root = new Group(), m = materials();
  box(root, 'central-keel', [.9, .38, 3.5], [0, 0, .1], m.frame, .12);
  box(root, 'upper-hull', [1.02, .39, 2.5], [0, .23, -.05], m.shell, .12);
  const nose = box(root, 'command-cabin', [.87, .43, 1.1], [0, .17, -1.42], m.bright, .16);
  nose.rotation.x = -.12;
  box(root, 'cabin-visor', [.67, .16, .12], [0, .3, -1.955], m.glass, .035);
  box(root, 'navigation-strip', [.28, .035, .06], [0, .23, -2.02], m.cyan, .01);
  for (const side of [-1, 1]) {
    box(root, `pod-link-${side}`, [.55, .12, 1.3], [side * .67, -.02, .25], m.steel);
    box(root, `service-pod-${side}`, [.64, .48, 2.12], [side * 1.02, .02, .33], m.shell, .12);
    box(root, `pod-inset-${side}`, [.5, .045, 1.24], [side * 1.02, .28, .33], m.frame, .02);
    box(root, `pod-mark-${side}`, [.16, .055, .32], [side * 1.02, .3, -.18], m.orange, .012);
    const engine = cylinder(root, `engine-${side}`, .235, .58, [side * .9, -.02, 1.58], m.frame);
    engine.rotation.x = Math.PI / 2;
    const nozzle = ring(root, `engine-nozzle-${side}`, .15, .036, [side * .9, -.02, 1.89], m.steel, false);
    nozzle.rotation.y = 0;
    const glow = cylinder(root, `engine-core-${side}`, .12, .015, [side * .9, -.02, 1.908], m.cyan, 20);
    glow.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) box(root, `spine-panel-${i}`, [.7, .035, .4], [0, .455, -.5 + i * .55], m.bright, .015);
  if (advanced) {
    ring(root, 'integrated-energy-coupler', .72, .055, [0, .08, .25], m.steel, false);
    ring(root, 'coupler-core', .645, .02, [0, .08, .255], m.cyan, false);
    for (const side of [-1, 1]) for (const z of [-.7, .7]) {
      box(root, `auxiliary-bay-${side}-${z}`, [.43, .28, .55], [side * .61, .37, z], m.frame, .05);
      box(root, `bay-cap-${side}-${z}`, [.35, .05, .44], [side * .61, .535, z], m.bright, .02);
    }
    box(root, 'sensor-panel', [.38, .07, .24], [0, .53, -.65], m.orange);
  }
  return root;
}

function building(type: 'base' | 'advanced' | 'academy' | 'factory') {
  const root = new Group(), m = materials();
  // All building variants share this exact exterior envelope. Upgrades live inside it.
  box(root, 'foundation-4-by-4', [4, .16, 4], [0, .08, 0], m.steel, .06);
  box(root, 'foundation-inlay', [3.88, .06, 3.88], [0, .19, 0], m.frame);
  box(root, 'inner-volume', [3.3, 1.35, 3.3], [0, .94, 0], m.frame, .04);
  for (const x of [-1.67, 1.67]) for (const z of [-1.67, 1.67]) {
    box(root, `corner-${x}-${z}`, [.43, 1.58, .43], [x, 1.06, z], m.frame, .07);
    box(root, `corner-cap-${x}-${z}`, [.52, .15, .52], [x, 1.925, z], m.bright, .045);
    box(root, `corner-orange-${x}-${z}`, [.45, .08, .45], [x, 1.79, z], m.orange, .02);
    box(root, `corner-shell-${x}-${z}`, [.44, 1.13, .22], [x, 1.07, z + Math.sign(z) * .13], m.shell, .03);
    box(root, `corner-interface-${x}-${z}`, [.06, .48, .025], [x, .98, z + Math.sign(z) * .248], m.cyan, .008);
  }
  for (const side of [-1, 1]) {
    box(root, `side-wall-${side}`, [.12, .97, 2.8], [side * 1.72, .85, 0], m.shell);
    box(root, `side-conduit-${side}`, [.035, .045, 2.62], [side * 1.79, 1.36, 0], m.cyan, .009);
    box(root, `wall-vent-${side}`, [.035, .24, .82], [side * 1.79, .94, .48], m.frame, .01);
    for (let i = 0; i < 4; i++) box(root, `vent-slat-${side}-${i}`, [.04, .018, .68], [side * 1.815, .86 + i * .053, .48], m.steel, 0);
    box(root, `rear-panel-${side}`, [1.37, .97, .12], [side * .75, .85, -1.72], m.shell);
    box(root, `front-panel-${side}`, [.86, .97, .12], [side * 1.06, .85, 1.72], m.shell);
    box(root, `roof-rail-${side}`, [.38, .18, 2.9], [side * 1.42, 1.69, 0], m.bright);
  }
  for (const z of [-1.42, 0, 1.42]) box(root, `roof-cross-${z}`, [3.1, .18, .28], [0, 1.69, z], m.bright);
  box(root, 'door-frame', [1.1, 1.35, .28], [0, .86, 1.69], m.frame, .06);
  box(root, 'door', [.74, .99, .06], [0, .7, 1.858], m.dark, .025);
  box(root, 'door-seam', [.025, .9, .025], [0, .7, 1.9], m.steel, .005);
  box(root, 'entrance-light', [.56, .055, .03], [0, 1.3, 1.883], m.cyan, .012);
  box(root, 'access-panel', [.12, .21, .045], [.43, .85, 1.88], m.orange, .015);
  // The step stays inside the shared 4 x 4 lot.
  box(root, 'entrance-step', [.95, .1, .22], [0, .27, 1.84], m.steel, .02);
  box(root, 'roof-equipment-bed', [2.36, .09, 2.35], [0, 1.43, 0], m.dark);
  if (type !== 'base') {
    cylinder(root, 'compute-base', .47, .12, [-.45, 1.55, -.67], m.steel);
    ring(root, 'compute-ring', .37, .065, [-.45, 1.635, -.67], m.shell);
    cylinder(root, 'compute-core', .23, .035, [-.45, 1.65, -.67], m.cyan);
    for (let i = 0; i < 3; i++) {
      box(root, `compute-rack-${i}`, [.37, .21, .72], [-.6 + i * .59, 1.585, .68], type === 'academy' ? m.blue : m.shell);
      box(root, `rack-light-${i}`, [.24, .022, .09], [-.6 + i * .59, 1.703, .48], m.cyan, .005);
      box(root, `rack-safety-${i}`, [.13, .025, .17], [-.6 + i * .59, 1.705, .8], m.orange, .008);
    }
    for (const side of [-1, 1]) box(root, `advanced-conduit-${side}`, [.1, .035, 2.2], [side * 1.1, 1.58, 0], m.cyan, .008);
  } else {
    for (const z of [-.7, .7]) box(root, `empty-bay-${z}`, [1.85, .035, .87], [0, 1.497, z], m.steel, .025);
  }
  if (type === 'academy') {
    // Academy has a horizontal library canopy, rather than a taller silhouette.
    for (let i = 0; i < 4; i++) box(root, `archive-module-${i}`, [.28, .17, .76], [-.56 + i * .37, 1.69, -.68], m.blue, .02);
    box(root, 'academy-identity', [.55, .18, .035], [0, 1.55, 1.86], m.blue);
    box(root, 'academy-symbol', [.15, .09, .04], [0, 1.55, 1.89], m.cyan, .01);
  }
  if (type === 'factory') {
    for (const x of [-.58, .58]) {
      cylinder(root, `service-tank-${x}`, .24, .32, [x, 1.65, -.65], m.shell);
      ring(root, `service-collar-${x}`, .245, .025, [x, 1.76, -.65], m.orange);
    }
    box(root, 'factory-identity', [.55, .18, .035], [0, 1.55, 1.86], m.orange);
  }
  return root;
}

function agent(resident: boolean) {
  const root = new Group(), m = materials();
  for (const side of [-1, 1]) {
    const leg = new Group(); leg.name = `leg-${side}`; leg.position.x = side * .2;
    box(leg, 'boot', [.29, .19, .44], [0, .095, .065], m.frame, .045);
    box(leg, 'lower-leg', [.2, .4, .21], [0, .37, 0], m.shell, .045);
    cylinder(leg, 'knee', .115, .17, [0, .57, 0], m.frame, 12).rotation.z = Math.PI / 2;
    box(leg, 'upper-leg', [.22, .26, .22], [0, .71, 0], m.shell, .045);
    root.add(leg);
    const arm = new Group(); arm.name = `arm-${side}`; arm.position.set(side * .43, 1.18, 0);
    mesh(arm, 'shoulder-joint', new SphereGeometry(.12, 12, 8), m.frame);
    box(arm, 'shoulder-shell', [.24, .21, .26], [side * .025, -.02, 0], resident ? m.blue : m.shell, .055);
    box(arm, 'shoulder-mark', [.12, .03, .02], [side * .025, .03, .143], m.orange, .005);
    box(arm, 'forearm', [.18, .29, .21], [side * .025, -.27, 0], m.shell, .045);
    box(arm, 'hand', [.14, .14, .16], [side * .025, -.49, .02], m.frame, .035);
    root.add(arm);
  }
  box(root, 'hip-frame', [.54, .18, .31], [0, .85, 0], m.frame, .06);
  box(root, 'torso-core', [.59, .43, .34], [0, 1.12, 0], m.shell, .09);
  box(root, 'torso-plate', [.43, .25, .055], [0, 1.17, .187], m.bright, .04);
  const badge = cylinder(root, 'identity-badge', .075, .027, [0, 1.19, .225], resident ? m.cyan : m.steel, resident ? 6 : 16);
  badge.rotation.x = Math.PI / 2;
  cylinder(root, 'neck', .09, .13, [0, 1.41, 0], m.frame, 12);
  box(root, 'head', [.42, .34, .34], [0, 1.62, 0], m.bright, .085);
  box(root, 'visor-recess', [.34, .13, .055], [0, 1.64, .17], m.frame, .03);
  box(root, 'cyan-visor', [.27, .065, .025], [0, 1.64, .206], m.cyan, .025);
  if (resident) {
    box(root, 'specialist-toolpack', [.41, .35, .16], [0, 1.15, -.25], m.blue, .04);
    box(root, 'toolpack-spine', [.12, .27, .035], [0, 1.15, -.347], m.orange, .015);
    box(root, 'forearm-tool', [.12, .22, .13], [.49, .9, .14], m.steel, .035);
    box(root, 'tool-interface', [.07, .06, .035], [.49, .95, .215], m.cyan, .012);
  }
  return root;
}

export function isUniverseModelId(id: string): id is UniverseModelId {
  return (UNIVERSE_MODEL_IDS as readonly string[]).includes(id);
}

export function createUniverseModel(id: UniverseModelId | string): Group {
  if (!isUniverseModelId(id)) throw new Error(`Unknown universe model: ${id}`);
  let root: Group;
  switch (id) {
    case 'planet-hub': root = planet(true); break;
    case 'planet-peripheral': root = planet(false); break;
    case 'ship-base': root = ship(false); break;
    case 'ship-advanced': root = ship(true); break;
    case 'workshop-base': root = building('base'); break;
    case 'workshop-advanced': root = building('advanced'); break;
    case 'academy': root = building('academy'); break;
    case 'service-factory': root = building('factory'); break;
    case 'agent-base': root = agent(false); break;
    case 'agent-resident': root = agent(true); break;
  }
  root.name = id;
  root.userData = { assetId: id, version: 1, generatedGeometry: true, orientation: id.startsWith('ship') ? 'forward -Z' : 'front +Z' };
  root.updateMatrixWorld(true);
  return root;
}
