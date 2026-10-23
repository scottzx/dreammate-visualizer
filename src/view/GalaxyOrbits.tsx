import { useMemo, useRef, type RefObject } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import type { GalaxyLayout, GalaxySystemLayout } from './galaxy-layout';
import { ORBIT_CENTER_Y } from './universe-motion';
import { orbitTrack, type OrbitPlane } from './spatial-motion';

function OrbitPath({ radius, plane, major = false, emphasized = false }: { radius: number; plane: OrbitPlane; major?: boolean; emphasized?: boolean }) {
  const points = useMemo(() => orbitTrack(radius, plane), [radius, plane.inclination, plane.longitude, plane.aspect]);
  return <Line points={points} color={major ? '#728ca2' : '#6ee5ef'} lineWidth={major ? 0.7 : 0.85} transparent
    opacity={major ? emphasized ? 0.28 : 0.14 : 0.28} dashed={major} dashSize={0.5} gapSize={0.5} raycast={() => {}} />;
}

function SolarOrbits({ system, layout, positions }: { system: GalaxySystemLayout; layout: GalaxyLayout; positions: RefObject<Map<string, Vector3>> }) {
  const group = useRef<Group>(null);
  useFrame(() => { const center = positions.current.get(system.centerNodeId); if (center && group.current) group.current.position.copy(center); });
  return <group ref={group}>
    {system.nodeIds.map(id => {
      const orbit = layout.plots.get(id)?.galaxy;
      return orbit && orbit.minorRadius > 0 && orbit.minorPlane
        ? <OrbitPath key={id} radius={orbit.minorRadius} plane={orbit.minorPlane} /> : null;
    })}
  </group>;
}

/** Each visible trajectory uses the same individual plane as the body following it. */
export default function GalaxyOrbits({ layout, positions }: { layout: GalaxyLayout; positions: RefObject<Map<string, Vector3>> }) {
  return <group>
    <group position={[0, ORBIT_CENTER_Y, 0]}>
      {layout.systems.filter(system => system.majorRadius > 0).map(system =>
        <OrbitPath key={system.id} radius={system.majorRadius} plane={system.majorPlane} major emphasized={system.kind === 'entry'} />)}
    </group>
    {layout.systems.filter(system => system.minorRadius > 0).map(system => <SolarOrbits key={system.id} system={system} layout={layout} positions={positions} />)}
  </group>;
}
