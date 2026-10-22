export interface DeviceInfoView {
  observedAt: string; status: 'observed' | 'cached'; hostname: string; model: string | null;
  systemName: string; systemVersion: string; arch: string;
  interfaces: { name: string; mac: string | null; addresses: { family: 'IPv4' | 'IPv6'; address: string; netmask: string }[] }[];
}
