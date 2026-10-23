import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, type Group } from 'three';
import { distantNebulae } from '../read-model/distant-nebulae';

/**
 * Far-field background: a dozen faint nebulas, each a small cluster of planets.
 * They carry no services, skills, labels or interactions; this is scenery for the
 * isolated demo, never evidence of another observed network.
 */
export default function DistantNebulae({ seed, ringRadius, animate }: { seed: string; ringRadius: number; animate: boolean }) {
  const field = useRef<Group>(null);
  const clusters = useMemo(() => distantNebulae(seed, ringRadius), [seed, ringRadius]);
  const glow = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,.75)');
      gradient.addColorStop(.32, 'rgba(255,255,255,.22)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);
  useFrame((_, delta) => { if (animate && field.current) field.current.rotation.y += delta * 0.0035; });
  return <group ref={field} raycast={() => {}}>
    {clusters.map(cluster => <group key={cluster.id} position={cluster.center}>
      <sprite scale={[cluster.haloRadius, cluster.haloRadius, 1]} raycast={() => {}}>
        <spriteMaterial map={glow} color={cluster.haloColor} transparent opacity={0.34} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      {cluster.planets.map((planet, index) => <mesh key={index} position={planet.offset} raycast={() => {}}>
        <sphereGeometry args={[planet.radius, 10, 8]} />
        <meshBasicMaterial color={planet.color} transparent opacity={0.92} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>)}
    </group>)}
  </group>;
}
