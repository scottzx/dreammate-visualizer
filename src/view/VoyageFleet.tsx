import { Suspense, useEffect, useMemo, useRef, type ReactElement, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, Vector3 } from 'three';
import type { BufferAttribute, Group, LineSegments, Mesh, MeshBasicMaterial } from 'three';
import type { Selection, VoyageView } from '../read-model/types';
import { voyageMotion } from '../read-model/voyages';
import { ORBIT_CENTER_Y } from './universe-motion';
import AssetModel from '../visual-assets/AssetModel';
import {
  VOYAGE_BERTH_RADIUS_FACTOR, VOYAGE_DESTINATION_ORBIT_FACTOR, VOYAGE_MAX_FRAME_SECONDS, VOYAGE_MAX_VOYAGES, VOYAGE_SAMPLES_PER_LEG,
  advanceVoyageElapsed, voyageAngle, voyageBow, voyageColor, voyageDockIndex, voyageElapsedFromCycleStart,
  voyageHasError, voyageLateral, voyageOrbitAngle, voyageOrbitTangent, voyageShipScale, voyageLift,
  writeVoyageBerthPoint, writeVoyageLegPoint, writeVoyageOrbitPoint, writeVoyageOuterDockPoint,
} from './voyage-motion';

/**
 * A fleet of small vessels for observed session / ACP voyages.
 *
 * Contract:
 * - `positions` is the shared, parent-owned map that the orbit clock rewrites
 *   every frame; the fleet only reads it and never keeps a copied coordinate.
 * - `elapsed` starts at `Date.now() - cycleStart` once and then advances from
 *   the render-loop delta. With `animate=false` it is frozen, so a paused
 *   snapshot keeps the pose it had when it arrived.
 * - Geometry and attribute buffers are allocated when a voyage's stop count
 *   changes; the render loop only writes into those preallocated arrays.
 */

export interface VoyageFleetProps {
  voyages: VoyageView[];
  positions: RefObject<Map<string, Vector3>>;
  sizes: Map<string, number>;
  layoutRadius: number;
  localNodeId?: string;
  selectedId?: string | null;
  onSelect: (selection: Selection | null) => void;
  animate: boolean;
  cycleStart: string;
  cycleMs: number;
}

interface VoyagePlan {
  id: string;
  originNodeId?: string;
  stops: readonly { id: string; nodeId?: string }[];
  color: string;
  berthAngle: number;
  lateral: number;
  bow: number;
  lifts: number[];
  model: 'ship-base' | 'ship-advanced';
}

const TRAIL_COUNT = 4;
const glowVertex = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const glowFragment = `varying vec2 vUv; uniform vec3 tint; uniform float strength;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float halo = exp(-r * 3.6) * 0.9 + exp(-r * 12.0) * 0.3;
  gl_FragColor = vec4(tint, halo * strength * (1.0 - smoothstep(0.62, 1.0, r)));
}`;

function planFor(voyage: VoyageView): VoyagePlan {
  const seed = voyage.projectId ?? voyage.id;
  return {
    id: voyage.id,
    ...(voyage.originNodeId ? { originNodeId: voyage.originNodeId } : {}),
    stops: voyage.stops.map((stop) => ({ id: stop.id, ...(stop.nodeId ? { nodeId: stop.nodeId } : {}) })),
    color: voyageColor(voyage.kind, voyageHasError(voyage.stops)),
    berthAngle: voyageAngle(seed, 'berth'),
    lateral: voyageLateral(voyage.id),
    bow: voyageBow(voyage.id),
    lifts: voyage.stops.map((_, leg) => voyageLift(voyage.id, leg)),
    model: voyage.kind === 'acp' ? 'ship-advanced' : 'ship-base',
  };
}

function firstPositionId(positions: Map<string, Vector3>): string | undefined {
  for (const id of positions.keys()) return id;
  return undefined;
}

