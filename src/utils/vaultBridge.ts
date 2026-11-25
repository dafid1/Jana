import { Capacitor, registerPlugin } from '@capacitor/core';
import { PendingSharePayload } from '../types/telegram';

interface VaultSecurityPluginInterface {
  setScreenSecure(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  showLocalNotification(options: {
    id?: number;
    title: string;
    body: string;
  }): Promise<{ shown: boolean }>;
  getPendingShare(): Promise<{ payload?: PendingSharePayload | null }>;
  clearPendingShare(): Promise<void>;
}

const VaultSecurity = registerPlugin<VaultSecurityPluginInterface>('VaultSecurity');

declare global {
  interface Window {
    __janaxOnNativeShare?: () => void;
  }
}

export async function setNativeScreenSecurity(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await VaultSecurity.setScreenSecure({ enabled });
  } catch {
    // Ignore on non-Android or unsupported webviews
  }
}

export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await VaultSecurity.requestNotificationPermission();
      return Boolean(res?.granted);
    } catch {
      return false;
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission().catch(() => 'denied');
      return perm === 'granted';
    }
  }
  return false;
}

export async function triggerMessageNotification(options: {
  title: string;
  body: string;
  discreet?: boolean;
}): Promise<void> {
  const finalTitle = options.discreet ? 'حاسبة النظام' : options.title;
  const finalBody = options.discreet ? 'تم تحديث السجل — اضغط للمعاينة' : options.body;

  if (Capacitor.isNativePlatform()) {
    try {
      await VaultSecurity.showLocalNotification({
        id: Math.floor(Date.now() % 100000),
        title: finalTitle,
        body: finalBody,
      });
    } catch {
      // Ignore if permission not granted
    }
    return;
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted' && document.hidden) {
      try {
        new Notification(finalTitle, {
          body: finalBody,
          tag: 'janax-msg',
        });
      } catch {
        // Ignore browser notification failure
      }
    }
  }
}

export async function fetchNativePendingShare(): Promise<PendingSharePayload | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await VaultSecurity.getPendingShare();
    return res?.payload || null;
  } catch {
    return null;
  }
}

export async function clearNativePendingShare(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await VaultSecurity.clearPendingShare();
  } catch {
    // Ignore
  }
}
