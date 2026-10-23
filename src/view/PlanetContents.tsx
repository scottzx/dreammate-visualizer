import { useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, Group } from 'three';
import type { FactorySceneProps, ServiceView } from '../read-model/types';
import { PROJECT_COLORS, type PlanetContents, type PlanetSkill, type PlanetStorageComposition } from '../read-model/planet-contents';
import { stableNodeHash } from './layout';
import { capabilityRingMotion } from './spatial-motion';
import { raycastSkillStars } from './skill-stars';

const TAU = Math.PI * 2;
const random = (id: string) => stableNodeHash(id) / 0xffffffff;
export type OrbitHover = ({ type: 'service'; service: ServiceView } | { type: 'skill'; skill: PlanetSkill }) & { clientX: number; clientY: number };

function CapabilitySatellite({ service, angle, selected, gestureMoved, onSelect, onHover, illuminated }: {
  service: ServiceView; angle: number; selected: boolean; gestureMoved: RefObject<boolean>; illuminated: boolean;
  onSelect: FactorySceneProps['onSelect']; onHover: (hover: OrbitHover | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = !illuminated ? '#303b48' : selected || hovered ? '#dbfaff' : service.status === 'up' ? '#7cdef1' : '#8794a4';
  const hover = (event: ThreeEvent<PointerEvent>) => {
    if (gestureMoved.current && event.buttons) return;
    event.stopPropagation(); setHovered(true);
    onHover({ type: 'service', service, clientX: event.clientX, clientY: event.clientY });
  };
  return <group position={[Math.cos(angle) * 1.72, .045, Math.sin(angle) * 1.72]} rotation={[0, -angle, 0]}
    onPointerOver={hover} onPointerMove={hover} onPointerOut={() => { setHovered(false); onHover(null); }}
    onClick={event => { event.stopPropagation(); if (event.delta <= 6 && !gestureMoved.current) onSelect({ type: 'service', id: service.id }); }}>
    <mesh><octahedronGeometry args={[.072, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={illuminated ? selected || hovered ? 1.1 : .5 : 0} metalness={.5} roughness={.3} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[0, 0, side * .105]}>
      <boxGeometry args={[.09, .014, .12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={illuminated ? .22 : 0} metalness={.65} roughness={.35} />
    </mesh>)}
    <mesh><sphereGeometry args={[.17, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>;
}

/** Semantic layers: no sampled fleet or decorative particle count stands in for a catalogue. */
export function CapabilityOrbit({ contents, radius, seed, time, selectedServiceId, selectedSkillId, gestureMoved, onSelect, onHover, illuminated = true }: {
  contents: PlanetContents; radius: number; seed: string; time: RefObject<number>; selectedServiceId?: string; selectedSkillId?: string;
  gestureMoved: RefObject<boolean>; onSelect: FactorySceneProps['onSelect']; onHover: (hover: OrbitHover | null) => void; illuminated?: boolean;
}) {
  const orbit = useRef<Group>(null);
  const [hoveredSkillId, setHoveredSkillId] = useState<string>();
  const motion = useMemo(() => capabilityRingMotion(seed), [seed]);
  const phase = motion.phase;
  const points = useMemo(() => {
    const positions = new Float32Array(contents.skills.length * 3);
    contents.skills.forEach((skill, index) => {
      const angle = random(`skill-angle:${seed}:${skill.id}`) * TAU;
      const distance = 1.14 + random(`skill-radius:${seed}:${skill.id}`) * .39;
      positions.set([Math.cos(angle) * distance, (random(`skill-height:${seed}:${skill.id}`) - .5) * .05, Math.sin(angle) * distance], index * 3);
    });
    return positions;
  }, [contents.skills, seed]);
  const colors = useMemo(() => {
    const values = new Float32Array(contents.skills.length * 3);
    contents.skills.forEach((skill, index) => {
      const active = skill.id === hoveredSkillId || skill.id === selectedSkillId;
      const color = new Color(active ? '#fff2cf' : illuminated ? skill.cached ? '#7f8997' : '#ffda96' : '#303b48');
      values.set([color.r, color.g, color.b], index * 3);
    });
    return values;
  }, [contents.skills, illuminated, hoveredSkillId, selectedSkillId]);
  const highlighted = useMemo(() => new Float32Array(contents.skills.flatMap((skill, index) =>
    skill.id === hoveredSkillId || skill.id === selectedSkillId ? Array.from(points.subarray(index * 3, index * 3 + 3)) : [])),
  [contents.skills, points, hoveredSkillId, selectedSkillId]);
  const hoverSkill = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (gestureMoved.current && event.buttons) return;
    const skill = event.index === undefined ? undefined : contents.skills[event.index];
    if (!skill) return;
    setHoveredSkillId(skill.id);
    onHover({ type: 'skill', skill, clientX: event.clientX, clientY: event.clientY });
  };
  useFrame(() => { if (orbit.current) orbit.current.rotation.y = phase - time.current * motion.speed; });
  const ringColor = !illuminated ? '#263341' : contents.catalogKnown ? '#81b6c5' : '#8c939f';
  return <group rotation={motion.rotation} scale={radius}>
    <group ref={orbit} rotation={[0, phase, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <torusGeometry args={[1.72, .0045, 4, 192]} />
        <meshBasicMaterial color={ringColor} transparent opacity={illuminated ? .34 : .16} depthWrite={false} toneMapped={false} />
      </mesh>
      {contents.skills.length > 0 && <points raycast={raycastSkillStars}
        onPointerOver={hoverSkill} onPointerMove={hoverSkill} onPointerOut={() => { setHoveredSkillId(undefined); onHover(null); }}
        onClick={event => {
          event.stopPropagation();
          const skill = event.index === undefined ? undefined : contents.skills[event.index];
          if (skill && event.delta <= 6 && !gestureMoved.current) onSelect({ type: 'skill', id: skill.id, serviceId: skill.serviceId });
        }}>
        <bufferGeometry key={points.length}><bufferAttribute attach="attributes-position" args={[points, 3]} /><bufferAttribute attach="attributes-color" args={[colors, 3]} /></bufferGeometry>
        <pointsMaterial vertexColors size={radius * .026} transparent opacity={illuminated ? .96 : .2} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>}
      {highlighted.length > 0 && <points raycast={() => {}}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[highlighted, 3]} /></bufferGeometry>
        <pointsMaterial color="#fff2cf" size={radius * .07} transparent opacity={.96} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>}
      {contents.services.map((service, index) => <CapabilitySatellite key={service.id} service={service} angle={index / contents.services.length * TAU}
        selected={selectedServiceId === service.id} gestureMoved={gestureMoved} onSelect={onSelect} onHover={onHover} illuminated={illuminated} />)}
    </group>
  </group>;
}

/** Longitude sectors have the same area share as their measured byte share. */
export function ProjectStorageSurface({ composition, illuminated = true }: { composition: PlanetStorageComposition; illuminated?: boolean }) {
  let offset = 0;
  return <group raycast={() => {}}>
    <mesh><sphereGeometry args={[.998, 64, 40]} /><meshBasicMaterial color={illuminated ? PROJECT_COLORS.unknown : '#1b232d'} transparent opacity={.12} depthWrite={false} /></mesh>
    {composition.segments.flatMap(segment => {
      if (segment.share === null || segment.share <= 0) return [];
      const start = offset; offset += segment.share * TAU;
      return <mesh key={segment.category}>
        <sphereGeometry args={[1.027, Math.max(2, Math.ceil(segment.share * 192)), 48, start, segment.share * TAU]} />
        <meshBasicMaterial color={illuminated ? PROJECT_COLORS[segment.category] : new Color(PROJECT_COLORS[segment.category]).multiplyScalar(.12)} transparent opacity={.74} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>;
    })}
  </group>;
}
