import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, PerspectiveCamera, PointsMaterial, ShaderMaterial, Vector3 } from 'three';
import type { UniverseLayout } from './universe-layout';
import { stableNodeHash } from './layout';
import { orbitAngularSpeed, orbitInclination, orbitRingPoint, ORBIT_CENTER_Y } from './universe-motion';

/** Decorative display layers encode no tasks, calls, or unobserved device relations. */
export const UNIVERSE_VISUALS = {
  cyan: '#62efff', ice: '#bcecff', amber: '#ffbc67', violet: '#8d74e6',
  background: '#020813', orbitOpacity: 0.33,
} as const;

function visualRandom(seed: string) {
  let value = stableNodeHash(seed);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function useDisplayClock(animate: boolean, phase = 0) {
  const elapsed = useRef(phase);
  useFrame((_, delta) => { if (animate) elapsed.current += Math.min(delta, 0.05); });
  return elapsed;
}

const planeVertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const nebulaFragment = `
  varying vec2 vUv; uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float cloud(vec2 p){return noise(p)*.57+noise(p*2.13)*.28+noise(p*4.27)*.15;}
  void main(){
    vec2 uv=(vUv-.5)*vec2(1.7,1.0); vec2 p=uv*5.0+vec2(time*.004,0.);
    float dust=cloud(p+cloud(p*1.5));
    float ribbon=exp(-pow((uv.y+uv.x*.22+.10*sin(uv.x*6.0))*3.1,2.0));
    float edge=1.0-smoothstep(.18,.82,length(uv));
    vec3 color=mix(vec3(.015,.15,.24),vec3(.13,.055,.25),smoothstep(-.5,.7,uv.x));
    color+=vec3(.025,.15,.20)*exp(-length(uv-vec2(-.30,.09))*4.0);
    color+=vec3(.19,.07,.012)*exp(-length(uv-vec2(.12,-.04))*7.0);
    gl_FragColor=vec4(color,(.24+dust*.8)*ribbon*edge*.58);
  }
`;

export function UniverseBackdrop({ animate }: { animate: boolean }) {
  const plane = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const { camera, size } = useThree();
  const direction = useMemo(() => new Vector3(), []);
  const time = useDisplayClock(animate);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  useFrame(() => {
    if (plane.current) {
      camera.getWorldDirection(direction);
      plane.current.position.copy(camera.position).addScaledVector(direction, 150);
      plane.current.quaternion.copy(camera.quaternion);
      if (camera instanceof PerspectiveCamera && size.height > 0) {
        const height = 2 * 150 * Math.tan(camera.fov * Math.PI / 360) / camera.zoom;
        plane.current.scale.set(height * size.width / size.height / 125 * 1.2, height / 82 * 1.2, 1);
      }
    }
    if (material.current) material.current.uniforms.time.value = time.current;
  });
  return <group ref={plane} renderOrder={-100}>
    <mesh raycast={() => {}}>
      <planeGeometry args={[125, 82]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={planeVertex} fragmentShader={nebulaFragment}
        transparent blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  </group>;
}

export function UniverseStars({ animate }: { animate: boolean }) {
  const bright = useRef<PointsMaterial>(null);
  const time = useDisplayClock(animate, 0.6);
  // A world-space sky surrounds the whole navigable system. Rotating the camera reveals a different sky.
  const fields = useMemo(() => [3200, 180].map((count, field) => {
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = `stellar-${field}-${index}`;
      const vertical = visualRandom(`height:${seed}`) * 2 - 1;
      const azimuth = visualRandom(`azimuth:${seed}`) * Math.PI * 2;
      const radius = 6500 + visualRandom(`depth:${seed}`) * 2500;
      const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      array[index * 3] = radius * horizontal * Math.cos(azimuth);
      array[index * 3 + 1] = radius * vertical;
      array[index * 3 + 2] = radius * horizontal * Math.sin(azimuth);
    }
    return array;
  }), []);
  useFrame(() => { if (bright.current) bright.current.opacity = 0.67 + Math.sin(time.current * 0.32) * 0.12; });
  return <group>
    <points raycast={() => {}}><bufferGeometry><bufferAttribute attach="attributes-position" args={[fields[0], 3]} /></bufferGeometry>
      <pointsMaterial color="#8eaccd" size={1.15} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} />
    </points>
    <points raycast={() => {}}><bufferGeometry><bufferAttribute attach="attributes-position" args={[fields[1], 3]} /></bufferGeometry>
      <pointsMaterial ref={bright} color="#c4efff" size={2.25} sizeAttenuation={false} transparent opacity={0.74} depthWrite={false} blending={AdditiveBlending} />
    </points>
  </group>;
}

