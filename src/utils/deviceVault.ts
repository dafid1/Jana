const DEVICE_VAULT_STORAGE_KEY = 'janax_device_vault_v1';
const LEGACY_V1_PIN = '2580';
const IDB_NAME = 'janax_device_keystore';
const IDB_STORE = 'keys';
const IDB_KEY_ID = 'vault_aes_key_v2';

export interface StoredDeviceCredentials {
  email: string;
  password: string;
  uid: string;
}

interface EncryptedVaultEnvelope {
  v: 1 | 2;
  alg: 'AES-GCM' | 'AES-GCM-IDB' | 'FALLBACK';
  salt: string;
  iv: string;
  data: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function openKeystoreDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open keystore'));
  });
}

async function getOrCreateDeviceCryptoKey(createIfMissing: boolean): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;

  try {
    const db = await openKeystoreDb();
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });

    if (existing) {
      db.close();
      return existing;
    }

    if (!createIfMissing) {
      db.close();
      return null;
    }

    const generated = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // Non-extractable key
      ['encrypt', 'decrypt']
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(generated, IDB_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return generated;
  } catch {
    return null;
  }
}

async function deriveLegacyPbkdf2Key(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function xorFallbackTransform(input: Uint8Array, secret: Uint8Array): Uint8Array {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = input[i] ^ secret[i % secret.length] ^ ((i * 31) & 0xff);
  }
  return out;
}

export function hasDeviceVault(): boolean {
  try {
    const raw = localStorage.getItem(DEVICE_VAULT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<EncryptedVaultEnvelope>;
    return Boolean(parsed && (parsed.v === 1 || parsed.v === 2) && parsed.data && parsed.alg);
  } catch {
    return false;
  }
}

export function clearDeviceVault(): void {
  try {
    localStorage.removeItem(DEVICE_VAULT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function saveDeviceVault(credentials: StoredDeviceCredentials): Promise<void> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(credentials));

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const deviceKey = await getOrCreateDeviceCryptoKey(true);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    if (deviceKey) {
      const cipherBuf = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        deviceKey,
        payloadBytes as unknown as BufferSource
      );
      const envelope: EncryptedVaultEnvelope = {
        v: 2,
        alg: 'AES-GCM-IDB',
        salt: '',
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(cipherBuf)),
      };
      localStorage.setItem(DEVICE_VAULT_STORAGE_KEY, JSON.stringify(envelope));
      return;
    }

    // Fallback if IndexedDB is blocked in a restricted WebView
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const secret = `${window.location.origin}_janax_device_vault_v2`;
    const key = await deriveLegacyPbkdf2Key(secret, salt);
    const cipherBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      payloadBytes as unknown as BufferSource
    );
    const envelope: EncryptedVaultEnvelope = {
      v: 2,
      alg: 'AES-GCM',
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(cipherBuf)),
    };
    localStorage.setItem(DEVICE_VAULT_STORAGE_KEY, JSON.stringify(envelope));
    return;
  }

  // Fallback for non-secure HTTP origins where WebCrypto subtle is absent
  const saltBytes = new TextEncoder().encode(`${window.location.origin}_janax_vault`);
  const masked = xorFallbackTransform(payloadBytes, saltBytes);
  const envelope: EncryptedVaultEnvelope = {
    v: 2,
    alg: 'FALLBACK',
    salt: '',
    iv: '',
    data: bytesToBase64(masked),
  };
  localStorage.setItem(DEVICE_VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

export async function decryptDeviceVault(): Promise<StoredDeviceCredentials | null> {
  try {
    const raw = localStorage.getItem(DEVICE_VAULT_STORAGE_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as EncryptedVaultEnvelope;
    if (!envelope || !envelope.data) return null;

    if (envelope.alg === 'AES-GCM-IDB' && typeof window !== 'undefined' && window.crypto?.subtle) {
      const deviceKey = await getOrCreateDeviceCryptoKey(false);
      if (!deviceKey) return null;
      const iv = base64ToBytes(envelope.iv);
      const ciphertext = base64ToBytes(envelope.data);
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        deviceKey,
        ciphertext as unknown as BufferSource
      );
      const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as StoredDeviceCredentials;
      return parsed.email && parsed.password ? parsed : null;
    }

    if (envelope.alg === 'AES-GCM' && typeof window !== 'undefined' && window.crypto?.subtle) {
      const salt = base64ToBytes(envelope.salt);
      const iv = base64ToBytes(envelope.iv);
      const ciphertext = base64ToBytes(envelope.data);
      const secret =
        envelope.v === 1
          ? LEGACY_V1_PIN
          : `${window.location.origin}_janax_device_vault_v2`;
      const key = await deriveLegacyPbkdf2Key(secret, salt);
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );
      const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as StoredDeviceCredentials;
      if (!parsed.email || !parsed.password) return null;

      // Seamlessly upgrade legacy v1 vault into device keystore v2
      if (envelope.v === 1) {
        await saveDeviceVault(parsed).catch(() => {});
      }
      return parsed;
    }

    if (envelope.alg === 'FALLBACK') {
      const secretStr =
        envelope.v === 1 ? `${LEGACY_V1_PIN}_janax_vault` : `${window.location.origin}_janax_vault`;
      const saltBytes = new TextEncoder().encode(secretStr);
      const masked = base64ToBytes(envelope.data);
      const plainBytes = xorFallbackTransform(masked, saltBytes);
      const parsed = JSON.parse(new TextDecoder().decode(plainBytes)) as StoredDeviceCredentials;
      if (!parsed.email || !parsed.password) return null;

      if (envelope.v === 1) {
        await saveDeviceVault(parsed).catch(() => {});
      }
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
