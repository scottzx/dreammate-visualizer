import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validStorageBytes } from '../read-model/storage';
import { object, string } from './http';

const execute = promisify(execFile);

/** Only top-level internal physical disks; APFS partitions/volumes are never added again. */
export function internalStorageTotal(value: unknown): number | undefined {
  const disks = object(value).AllDisksAndPartitions;
  if (!Array.isArray(disks) || disks.length === 0) return undefined;
  const sizes = new Map<string, number>();
  for (const entry of disks) {
    const disk = object(entry), id = string(disk.DeviceIdentifier), size = disk.Size;
    if (!id || !validStorageBytes(size) || (sizes.has(id) && sizes.get(id) !== size)) return undefined;
    sizes.set(id, size);
  }
  const total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  return validStorageBytes(total) ? total : undefined;
}

/** Read-only macOS disk inventory. Other observer hosts need a reported device total. */
export async function readObserverStorage(): Promise<number | undefined> {
  if (process.platform !== 'darwin') return undefined;
  try {
    const { stdout } = await execute('/bin/sh', ['-c',
      '/usr/sbin/diskutil list -plist internal physical | /usr/bin/plutil -convert json -o - -'],
    { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 });
    return internalStorageTotal(JSON.parse(stdout));
  } catch { return undefined; }
}
