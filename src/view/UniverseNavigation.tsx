import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, PerspectiveCamera, TOUCH, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { universeOverviewDistance, UNIVERSE_OVERVIEW_FOV } from './universe-framing';
import { ORBIT_CENTER_Y } from './universe-motion';
import type { GalaxySystemLayout } from './galaxy-layout';

export interface UniverseNavigationAction {
  sequence: number;
  type: 'zoom-in' | 'zoom-out' | 'overview' | 'focus-selected' | 'focus-service-system';
}

export const UNIVERSE_CAMERA = {
  fov: UNIVERSE_OVERVIEW_FOV,
  minDistance: 5,
  maxDistance: 5000,
  overviewOffset: [0, 72, 60] as const,
} as const;

/** Screen size follows perspective depth, including for selected devices. */
export function projectedRadiusPx(camera: PerspectiveCamera, position: Vector3, radius: number, height: number): number {
  const depth = -position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  if (depth <= camera.near) return 0;
  return radius * height / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * depth);
}

interface UniverseNavigationProps {
  resetKey: number;
  action?: UniverseNavigationAction;
  positions: RefObject<Map<string, Vector3>>;
  sizes: Map<string, number>;
  ringRadius: number;
  localSystem?: GalaxySystemLayout;
  selectedIds: Set<string>;
  orbitTime: RefObject<number>;
  sceneElement: RefObject<HTMLDivElement | null>;
}

/** Full spherical navigation, separate from the illustrative physical orbit clock. */
export default function UniverseNavigation({ resetKey, action, positions, sizes, ringRadius, localSystem, selectedIds, orbitTime, sceneElement }: UniverseNavigationProps) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const following = useRef<string | null>(null);
  const overviewMode = useRef(true);
  const lastTarget = useRef(new Vector3());
  const lastMetrics = useRef(-Infinity);
  const offset = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const selected = useRef(selectedIds);
  selected.current = selectedIds;
  const maxPlanetRadius = Math.max(1.05, ...sizes.values());
  const fitDistance = universeOverviewDistance(ringRadius, maxPlanetRadius, size.width / size.height);
  const maxDistance = Math.max(UNIVERSE_CAMERA.maxDistance, fitDistance * 3);

  function overview() {
    const orbit = controls.current;
    if (!orbit) return;
    target.set(0, ORBIT_CENTER_Y, 0);
    orbit.target.copy(target);
    offset.set(...UNIVERSE_CAMERA.overviewOffset).setLength(fitDistance);
    camera.position.copy(target).add(offset);
    following.current = null;
    overviewMode.current = true;
    lastTarget.current.copy(target);
    orbit.update();
    camera.updateMatrixWorld();
    invalidate();
  }

  useLayoutEffect(overview, [camera, resetKey]);
  // Auto-fit a growing ring only while in overview; preserve deliberate camera navigation.
  useLayoutEffect(() => { if (overviewMode.current) overview(); }, [fitDistance]);
  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!orbit || !action) return;
    if (action.type === 'overview') { overview(); return; }
    if (action.type === 'focus-selected' || action.type === 'focus-service-system') {
      const id = action.type === 'focus-service-system' ? localSystem?.centerNodeId : [...selected.current].find((value) => positions.current.has(value));
      const position = id && positions.current.get(id);
      if (!position || !id) { overview(); return; }
      offset.copy(camera.position).sub(orbit.target);
      if (offset.lengthSq() < 0.001) offset.set(...UNIVERSE_CAMERA.overviewOffset);
      offset.setLength(action.type === 'focus-service-system' && localSystem
        ? universeOverviewDistance(localSystem.minorRadius, localSystem.maxPlanetRadius, size.width / size.height)
        : Math.max(6, (sizes.get(id) ?? 1) * 7));
      orbit.target.copy(position);
      camera.position.copy(position).add(offset);
      following.current = id;
      lastTarget.current.copy(position);
    } else {
      offset.copy(camera.position).sub(orbit.target);
      offset.setLength(MathUtils.clamp(offset.length() * (action.type === 'zoom-in' ? 0.68 : 1.48), UNIVERSE_CAMERA.minDistance, maxDistance));
      camera.position.copy(orbit.target).add(offset);
    }
    overviewMode.current = false;
    orbit.update();
    camera.updateMatrixWorld();
    invalidate();
  }, [action?.sequence]);

  useFrame(({ clock }) => {
    const orbit = controls.current;
    if (!orbit || !(camera instanceof PerspectiveCamera)) return;
    const focus = following.current && positions.current.get(following.current);
    if (focus) {
      // Rotation and zoom preserve following. A deliberate two-finger/right-button pan releases it.
      if (orbit.target.distanceToSquared(lastTarget.current) > 0.0025) following.current = null;
      else {
        offset.copy(focus).sub(lastTarget.current);
        orbit.target.add(offset);
        camera.position.add(offset);
        lastTarget.current.copy(focus);
      }
    }
    camera.updateMatrixWorld();
    if (clock.elapsedTime - lastMetrics.current >= 0.15 && sceneElement.current) {
      const element = sceneElement.current;
      const selectedId = [...selected.current].find((id) => positions.current.has(id));
      const focusPosition = selectedId && positions.current.get(selectedId);
      element.dataset.cameraDistance = orbit.getDistance().toFixed(2);
      element.dataset.cameraPosition = camera.position.toArray().map((value) => value.toFixed(2)).join(',');
      element.dataset.cameraTarget = orbit.target.toArray().map((value) => value.toFixed(2)).join(',');
      element.dataset.selectedRadiusPx = focusPosition ? projectedRadiusPx(camera, focusPosition, sizes.get(selectedId!) ?? 1, size.height).toFixed(3) : '0';
      element.dataset.navigationMode = following.current ? 'following' : overviewMode.current ? 'overview' : 'manual';
      element.dataset.followedNodeId = following.current ?? '';
      element.dataset.orbitTime = orbitTime.current.toFixed(3);
      lastMetrics.current = clock.elapsedTime;
    }
  }, -0.5);

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.085}
    minDistance={UNIVERSE_CAMERA.minDistance} maxDistance={maxDistance}
    onStart={() => { overviewMode.current = false; }}
    minPolarAngle={0.005} maxPolarAngle={Math.PI - 0.005}
    rotateSpeed={0.55} zoomSpeed={1.1} panSpeed={0.7} screenSpacePanning
    touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }} />;
}
