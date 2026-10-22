import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { UNIVERSE_MODEL_BASE_URL, UNIVERSE_MODEL_REVISION, type UniverseModelId } from './models';

export type AssetModelProps = Omit<ThreeElements['group'], 'children' | 'id'> & { id: UniverseModelId | string };

/** Shared cached GLB geometry/materials, independent transforms for each visible instance. */
export function AssetModel({ id, ...props }: AssetModelProps) {
  const { scene } = useGLTF(`${UNIVERSE_MODEL_BASE_URL}/${id}.glb?rev=${UNIVERSE_MODEL_REVISION}`);
  const instance = useMemo(() => scene.clone(true), [scene]);
  return <group {...props}><primitive object={instance} dispose={null} /></group>;
}

export function preloadUniverseModel(id: UniverseModelId) {
  useGLTF.preload(`${UNIVERSE_MODEL_BASE_URL}/${id}.glb?rev=${UNIVERSE_MODEL_REVISION}`);
}

export default AssetModel;
