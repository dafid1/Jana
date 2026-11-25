import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase/config';
import { LinkPreviewData } from '../types/telegram';
import { extractFirstExternalUrl } from './linkPreview';

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

let cachedRtcConfig: { value: RTCConfiguration; expiresAt: number } | null = null;

function resolveApiUrl(path: string): string | null {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configuredBase) {
    return `${configuredBase}${path}`;
  }
  if (Capacitor.isNativePlatform()) {
    // On native Android/iOS without a configured cloud API base URL, skip relative fetch
    return null;
  }
  return path;
}

async function getBearerToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function enrichMessageLinkPreview(text: string): Promise<LinkPreviewData | null> {
  const targetUrl = extractFirstExternalUrl(text);
  if (!targetUrl) return null;

  const endpoint = resolveApiUrl('/api/link-preview');
  const token = await getBearerToken();
  if (!endpoint || !token) return null;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: targetUrl }),
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { preview?: LinkPreviewData };
    if (!data?.preview || typeof data.preview.title !== 'string') {
      return null;
    }
    return data.preview;
  } catch {
    return null;
  }
}

export async function getCloudRtcConfig(): Promise<RTCConfiguration> {
  if (cachedRtcConfig && cachedRtcConfig.expiresAt > Date.now()) {
    return cachedRtcConfig.value;
  }

  const endpoint = resolveApiUrl('/api/rtc-config');
  const token = await getBearerToken();
  if (!endpoint || !token) {
    return DEFAULT_RTC_CONFIG;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) return DEFAULT_RTC_CONFIG;
    const data = (await res.json()) as { iceServers?: RTCIceServer[] };
    if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
      const rtcConfig: RTCConfiguration = { iceServers: data.iceServers };
      cachedRtcConfig = {
        value: rtcConfig,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      return rtcConfig;
    }
  } catch {
    // Fallback cleanly to default Google STUN servers
  }

  return DEFAULT_RTC_CONFIG;
}