const ringVertex = `varying vec2 vPosition; void main(){vPosition=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const ringFragment = `
  varying vec2 vPosition; uniform vec3 tint; uniform float time; uniform float opacity; uniform float segments; uniform float speed;
  void main(){
    float angle=atan(vPosition.y,vPosition.x)/6.28318530718+.5;
    float progress=fract(angle+time*speed);
    float segment=step(.18,fract(progress*segments));
    float thin=pow(1.-abs(fract(length(vPosition)*8.)-.5)*2.,4.);
    float sweep=pow(max(0.,1.-fract(progress+.13)*2.1),5.);
    float light=.38+segment*.4+sweep*1.6+thin*.12;
    gl_FragColor=vec4(tint*light,opacity*(segment*.72+.19+sweep*.8));
  }
`;

function HoloRing({ radius, width = 0.035, color, opacity = 0.6, segments = 24, speed = 0.015, animate, rotation = [-Math.PI / 2, 0, 0], position = [0, 0, 0] }: {
  radius: number; width?: number; color: string; opacity?: number; segments?: number; speed?: number; animate: boolean;
  rotation?: [number, number, number]; position?: [number, number, number];
}) {
  const material = useRef<ShaderMaterial>(null);
  const time = useDisplayClock(animate);
  const uniforms = useMemo(() => ({ tint: { value: new Color(color) }, time: { value: 0 }, opacity: { value: opacity },
    segments: { value: segments }, speed: { value: speed } }), [color, opacity, segments, speed]);
  useFrame(() => { if (material.current) material.current.uniforms.time.value = time.current; });
  return <mesh rotation={rotation} position={position} raycast={() => {}}>
    <ringGeometry args={[radius - width / 2, radius + width / 2, 192]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={ringVertex} fragmentShader={ringFragment}
      transparent blending={AdditiveBlending} depthWrite={false} side={2} toneMapped={false} />
  </mesh>;
}

const auraVertex = `varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`;
const auraFragment = `uniform vec3 tint;uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.7);gl_FragColor=vec4(tint,rim*strength);}`;
const glowFragment = `varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){vec2 p=vUv-.5;float r=length(p);float halo=exp(-r*18.)*.72+exp(-r*r*60.)*.14;float flare=exp(-abs(p.y)*280.)*exp(-abs(p.x)*10.)*.22;vec3 color=mix(tint,vec3(1.,.96,.81),exp(-r*48.));gl_FragColor=vec4(color,(halo+flare)*strength*(1.-smoothstep(.35,.5,r)));}`;

export function PlanetHologram({ radius, core, color, selected, animate }: {
  radius: number; core: boolean; color: string; selected: boolean; animate: boolean;
}) {
  const assembly = useRef<Group>(null);
  const glow = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const time = useDisplayClock(animate);
  const aura = useMemo(() => ({ tint: { value: new Color(color) }, strength: { value: selected ? .22 : .065 } }), [color, selected]);
  const halo = useMemo(() => ({ tint: { value: new Color(core ? '#ffb340' : '#73d7ff') }, strength: { value: core ? 1.25 : .85 } }), [core]);
  const particles = useMemo(() => {
    const count = core ? 1100 : 540, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = visualRandom(`photon-angle:${i}`) * Math.PI * 2;
      const orbit = 1.34 + visualRandom(`photon-orbit:${i}`) * .47;
      positions.set([Math.cos(angle) * orbit, (visualRandom(`photon-height:${i}`) - .5) * .032, Math.sin(angle) * orbit], i * 3);
      const tint = new Color(i % 9 === 0 ? '#6ac9f0' : core ? '#ffce8c' : '#a6dcec');
      colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    return { positions, colors };
  }, [core]);
  useFrame(() => {
    if (assembly.current) assembly.current.rotation.y = time.current * (core ? 0.035 : -0.025);
    if (glow.current) glow.current.quaternion.copy(camera.quaternion);
  });
  return <group>
    <group ref={glow}>
      <mesh raycast={() => {}}><planeGeometry args={[radius * 4.6, radius * 4.6]} />
        <shaderMaterial uniforms={halo} vertexShader={planeVertex} fragmentShader={glowFragment} transparent blending={AdditiveBlending}
          depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
    <mesh scale={radius * 1.025} raycast={() => {}}><sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial uniforms={aura} vertexShader={auraVertex} fragmentShader={auraFragment} transparent blending={AdditiveBlending}
        depthWrite={false} side={BackSide} toneMapped={false} />
    </mesh>
    <group ref={assembly}>
      <group rotation={[.43, -.16, -.35]} scale={radius}>
        <points raycast={() => {}}><bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particles.colors, 3]} />
        </bufferGeometry><pointsMaterial vertexColors size={.018 * radius} transparent opacity={.88} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></points>
      </group>
      <HoloRing radius={radius * 1.72} width={radius * .006} color={core ? '#f1c58b' : '#86bfd3'} opacity={.32} animate={animate}
        rotation={[-Math.PI / 2 + .43, -.16, -.35]} segments={96} speed={-.012} />
      {selected && <HoloRing radius={radius * 1.96} width={radius * .011} color={UNIVERSE_VISUALS.ice}
        opacity={.5} animate={animate} rotation={[-Math.PI / 2, 0, 0]} segments={48} speed={.008} />}
    </group>
  </group>;
}

function OrbitMarker({ radius, index, animate, color }: { radius: number; index: number; animate: boolean; color: string }) {
  const group = useRef<Group>(null);
  const time = useDisplayClock(animate, index * 19.7);
  useFrame(() => { if (group.current) group.current.position.set(...orbitRingPoint(radius, time.current * orbitAngularSpeed() + index)); });
  return <group ref={group}>
    <mesh raycast={() => {}}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}><ringGeometry args={[0.1, 0.17, 20]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  </group>;
}

export function UniverseOrbitalGrid({ layout, animate }: { layout: UniverseLayout; animate: boolean }) {
  return <group>{layout.rings.map((radius) => {
    const rotation: [number, number, number] = [Math.PI / 2 - orbitInclination(), 0, 0];
    return <group key={radius}>
      <HoloRing radius={radius} color="#63bfd4" width={0.035} opacity={UNIVERSE_VISUALS.orbitOpacity}
        position={[0, ORBIT_CENTER_Y, 0]} rotation={rotation} animate={animate} segments={120} speed={-0.002} />
      <HoloRing radius={radius + 0.18} color="#4188a1" width={0.01} opacity={0.22} position={[0, ORBIT_CENTER_Y, 0]} rotation={rotation}
        animate={animate} segments={1} speed={0} />
      {Array.from({ length: 3 }, (_, marker) => <OrbitMarker key={marker} radius={radius} index={marker * Math.PI * 2 / 3} animate={animate} color={UNIVERSE_VISUALS.cyan} />)}
    </group>;
  })}</group>;
}

/** A fixed exhaust silhouette follows the illustrative fleet; no activity intensity is inferred. */
export function FleetExhaust({ core }: { core: boolean }) {
  const color = core ? '#85f6ff' : '#5dcfff';
  return <group position={[0, 0, core ? 0.27 : 0.19]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} raycast={() => {}}><coneGeometry args={[core ? 0.065 : 0.04, 0.45, 10]} />
      <meshBasicMaterial color={color} transparent opacity={0.42} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0, 0.015]} raycast={() => {}}><sphereGeometry args={[core ? 0.07 : 0.045, 10, 8]} />
      <meshBasicMaterial color="#d5ffff" toneMapped={false} />
    </mesh>
  </group>;
}
