export const HIDDEN_IP = '[IP 已隐藏]';

function isIpLiteral(value: string): boolean {
  const bare = value.replace(/^\[|\]$/g, '').split('%')[0];
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(bare)) return bare.split('.').every(part => Number(part) <= 255);
  if (!bare.includes(':')) return false;
  try { return new URL(`http://[${bare}]/`).hostname.startsWith('['); } catch { return false; }
}

function scrubLiteralText(value: string): string {
  // URL parsing also recognizes numeric and hexadecimal IPv4 host spellings.
  const urls = value.replace(/[a-z][a-z\d+.-]*:\/\/[^\s<>"'`]+/gi, candidate => {
    try {
      const url = new URL(candidate);
      return isIpLiteral(url.hostname)
        ? `${url.protocol}//${HIDDEN_IP}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}${url.hash}` : candidate;
    } catch { return candidate; }
  });
  const ipv6 = urls.replace(/\[[0-9a-f:.]+(?:%[\w.-]+)?\]|(?<![\w])[0-9a-f:.]*:[0-9a-f:.]+(?:%[\w.-]+)?(?![\w:])/gi, candidate => {
    const trimmed = candidate.replace(/\.+$/, '');
    return isIpLiteral(trimmed) ? HIDDEN_IP + candidate.slice(trimmed.length) : candidate;
  });
  return ipv6.replace(/(?<!\d)(?<!\d\.)(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)/g, candidate => isIpLiteral(candidate) ? HIDDEN_IP : candidate);
}

/** Remove IP literals in visible text and encoded locators; domains, ports and versions remain usable. */
export function redactIpText(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 3; pass++) {
    const next = decoded.replace(/(?:%[\da-f]{2})+/gi, part => { try { return decodeURIComponent(part); } catch { return part; } });
    if (next === decoded) break;
    decoded = next;
  }
  const scrubbed = scrubLiteralText(decoded);
  return scrubbed !== decoded ? scrubbed : scrubLiteralText(value);
}

export const containsIpAddress = (value: string) => redactIpText(value) !== value;

export function displayNetworkEndpoint(value: string, fallback = '网络地址已隐藏'): string {
  return !value || value.includes(HIDDEN_IP) || containsIpAddress(value) ? fallback : value;
}

/** An IP-based browser URL is labeled by role; a domain-based service keeps its authority. */
export function displayServiceAuthority(value: string): string {
  try {
    const host = new URL(value).host;
    return displayNetworkEndpoint(host, '当前服务');
  } catch { return '当前服务'; }
}
