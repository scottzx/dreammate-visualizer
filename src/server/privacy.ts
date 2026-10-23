import { createHmac, randomBytes } from 'node:crypto';
import type { ObserverSnapshot } from '../read-model/types';
import { containsIpAddress, redactIpText } from '../read-model/ip-privacy';

/** One-way, process-scoped references retain links without publishing address-bearing identifiers. */
export function createSnapshotRedactor(key: Uint8Array = randomBytes(32)) {
  const opaque = (value: string) => `private:${createHmac('sha256', key).update(value).digest('hex').slice(0, 24)}`;
  function visit(value: unknown, field = ''): unknown {
    if (typeof value === 'string') {
      if (!containsIpAddress(value)) return value;
      return /(?:^id$|Id$|Ids$|^layoutScope$)/.test(field) ? opaque(value) : redactIpText(value);
    }
    if (Array.isArray(value)) return value.map(item => visit(item, field));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) =>
      [containsIpAddress(name) ? opaque(name) : name, visit(item, name)]));
    return value;
  }
  return (snapshot: ObserverSnapshot): ObserverSnapshot => ({ ...visit(snapshot) as ObserverSnapshot, privacy: { ipAddresses: 'hidden' } });
}

export const redactSnapshot = createSnapshotRedactor();
