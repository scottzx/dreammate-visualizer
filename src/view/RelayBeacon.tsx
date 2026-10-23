import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

/** Identifies the DERP infrastructure role; the planet's storage volume stays unchanged. */
export default function RelayBeacon({ radius, time, color = '#efbd70' }: { radius: number; time: RefObject<number>; color?: string }) {
  const rings = useRef<Group>(null);
  useFrame(() => { if (rings.current) rings.current.rotation.y = time.current * 0.08; });
  return <group ref={rings}>
    {[1.5, 1.9].map((scale, index) => <mesh key={scale} rotation={[-Math.PI / 2 + index * 0.3, index * 0.4, 0]} raycast={() => {}}>
      <torusGeometry args={[radius * scale, radius * 0.018, 6, 96]} />
      <meshBasicMaterial color={color} transparent opacity={index ? 0.38 : 0.8} depthWrite={false} toneMapped={false} />
    </mesh>)}
    <mesh position={[0, radius * 1.85, 0]} raycast={() => {}}>
      <cylinderGeometry args={[radius * 0.012, radius * 0.012, radius * 1.4, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0, radius * 2.65, 0]} rotation={[0, 0, Math.PI / 4]} raycast={() => {}}>
      <octahedronGeometry args={[radius * 0.11]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  </group>;
}
