import type { DeviceInfoView } from '../read-model/device-info';
import { array, object, string } from './http';

export function projectDeviceInfo(value: unknown, nodeId: string): DeviceInfoView | undefined {
  const raw = object(value), system = object(raw.system);
  if (raw.protocol !== 'dreammate.device.v1' || raw.node_id !== nodeId || !string(raw.collected_at)
    || !Number.isFinite(Date.parse(string(raw.collected_at))) || !Array.isArray(raw.interfaces)) return;
  return { observedAt: string(raw.collected_at), status: 'observed', hostname: string(raw.hostname), model: string(raw.model) || null,
    systemName: string(system.name), systemVersion: string(system.version), arch: string(system.arch),
    interfaces: raw.interfaces.flatMap(value => {
      const nic = object(value); if (!string(nic.name)) return [];
      return [{ name: string(nic.name), mac: string(nic.mac) || null, addresses: array(nic.addresses).flatMap(value => {
        const ip = object(value);
        return ['IPv4', 'IPv6'].includes(string(ip.family)) && string(ip.address) && string(ip.netmask)
          ? [{ family: ip.family as 'IPv4' | 'IPv6', address: string(ip.address), netmask: string(ip.netmask) }] : [];
      }) }];
    }) };
}