function VoyageCraft({ plan, positions, sizes, layoutRadius, localNodeId, selected, onSelect, animate, cycleStart, cycleMs }: {
  plan: VoyagePlan;
  positions: RefObject<Map<string, Vector3>>;
  sizes: Map<string, number>;
  layoutRadius: number;
  localNodeId?: string;
  selected: boolean;
  onSelect: (selection: Selection | null) => void;
  animate: boolean;
  cycleStart: string;
  cycleMs: number;
}) {
  const ship = useRef<Group>(null);
  const trailRig = useRef<Group>(null);
  const hit = useRef<Mesh>(null);
  const route = useRef<LineSegments>(null);
  const berth = useRef<Group>(null);
  const pulse = useRef<Mesh>(null);
  const pulseMaterial = useRef<MeshBasicMaterial>(null);
  const glow = useRef<Mesh>(null);
  const hovering = useRef(false);
  const elapsed = useRef(voyageElapsedFromCycleStart(cycleStart, Date.now(), cycleMs));
  // The route clock stops at the end of the refresh cycle; the holding orbit keeps
  // advancing so arrived craft never freeze before the next snapshot arrives.
  const orbitElapsed = useRef(0);
  const waypoints = useMemo(() => Array.from({ length: plan.stops.length + 1 }, () => new Vector3()), [plan.stops.length]);
  const scratch = useMemo(() => ({ point: new Vector3(), end: new Vector3(), target: new Vector3() }), []);
  const routePoints = useMemo(() => new Float32Array(Math.max(6, plan.stops.length * (VOYAGE_SAMPLES_PER_LEG - 1) * 6)),
    [plan.stops.length]);
  const trailPositions = useMemo(() => new Float32Array([
    0, 0, -0.52,
    0.08, 0.04, -0.8,
    -0.06, -0.03, -1.08,
    0.03, 0.02, -1.34,
  ]), []);
  const trailColors = useMemo(() => {
    const tint = new Color(plan.color);
    const values = new Float32Array(TRAIL_COUNT * 3);
    [0.9, 0.6, 0.34, 0.15].forEach((fade, index) => values.set([tint.r * fade, tint.g * fade, tint.b * fade], index * 3));
    return values;
  }, [plan.color]);
  const glowUniforms = useMemo(() => ({ tint: { value: new Color(plan.color) }, strength: { value: 0.24 } }), [plan.color]);

  useEffect(() => {
    elapsed.current = voyageElapsedFromCycleStart(cycleStart, Date.now(), cycleMs);
    orbitElapsed.current = 0;
  }, [cycleStart, cycleMs]);

  useEffect(() => () => {
    if (typeof document !== 'undefined' && hovering.current) document.body.style.cursor = '';
  }, []);

  const hover = (event: ThreeEvent<PointerEvent>, active: boolean) => {
    event.stopPropagation();
    if (typeof document === 'undefined' || hovering.current === active) return;
    hovering.current = active;
    document.body.style.cursor = active ? 'pointer' : '';
  };

  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 6) return;
    onSelect({ type: 'voyage', id: plan.id });
  };

  useFrame((state, delta) => {
    const map = positions.current;
    const preferred = plan.originNodeId ?? localNodeId;
    const originId = preferred ?? firstPositionId(map);
    const origin = originId ? map.get(originId) : undefined;
    if (!originId || !origin) {
      if (ship.current) ship.current.visible = false;
      if (trailRig.current) trailRig.current.visible = false;
      if (hit.current) hit.current.visible = false;
      if (route.current) route.current.visible = false;
      if (berth.current) berth.current.visible = false;
      if (pulse.current) pulse.current.visible = false;
      if (glow.current) glow.current.visible = false;
      return;
    }
    const stopCount = plan.stops.length;
    const deviceRadius = sizes.get(originId) ?? 1;
    writeVoyageBerthPoint(waypoints[0], origin, Math.max(0.8, deviceRadius * VOYAGE_BERTH_RADIUS_FACTOR), plan.berthAngle, plan.lateral);

    // Dock on the device's live position but on the side facing the incoming
    // leg, so the hull and route remain outside the planet volume.
    for (let index = 0; index < stopCount; index += 1) {
      const stop = plan.stops[index];
      const device = stop.nodeId ? map.get(stop.nodeId) : undefined;
      const waypoint = waypoints[index + 1];
      if (device) {
        const previous = waypoints[index];
        const dx = device.x - previous.x;
        const dz = device.z - previous.z;
        const horizontal = Math.hypot(dx, dz);
        const clearance = Math.max(0.5, (sizes.get(stop.nodeId!) ?? 1) * 1.08);
        if (horizontal > 1e-4) {
          waypoint.set(device.x - dx / horizontal * clearance, device.y + Math.min(clearance * 0.5, 0.8),
            device.z - dz / horizontal * clearance);
        } else {
          waypoint.set(device.x, device.y + clearance, device.z);
        }
      } else {
        writeVoyageOuterDockPoint(waypoint, layoutRadius, stop.id, ORBIT_CENTER_Y + 0.35);
      }
    }

    elapsed.current = advanceVoyageElapsed(elapsed.current, delta, cycleMs, animate);
    if (animate) orbitElapsed.current += Math.min(Math.max(0, delta), VOYAGE_MAX_FRAME_SECONDS) * 1000;
    const motion = voyageMotion(stopCount, elapsed.current, cycleMs);

    if (route.current) {
      if (stopCount === 0) {
        route.current.visible = false;
      } else {
        const attribute = route.current.geometry.getAttribute('position') as BufferAttribute;
        // GL line strips are not portable here, so the polyline is expressed as
        // independent preallocated segments. Interior samples are duplicated.
        let cursor = 0;
        for (let leg = 0; leg < stopCount; leg += 1) {
          for (let sample = 0; sample < VOYAGE_SAMPLES_PER_LEG - 1; sample += 1) {
            const t0 = sample / (VOYAGE_SAMPLES_PER_LEG - 1);
            const t1 = (sample + 1) / (VOYAGE_SAMPLES_PER_LEG - 1);
            writeVoyageLegPoint(scratch.point, waypoints[leg], waypoints[leg + 1], t0, plan.lifts[leg] ?? 0, plan.bow);
            writeVoyageLegPoint(scratch.end, waypoints[leg], waypoints[leg + 1], t1, plan.lifts[leg] ?? 0, plan.bow);
            routePoints[cursor] = scratch.point.x;
            routePoints[cursor + 1] = scratch.point.y;
            routePoints[cursor + 2] = scratch.point.z;
            routePoints[cursor + 3] = scratch.end.x;
            routePoints[cursor + 4] = scratch.end.y;
            routePoints[cursor + 5] = scratch.end.z;
            cursor += 6;
          }
        }
        attribute.needsUpdate = true;
        route.current.geometry.setDrawRange(0, cursor / 3);
        route.current.visible = true;
      }
    }

    let shipScale = voyageShipScale(deviceRadius);
    const orbitSeed = voyageAngle(plan.id, 'orbit-phase');
    let targetSet = false;
    if (stopCount === 0) {
      // An idle craft keeps circling its project berth instead of freezing.
      const angle = voyageOrbitAngle(plan.id, orbitElapsed.current, 0.5) + orbitSeed;
      writeVoyageOrbitPoint(scratch.point, waypoints[0], Math.max(0.24, deviceRadius * 0.45), angle, deviceRadius * 0.1);
      ship.current?.position.copy(scratch.point);
      const tangent = voyageOrbitTangent(angle);
      scratch.target.copy(scratch.point).add(scratch.end.set(tangent[0], tangent[1], tangent[2]));
      targetSet = true;
    } else if (motion.phase === 'arrived') {
      // The destination is not a parking lot: keep flying a holding orbit around it.
      const destination = plan.stops[stopCount - 1];
      const device = destination.nodeId ? map.get(destination.nodeId) : undefined;
      const center = device ?? waypoints[stopCount];
      const destinationRadius = (destination.nodeId ? sizes.get(destination.nodeId) : undefined) ?? deviceRadius;
      shipScale = voyageShipScale(destinationRadius);
      const orbitRadius = destinationRadius * VOYAGE_DESTINATION_ORBIT_FACTOR;
      const angle = voyageOrbitAngle(plan.id, orbitElapsed.current) + orbitSeed;
      writeVoyageOrbitPoint(scratch.point, center, orbitRadius, angle, orbitRadius * 0.16);
      ship.current?.position.copy(scratch.point);
      const tangent = voyageOrbitTangent(angle);
      scratch.target.copy(scratch.point).add(scratch.end.set(tangent[0], tangent[1], tangent[2]));
      targetSet = true;
    } else if (motion.phase === 'dock') {
      // Hover along the planet's tangent instead of circling through the planet.
      const leg = Math.min(motion.leg, stopCount);
      const stop = plan.stops[leg - 1];
      const device = stop?.nodeId ? map.get(stop.nodeId) : undefined;
      const waypoint = waypoints[leg];
      let tx = 0, tz = 1;
      if (device) {
        const dx = waypoint.x - device.x, dz = waypoint.z - device.z;
        const length = Math.hypot(dx, dz);
        if (length > 1e-4) { tx = -dz / length; tz = dx / length; }
      }
      const drift = Math.sin(orbitElapsed.current * 0.0012 + orbitSeed) * deviceRadius * 0.18;
      scratch.point.set(waypoint.x + tx * drift, waypoint.y + Math.sin(orbitElapsed.current * 0.002 + orbitSeed) * deviceRadius * 0.1,
        waypoint.z + tz * drift);
      ship.current?.position.copy(scratch.point);
      scratch.target.copy(scratch.point).add(scratch.end.set(tx, 0, tz));
      targetSet = true;
    } else if (motion.phase === 'travel') {
      const leg = Math.min(motion.leg, stopCount - 1);
      writeVoyageLegPoint(scratch.point, waypoints[leg], waypoints[leg + 1], motion.t, plan.lifts[leg] ?? 0, plan.bow);
      scratch.point.y += Math.sin(elapsed.current * 0.0016 + orbitSeed) * 0.12;
      ship.current?.position.copy(scratch.point);
      scratch.target.copy(waypoints[leg + 1]);
      targetSet = true;
    } else {
      const angle = voyageOrbitAngle(plan.id, orbitElapsed.current, 0.5) + orbitSeed;
      writeVoyageOrbitPoint(scratch.point, waypoints[0], Math.max(0.18, deviceRadius * 0.3), angle, deviceRadius * 0.06);
      ship.current?.position.copy(scratch.point);
      if (stopCount > 0) scratch.target.copy(waypoints[1]);
      else {
        const tangent = voyageOrbitTangent(angle);
        scratch.target.copy(scratch.point).add(scratch.end.set(tangent[0], tangent[1], tangent[2]));
      }
      targetSet = true;
    }

    if (ship.current) {
      ship.current.visible = true;
      ship.current.scale.setScalar(shipScale);
      if (targetSet && scratch.target.distanceToSquared(ship.current.position) > 1e-6) ship.current.lookAt(scratch.target);
    }
    if (trailRig.current && ship.current) {
      trailRig.current.visible = true;
      trailRig.current.position.copy(ship.current.position);
      trailRig.current.quaternion.copy(ship.current.quaternion);
    }
    if (hit.current && ship.current) {
      hit.current.visible = true;
      hit.current.position.copy(ship.current.position);
    }
    if (berth.current) {
      berth.current.visible = true;
      berth.current.position.copy(waypoints[0]);
    }
    if (glow.current) {
      glow.current.visible = true;
      if (ship.current) glow.current.position.copy(ship.current.position);
      glow.current.quaternion.copy(state.camera.quaternion);
      const glowScale = Math.max(1.4, deviceRadius * 0.8);
      glow.current.scale.set(glowScale, glowScale, 1);
    }
    glowUniforms.strength.value = selected ? 0.46 : 0.28;

    if (pulse.current && pulseMaterial.current) {
      const dockIndex = voyageDockIndex(motion, stopCount);
      if (dockIndex > 0) {
        const stop = plan.stops[dockIndex - 1];
        const size = (stop?.nodeId ? sizes.get(stop.nodeId) : undefined) ?? 1;
        pulse.current.visible = true;
        pulse.current.position.copy(waypoints[dockIndex]);
        pulse.current.position.y += Math.max(0.7, size * 1.2);
        const wave = animate ? ((elapsed.current / 1000) % 2) / 2 : 0.25;
        pulse.current.scale.setScalar(Math.max(0.5, size * 0.85) * (0.8 + wave * 1.1));
        pulseMaterial.current.opacity = (animate ? 1 - wave : 0.55) * (selected ? 0.42 : 0.26);
      } else {
        pulse.current.visible = false;
      }
    }
  });

  return <group>
    {plan.stops.length > 0 && <lineSegments ref={route} visible={false} frustumCulled={false} raycast={() => {}}>
      <bufferGeometry key={routePoints.length}>
        <bufferAttribute attach="attributes-position" args={[routePoints, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={plan.color} transparent opacity={selected ? 0.72 : 0.48}
        blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>}

    <group ref={berth} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <ringGeometry args={[0.58, 0.68, 32]} />
        <meshBasicMaterial color={plan.color} transparent opacity={0.38} blending={AdditiveBlending}
          depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <ringGeometry args={[0.82, 0.85, 32]} />
        <meshBasicMaterial color={plan.color} transparent opacity={0.18} blending={AdditiveBlending}
          depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>

    <mesh ref={glow} visible={false} scale={[2.8, 2.8, 1]} raycast={() => {}}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={glowUniforms} vertexShader={glowVertex} fragmentShader={glowFragment}
        transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>

    <group ref={ship} visible={false}>
      <Suspense fallback={<mesh><octahedronGeometry args={[0.45, 0]} /><meshBasicMaterial color={plan.color} toneMapped={false} /></mesh>}>
        <AssetModel id={plan.model} />
      </Suspense>
    </group>

    <group ref={trailRig} visible={false}>
      <points raycast={() => {}} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={0.18} sizeAttenuation transparent opacity={0.9}
          blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
    </group>

    {/* A transparent pick sphere keeps the small hull easy to select from a distance. */}
    <mesh ref={hit} visible={false} onPointerOver={(event) => hover(event, true)} onPointerOut={(event) => hover(event, false)} onClick={choose}>
      <sphereGeometry args={[1.15, 8, 6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>

    <mesh ref={pulse} visible={false} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[0.72, 0.9, 40]} />
      <meshBasicMaterial ref={pulseMaterial} color={plan.color} transparent opacity={0.26}
        blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
  </group>;
}

export default function VoyageFleet({ voyages, positions, sizes, layoutRadius, localNodeId, selectedId, onSelect, animate,
  cycleStart, cycleMs }: VoyageFleetProps): ReactElement | null {
  const plans = useMemo(() => voyages.slice(0, VOYAGE_MAX_VOYAGES).map(planFor), [voyages]);
  if (!plans.length) return null;
  return <group name="voyage-fleet">
    {plans.map((plan) => <VoyageCraft key={`${plan.id}:${plan.stops.length}`} plan={plan} positions={positions} sizes={sizes}
      layoutRadius={layoutRadius} localNodeId={localNodeId} selected={selectedId === plan.id} onSelect={onSelect}
      animate={animate} cycleStart={cycleStart} cycleMs={cycleMs} />)}
  </group>;
}
