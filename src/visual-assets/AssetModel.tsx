import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { Color, Mesh, MeshStandardMaterial, type Material } from 'three';
import { UNIVERSE_MODEL_BASE_URL, UNIVERSE_MODEL_REVISION, type UniverseModelId } from './models';

export type AssetModelProps = Omit<ThreeElements['group'], 'children' | 'id'> & { id: UniverseModelId | string; monochrome?: boolean; hideOrbitalRelays?: boolean; illuminated?: boolean };

/** Shared cached GLB geometry/materials, independent transforms for each visible instance. */
export function AssetModel({ id, monochrome = false, hideOrbitalRelays = false, illuminated = true, ...props }: AssetModelProps) {
  const { scene } = useGLTF(`${UNIVERSE_MODEL_BASE_URL}/${id}.glb?rev=${UNIVERSE_MODEL_REVISION}`);
  const { instance, owned } = useMemo(() => {
    const instance = scene.clone(true), owned: Material[] = [];
    instance.traverse(object => {
      if (hideOrbitalRelays && object.name.endsWith('-orbital-infrastructure')) object.visible = false;
      if ((!monochrome && illuminated) || !(object instanceof Mesh)) return;
      const convert = (original: Material) => {
        const material = original.clone(); owned.push(material);
        if (monochrome) for (const key of ['color', 'emissive'] as const) {
          const color = (material as unknown as Record<string, unknown>)[key];
          if (color instanceof Color) {
            const gray = color.r * .2126 + color.g * .7152 + color.b * .0722;
            color.setRGB(gray * .8, gray * .84, gray * .9);
          }
        }
        if (!illuminated && material instanceof MeshStandardMaterial) {
          material.emissiveIntensity = 0;
          material.color.multiplyScalar(0.16);
        }
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
    });
    return { instance, owned };
  }, [scene, monochrome, hideOrbitalRelays, illuminated]);
  useEffect(() => () => { owned.forEach(material => material.dispose()); }, [owned]);
  return <group {...props}><primitive object={instance} dispose={null} /></group>;
}

export function preloadUniverseModel(id: UniverseModelId) {
  useGLTF.preload(`${UNIVERSE_MODEL_BASE_URL}/${id}.glb?rev=${UNIVERSE_MODEL_REVISION}`);
}

export default AssetModel;
