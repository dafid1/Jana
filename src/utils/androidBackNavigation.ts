import { useEffect, useId, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackNavigationPlugin {
  setCanGoBack(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
}

const BackNavigation = registerPlugin<BackNavigationPlugin>('BackNavigation');

type BackHandlerCallback = () => boolean | void;

interface BackEntry {
  id: string;
  priority: number;
  order: number;
  handler: BackHandlerCallback;
}

const activeBackEntries = new Map<string, BackEntry>();
const countSubscribers = new Set<(count: number) => void>();
let registrationCounter = 0;

declare global {
  interface Window {
    __janaxHandleAndroidBack?: () => 'handled' | 'exit';
  }
}

function notifySubscribers() {
  const count = activeBackEntries.size;
  countSubscribers.forEach((cb) => cb(count));
}

export function syncNativeBackInterception(enabled: boolean): void {
  if (!Capacitor.isNativePlatform()) return;
  BackNavigation.setCanGoBack({ enabled }).catch(() => {});
}

export function dispatchAppBack(): 'handled' | 'exit' {
  if (activeBackEntries.size === 0) {
    return 'exit';
  }

  const ordered = Array.from(activeBackEntries.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.order - a.order;
  });

  for (const entry of ordered) {
    const result = entry.handler();
    if (result !== false) {
      return 'handled';
    }
  }

  return 'exit';
}

export function useBackHandler(
  enabled: boolean,
  onBack: BackHandlerCallback,
  priority = 50
): void {
  const id = useId();
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      if (activeBackEntries.delete(id)) {
        notifySubscribers();
      }
      return;
    }

    registrationCounter += 1;
    activeBackEntries.set(id, {
      id,
      priority,
      order: registrationCounter,
      handler: () => handlerRef.current(),
    });
    notifySubscribers();

    return () => {
      if (activeBackEntries.delete(id)) {
        notifySubscribers();
      }
    };
  }, [enabled, id, priority]);
}

export function useAndroidBackNavigationRoot(isUnlocked: boolean): void {
  const [entryCount, setEntryCount] = useState(() => activeBackEntries.size);
  const [popTick, setPopTick] = useState(0);
  const suppressNextPopStateRef = useRef(false);

  useEffect(() => {
    const handleCountChange = (count: number) => setEntryCount(count);
    countSubscribers.add(handleCountChange);
    setEntryCount(activeBackEntries.size);
    return () => {
      countSubscribers.delete(handleCountChange);
    };
  }, []);

  const canGoBackInsideApp = isUnlocked || entryCount > 0;

  // Expose synchronous JS entry point for Android MainActivity OnBackPressedCallback
  useEffect(() => {
    window.__janaxHandleAndroidBack = dispatchAppBack;
    return () => {
      if (window.__janaxHandleAndroidBack === dispatchAppBack) {
        delete window.__janaxHandleAndroidBack;
      }
    };
  }, []);

  // Synchronize native Android back interception whenever app navigation depth changes
  useEffect(() => {
    syncNativeBackInterception(canGoBackInsideApp);
  }, [canGoBackInsideApp]);

  // Web / Android Chrome / PWA history sentinel synchronization
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const hasGuardState = Boolean(window.history.state && window.history.state.janaxVaultGuard);
    if (canGoBackInsideApp && !hasGuardState) {
      window.history.pushState({ janaxVaultGuard: true }, '');
    } else if (!canGoBackInsideApp && hasGuardState) {
      suppressNextPopStateRef.current = true;
      window.history.back();
    }
  }, [canGoBackInsideApp, popTick]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handlePopState = () => {
      if (suppressNextPopStateRef.current) {
        suppressNextPopStateRef.current = false;
        return;
      }

      const result = dispatchAppBack();
      if (result === 'handled') {
        setPopTick((prev) => prev + 1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
