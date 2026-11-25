import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db, normalizeArabicDigits } from '../firebase/config';

export const DEFAULT_CALCULATOR_PIN = '2580';
const CALCULATOR_LOCK_CACHE_KEY = 'janax_calc_lock_cache_v1';

export interface CalculatorLockPublicConfig {
  pinHash: string;
  salt: string;
  pinLength: number;
  version: number;
  updatedAt: string;
}

export interface CalculatorLockAdminConfig {
  pin: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

// Pure JS SHA-256 fallback (used only if WebCrypto subtle is unavailable on non-HTTPS LAN origins)
function sha256FallbackHex(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export async function sha256Hex(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded as unknown as BufferSource);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256FallbackHex(text);
}

export function generateSaltHex(byteCount = 16): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildCalculatorPinHash(pin: string): Promise<{
  pinHash: string;
  salt: string;
  pinLength: number;
}> {
  const normalized = normalizeArabicDigits(pin).trim();
  const salt = generateSaltHex(16);
  const pinHash = await sha256Hex(`${salt}:${normalized}`);
  return {
    pinHash,
    salt,
    pinLength: normalized.length,
  };
}

export function getCachedCalculatorLock(): CalculatorLockPublicConfig | null {
  try {
    const raw = localStorage.getItem(CALCULATOR_LOCK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalculatorLockPublicConfig>;
    if (
      typeof parsed?.pinHash === 'string' &&
      parsed.pinHash.length === 64 &&
      typeof parsed.salt === 'string' &&
      parsed.salt.length >= 16 &&
      typeof parsed.pinLength === 'number' &&
      typeof parsed.version === 'number' &&
      parsed.version >= 1
    ) {
      return parsed as CalculatorLockPublicConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedCalculatorLock(config: CalculatorLockPublicConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(CALCULATOR_LOCK_CACHE_KEY);
    } else {
      localStorage.setItem(CALCULATOR_LOCK_CACHE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage quota errors
  }
}

let inFlightLockFetch: Promise<CalculatorLockPublicConfig | null> | null = null;

export async function fetchLatestCalculatorLock(): Promise<CalculatorLockPublicConfig | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return getCachedCalculatorLock();
  }

  if (inFlightLockFetch) {
    return inFlightLockFetch;
  }

  const lockRef = doc(db, 'appConfig', 'calculatorLock');

  inFlightLockFetch = (async () => {
    try {
      const serverPromise = getDocFromServer(lockRef);
      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
        setTimeout(() => resolve('TIMEOUT'), 3000)
      );

      const outcome = await Promise.race([serverPromise, timeoutPromise]);
      if (outcome !== 'TIMEOUT') {
        if (outcome.exists()) {
          const data = outcome.data() as CalculatorLockPublicConfig;
          setCachedCalculatorLock(data);
          return data;
        }
        setCachedCalculatorLock(null);
        return null;
      }

      // Server timed out; fall back to local Firestore cache or localStorage cache without blocking unlock
      const cacheSnap = await getDoc(lockRef);
      if (cacheSnap.exists()) {
        const data = cacheSnap.data() as CalculatorLockPublicConfig;
        setCachedCalculatorLock(data);
        return data;
      }
      return getCachedCalculatorLock();
    } catch {
      try {
        const cacheSnap = await getDoc(lockRef);
        if (cacheSnap.exists()) {
          const data = cacheSnap.data() as CalculatorLockPublicConfig;
          setCachedCalculatorLock(data);
          return data;
        }
      } catch {
        // Fallback to localStorage cache when completely offline
      }
      return getCachedCalculatorLock();
    } finally {
      inFlightLockFetch = null;
    }
  })();

  return inFlightLockFetch;
}

const DECOY_LOCK_CACHE_KEY = 'janax_decoy_lock_cache_v1';

export function getCachedDecoyLock(): CalculatorLockPublicConfig | null {
  try {
    const raw = localStorage.getItem(DECOY_LOCK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalculatorLockPublicConfig>;
    if (
      typeof parsed?.pinHash === 'string' &&
      parsed.pinHash.length === 64 &&
      typeof parsed.salt === 'string' &&
      parsed.salt.length >= 16 &&
      typeof parsed.pinLength === 'number' &&
      typeof parsed.version === 'number' &&
      parsed.version >= 1
    ) {
      return parsed as CalculatorLockPublicConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedDecoyLock(config: CalculatorLockPublicConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(DECOY_LOCK_CACHE_KEY);
    } else {
      localStorage.setItem(DECOY_LOCK_CACHE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchLatestDecoyLock(): Promise<CalculatorLockPublicConfig | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return getCachedDecoyLock();
  }
  const decoyRef = doc(db, 'appConfig', 'decoyLock');
  try {
    const snap = await Promise.race([
      getDocFromServer(decoyRef),
      new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 2500)),
    ]);
    if (snap !== 'TIMEOUT') {
      if (snap.exists()) {
        const data = snap.data() as CalculatorLockPublicConfig;
        setCachedDecoyLock(data);
        return data;
      }
      setCachedDecoyLock(null);
      return null;
    }
    const cacheSnap = await getDoc(decoyRef);
    if (cacheSnap.exists()) {
      const data = cacheSnap.data() as CalculatorLockPublicConfig;
      setCachedDecoyLock(data);
      return data;
    }
    return getCachedDecoyLock();
  } catch {
    return getCachedDecoyLock();
  }
}

export async function verifyCalculatorPin(
  enteredPin: string,
  prefetchedConfig?: CalculatorLockPublicConfig | null,
  prefetchedDecoyConfig?: CalculatorLockPublicConfig | null
): Promise<{
  matched: boolean;
  mode: 'real' | 'decoy' | 'invalid';
  version: number;
  config: CalculatorLockPublicConfig | null;
}> {
  const normalized = normalizeArabicDigits(enteredPin).trim();
  if (!/^\d{4,12}$/.test(normalized)) {
    return {
      matched: false,
      mode: 'invalid',
      version: prefetchedConfig?.version ?? 0,
      config: prefetchedConfig ?? null,
    };
  }

  const config = prefetchedConfig !== undefined ? prefetchedConfig : await fetchLatestCalculatorLock();

  if (config && config.pinHash && config.salt && config.version >= 1) {
    const computedHash = await sha256Hex(`${config.salt}:${normalized}`);
    if (computedHash === config.pinHash) {
      return {
        matched: true,
        mode: 'real',
        version: config.version,
        config,
      };
    }
  } else if (normalized === DEFAULT_CALCULATOR_PIN) {
    return {
      matched: true,
      mode: 'real',
      version: 0,
      config: null,
    };
  }

  // Check optional Decoy PIN (never matches if not configured)
  const decoyConfig =
    prefetchedDecoyConfig !== undefined ? prefetchedDecoyConfig : await fetchLatestDecoyLock();
  if (decoyConfig && decoyConfig.pinHash && decoyConfig.salt && decoyConfig.version >= 1) {
    const decoyHash = await sha256Hex(`${decoyConfig.salt}:${normalized}`);
    if (decoyHash === decoyConfig.pinHash) {
      return {
        matched: true,
        mode: 'decoy',
        version: decoyConfig.version,
        config,
      };
    }
  }

  return {
    matched: false,
    mode: 'invalid',
    version: config?.version ?? 0,
    config,
  };
}
