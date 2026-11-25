import { lookup } from 'node:dns/promises';
import net from 'node:net';

export interface ServerLinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

interface CacheEntry {
  data: ServerLinkPreviewData | null;
  expiresAt: number;
}

const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const MAX_HTML_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 2;

const previewCache = new Map<string, CacheEntry>();

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function isDisallowedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (cidrBase: string, maskBits: number) => {
    const base = ipv4ToInt(cidrBase);
    const mask = maskBits === 0 ? 0 : (~((1 << (32 - maskBits)) - 1)) >>> 0;
    return (n & mask) === (base & mask);
  };

  return (
    inRange('0.0.0.0', 8) || // Current network
    inRange('10.0.0.0', 8) || // Private RFC1918
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // Loopback
    inRange('169.254.0.0', 16) || // Link-local & cloud metadata
    inRange('172.16.0.0', 12) || // Private RFC1918
    inRange('192.0.0.0', 24) || // IETF protocol
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.168.0.0', 16) || // Private RFC1918
    inRange('198.18.0.0', 15) || // Benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // Multicast
    inRange('240.0.0.0', 4) // Reserved
  );
}

function isDisallowedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  if (!ip) return true;

  if (net.isIPv4(ip)) {
    return isDisallowedIpv4(ip);
  }

  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) {
      const mapped = ip.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) {
        return isDisallowedIpv4(mapped);
      }
    }
    // Unique local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
    const firstHex = parseInt(ip.split(':')[0] || '0', 16);
    if (!Number.isNaN(firstHex)) {
      if ((firstHex & 0xfe00) === 0xfc00) return true;
      if ((firstHex & 0xffc0) === 0xfe80) return true;
      if ((firstHex & 0xff00) === 0xff00) return true;
    }
    return false;
  }

  return true;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('UNSUPPORTED_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw new Error('CREDENTIALS_NOT_ALLOWED');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('PORT_NOT_ALLOWED');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('DISALLOWED_HOST');
  }

  if (net.isIP(host)) {
    if (isDisallowedIp(host)) {
      throw new Error('DISALLOWED_IP');
    }
    return parsed;
  }

  const records = await lookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error('DNS_RESOLUTION_FAILED');
  }
  for (const record of records) {
    if (isDisallowedIp(record.address)) {
      throw new Error('DISALLOWED_RESOLVED_IP');
    }
  }

  return parsed;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, keys: string[]): string | undefined {
  const metaRegex = /<meta\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const propMatch = attrs.match(/(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const key = (propMatch?.[1] || propMatch?.[2] || propMatch?.[3] || '').trim().toLowerCase();
    if (!key || !keys.includes(key)) continue;

    const contentMatch = attrs.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawVal = (contentMatch?.[1] || contentMatch?.[2] || contentMatch?.[3] || '').trim();
    if (rawVal) {
      return decodeHtmlEntities(rawVal);
    }
  }
  return undefined;
}

function extractTitleTag(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return undefined;
  const cleaned = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, ''));
  return cleaned || undefined;
}

function sanitizeImageUrl(rawImage: string | undefined, baseUrl: URL): string | undefined {
  if (!rawImage) return undefined;
  try {
    const resolved = new URL(rawImage, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return undefined;
    }
    const host = resolved.hostname.toLowerCase();
    if (host === 'localhost' || (net.isIP(host) && isDisallowedIp(host))) {
      return undefined;
    }
    return resolved.toString().slice(0, 1000);
  } catch {
    return undefined;
  }
}

async function readLimitedText(response: globalThis.Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (total >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel error
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}

function setCache(url: string, data: ServerLinkPreviewData | null) {
  if (previewCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  previewCache.set(url, {
    data,
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
  });
}

export async function fetchServerSideLinkPreview(rawUrl: string): Promise<ServerLinkPreviewData | null> {
  const initialUrl = await assertSafeExternalUrl(rawUrl.trim());
  const cacheKey = initialUrl.toString();

  const cached = previewCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let currentUrl = initialUrl;
  let response: globalThis.Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'JanaXLinkPreviewBot/1.0 (+https://janax.app)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      try {
        await res.body?.cancel();
      } catch {
        // Ignore body cancel
      }
      if (!location || hop === MAX_REDIRECTS) {
        setCache(cacheKey, null);
        return null;
      }
      const nextUrl = new URL(location, currentUrl);
      currentUrl = await assertSafeExternalUrl(nextUrl.toString());
      continue;
    }

    response = res;
    break;
  }

  if (!response || !response.ok) {
    setCache(cacheKey, null);
    return null;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    try {
      await response.body?.cancel();
    } catch {
      // Ignore body cancel
    }
    setCache(cacheKey, null);
    return null;
  }

  const html = await readLimitedText(response, MAX_HTML_BYTES);
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const scanHtml = headMatch ? headMatch[1] : html.slice(0, 64 * 1024);

  const domain = currentUrl.hostname.replace(/^www\./i, '');
  const siteName =
    extractMetaContent(scanHtml, ['og:site_name', 'application-name'])?.slice(0, 80) || domain;
  const title =
    extractMetaContent(scanHtml, ['og:title', 'twitter:title'])?.slice(0, 160) ||
    extractTitleTag(scanHtml)?.slice(0, 160) ||
    domain;
  const description = extractMetaContent(scanHtml, [
    'og:description',
    'twitter:description',
    'description',
  ])?.slice(0, 300);
  const rawImage = extractMetaContent(scanHtml, ['og:image', 'twitter:image', 'twitter:image:src']);
  const imageUrl = sanitizeImageUrl(rawImage, currentUrl);

  const result: ServerLinkPreviewData = {
    url: initialUrl.toString(),
    domain,
    siteName,
    title,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };

  setCache(cacheKey, result);
  return result;
}
