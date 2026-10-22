import type { NodeView } from './types';

export const GB = 1000 ** 3;
export const GIB = 1024 ** 3;
export const STORAGE_REFERENCE_BYTES = 64 * GB;
export const STORAGE_REFERENCE_RADIUS = 1.8;
export const DEFAULT_STORAGE_BYTES = 128 * GB;
export const DEFAULT_STORAGE_RADIUS = STORAGE_REFERENCE_RADIUS * Math.cbrt(DEFAULT_STORAGE_BYTES / STORAGE_REFERENCE_BYTES);

export function validStorageBytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function nodeStorageBytes(node?: Pick<NodeView, 'storage'>): number | null {
  const bytes = node?.storage?.totalBytes;
  return validStorageBytes(bytes) ? bytes : null;
}

/** One global scale: V ∝ total storage, so r = r64 × cbrt(bytes / 64 GB). */
export function nodeStorageRadius(node?: Pick<NodeView, 'storage'>): number {
  const bytes = nodeStorageBytes(node) ?? DEFAULT_STORAGE_BYTES;
  return STORAGE_REFERENCE_RADIUS * Math.cbrt(bytes / STORAGE_REFERENCE_BYTES);
}

export function formatNodeStorage(node?: Pick<NodeView, 'storage'>): string {
  const bytes = nodeStorageBytes(node);
  if (bytes === null) return '128 GB · 默认';
  const capacity = bytes >= 1000 * GB ? `${Number((bytes / (1000 * GB)).toFixed(2))} TB`
    : bytes >= GB ? `${Number((bytes / GB).toFixed(1))} GB` : `${Number((bytes / 1000 ** 2).toFixed(1))} MB`;
  return `${capacity}${node?.storage?.status === 'cached' ? ' · 缓存' : ''}`;
}
