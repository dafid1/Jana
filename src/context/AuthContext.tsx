import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  getSecondaryAuth,
  ADMIN_USERNAME,
  usernameToEmail,
  extractPhoneDigits,
  isPhoneIdentifier,
  phoneToEmail,
  formatPhoneDisplay,
  normalizeArabicDigits,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  handleFirestoreError,
  OperationType,
} from '../firebase/config';
import { UserProfile, ChatWallpaper } from '../types/telegram';
import {
  hasDeviceVault,
  saveDeviceVault,
  decryptDeviceVault,
  clearDeviceVault,
} from '../utils/deviceVault';
import {
  DEFAULT_CALCULATOR_PIN,
  CalculatorLockPublicConfig,
  CalculatorLockAdminConfig,
  buildCalculatorPinHash,
  setCachedCalculatorLock,
  setCachedDecoyLock,
  verifyCalculatorPin,
} from '../utils/calculatorLock';

const SESSION_TOKEN_KEY = 'janax_auth_token';
const SESSION_UID_KEY = 'janax_session_uid';
const SESSION_STARTED_KEY = 'janax_session_started_at';
const BG_TIMESTAMP_KEY = 'janax_bg_timestamp';
const LEFT_APP_KEY = 'janax_left_app';
const AUTOLOCK_SECONDS_CACHE_KEY = 'janax_autolock_seconds';
const DEFAULT_BACKGROUND_TIMEOUT_MS = 30 * 1000; // 30 seconds

function getConfiguredBgTimeoutMs(userProfileTimeout?: number): number {
  const raw =
    typeof userProfileTimeout === 'number'
      ? userProfileTimeout
      : Number(localStorage.getItem(AUTOLOCK_SECONDS_CACHE_KEY));
  if (Number.isFinite(raw)) {
    if (raw === -1) return -1;
    if (raw >= 0 && raw <= 3600) return raw * 1000;
  }
  return DEFAULT_BACKGROUND_TIMEOUT_MS;
}

interface CreateAccountPayload {
  username: string;
  displayName: string;
  password: string;
  bio?: string;
  phone?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  allUsers: UserProfile[];
  usersMap: Record<string, UserProfile>;
  adminCredentialsMap: Record<string, string>;
  adminCalculatorPin: string;
  calculatorPinVersion: number;
  adminDecoyPin: string;
  decoyPinVersion: number;
  isAdmin: boolean;
  loading: boolean;
  isAutoLoggingIn: boolean;
  lockCounter: number;
  logoutReason: string;
  clearLogoutReason: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  wallpaper: ChatWallpaper;
  setWallpaper: (wp: ChatWallpaper) => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (fs: 'small' | 'medium' | 'large') => void;
  loginWithCredentials: (identifier: string, password: string) => Promise<void>;
  registerWithPhone: (payload: {
    phone: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  unlockWithCalculatorCode: (code: string) => Promise<'real' | 'decoy' | false>;
  updateCalculatorPinByAdmin: (newPin: string) => Promise<void>;
  updateDecoyPinByAdmin: (newPin: string) => Promise<void>;
  disableDecoyPinByAdmin: () => Promise<void>;
  createAccountByAdmin: (payload: CreateAccountPayload) => Promise<UserProfile>;
  getUserCredentialByAdmin: (uid: string) => Promise<string | null>;
  updateUserProfileByAdmin: (
    uid: string,
    data: { displayName: string; phone?: string; bio?: string }
  ) => Promise<void>;
  updateUserPasswordByAdmin: (
    uid: string,
    newPassword: string,
    fallbackCurrentPassword?: string
  ) => Promise<void>;
  deleteUserProfileByAdmin: (uid: string) => Promise<void>;
  logout: (reason?: string, forgetDevice?: boolean) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  toggleBlockUser: (targetUid: string) => Promise<boolean>;
  toggleMuteChat: (chatId: string) => Promise<boolean>;
  togglePinChat: (chatId: string) => Promise<boolean>;
  updatePrivacySettings: (settings: {
    privacyHideLastSeen?: boolean;
    autoLockSeconds?: number;
    screenSecurityEnabled?: boolean;
    discreetNotifications?: boolean;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [adminCredentialsMap, setAdminCredentialsMap] = useState<Record<string, string>>({});
  const [adminCalculatorPin, setAdminCalculatorPin] = useState<string>(DEFAULT_CALCULATOR_PIN);
  const [calculatorPinVersion, setCalculatorPinVersion] = useState<number>(0);
  const [adminDecoyPin, setAdminDecoyPin] = useState<string>('');
  const [decoyPinVersion, setDecoyPinVersion] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [lockCounter, setLockCounter] = useState(0);
  const [logoutReason, setLogoutReason] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('janax_theme') as 'dark' | 'light') || 'dark';
  });
  const [wallpaper, setWallpaperState] = useState<ChatWallpaper>(() => {
    return (localStorage.getItem('janax_wallpaper') as ChatWallpaper) || 'classic';
  });
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('janax_fontSize') as 'small' | 'medium' | 'large') || 'medium';
  });

  const isLoggingInRef = useRef(false);
  const unlockedPinVersionRef = useRef<number>(0);
  const pendingSignupRef = useRef<{
    uid?: string;
    displayName: string;
    phone: string;
    username: string;
  } | null>(null);
  const bgStartedAtRef = useRef<number | null>(null);
  const bgLogoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearLogoutReason = useCallback(() => setLogoutReason(''), []);

  const clearSessionTokens = useCallback(() => {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_UID_KEY);
    sessionStorage.removeItem(SESSION_STARTED_KEY);
    sessionStorage.removeItem(BG_TIMESTAMP_KEY);
    sessionStorage.removeItem(LEFT_APP_KEY);
    localStorage.removeItem(BG_TIMESTAMP_KEY);
  }, []);

  const saveSessionToken = useCallback(async (user: User) => {
    try {
      const token = await user.getIdToken();
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_UID_KEY, user.uid);
      sessionStorage.setItem(SESSION_STARTED_KEY, new Date().toISOString());
      sessionStorage.removeItem(BG_TIMESTAMP_KEY);
      sessionStorage.removeItem(LEFT_APP_KEY);
      localStorage.removeItem(BG_TIMESTAMP_KEY);
    } catch {
      // Ignore if token fetch fails during teardown
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.remove('bg-[#0e1621]', 'text-[#ffffff]');
      document.body.classList.add('bg-[#8ca388]', 'text-[#111827]');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.body.classList.remove('bg-[#8ca388]', 'text-[#111827]');
      document.body.classList.add('bg-[#0e1621]', 'text-[#ffffff]');
    }
    localStorage.setItem('janax_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setWallpaper = useCallback((wp: ChatWallpaper) => {
    setWallpaperState(wp);
    localStorage.setItem('janax_wallpaper', wp);
  }, []);

  const setFontSize = useCallback((fs: 'small' | 'medium' | 'large') => {
    setFontSizeState(fs);
    localStorage.setItem('janax_fontSize', fs);
  }, []);

  const usersMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    allUsers.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [allUsers]);

  const isAdmin =
    userProfile?.role === 'admin' ||
    userProfile?.username?.toLowerCase() === ADMIN_USERNAME;

  const logout = useCallback(
    async (reason = '', forgetDevice = false) => {
      if (bgLogoutTimerRef.current) {
        clearTimeout(bgLogoutTimerRef.current);
        bgLogoutTimerRef.current = null;
      }
      bgStartedAtRef.current = null;

      const activeUid = auth.currentUser?.uid;
      if (activeUid) {
        try {
          const userRef = doc(db, 'users', activeUid);
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: new Date().toISOString(),
          }).catch(() => {});
        } catch {
          // Ignore on logout
        }
      }

      clearSessionTokens();
      if (forgetDevice) {
        clearDeviceVault();
      }
      if (reason) {
        setLogoutReason(reason);
      } else {
        setLogoutReason('');
      }
      await signOut(auth).catch(() => {});
      setLockCounter((c) => c + 1);
    },
    [clearSessionTokens]
  );

  // Enforce session-only persistence and validate saved token on app startup
  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch(() => {});

    // Always clean stale leave marker on fresh boot
    if (sessionStorage.getItem(LEFT_APP_KEY) === '1') {
      clearSessionTokens();
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !isLoggingInRef.current) {
        const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
        const savedUid = sessionStorage.getItem(SESSION_UID_KEY);
        const bgTs = Number(
          sessionStorage.getItem(BG_TIMESTAMP_KEY) ||
            localStorage.getItem(BG_TIMESTAMP_KEY) ||
            0
        );

        // If background exceeded configured timeout before resume -> auto logout & return to Calculator
        const configuredTimeoutMs = getConfiguredBgTimeoutMs();
        if (configuredTimeoutMs >= 0 && bgTs > 0 && Date.now() - bgTs >= configuredTimeoutMs) {
          clearSessionTokens();
          setLogoutReason('تم قفل الخزنة تلقائياً لحماية خصوصيتك');
          setCurrentUser(null);
          setUserProfile(null);
          setAllUsers([]);
          setLoading(false);
          setLockCounter((c) => c + 1);
          await signOut(auth).catch(() => {});
          return;
        }

        // If session token is missing (app was closed/left and reopened) -> clear session & show Calculator
        if (!savedToken || savedUid !== user.uid) {
          clearSessionTokens();
          setCurrentUser(null);
          setUserProfile(null);
          setAllUsers([]);
          setLoading(false);
          setLockCounter((c) => c + 1);
          await signOut(auth).catch(() => {});
          return;
        }
      }

      setCurrentUser(user);
      setLoading(false);

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const isAdminEmail = user.email?.toLowerCase() === `${ADMIN_USERNAME}@janax.app`;

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            setUserProfile(data);
            if (typeof data.autoLockSeconds === 'number') {
              localStorage.setItem(AUTOLOCK_SECONDS_CACHE_KEY, String(data.autoLockSeconds));
            }
            if (!data.privacyHideLastSeen) {
              updateDoc(userRef, {
                isOnline: true,
                lastSeen: new Date().toISOString(),
              }).catch(() => {});
            } else {
              updateDoc(userRef, { isOnline: false }).catch(() => {});
            }
          } else {
            const pending =
              pendingSignupRef.current &&
              (!pendingSignupRef.current.uid || pendingSignupRef.current.uid === user.uid)
                ? pendingSignupRef.current
                : null;
            const extractedUsername =
              pending?.username ||
              (user.email ? user.email.split('@')[0].toLowerCase() : `user_${user.uid.slice(0, 6)}`);
            const newProfile: UserProfile = {
              uid: user.uid,
              username: extractedUsername,
              displayName:
                pending?.displayName ||
                user.displayName ||
                (isAdminEmail ? 'Jehan' : extractedUsername),
              role: isAdminEmail ? 'admin' : 'user',
              photoURL: user.photoURL || '',
              avatarColor: '#2481cc',
              bio: isAdminEmail ? 'مدير النظام في JanaX' : 'مرحباً، أنا أستخدم JanaX!',
              phone: pending?.phone || '',
              isOnline: true,
              lastSeen: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          }

          if (isAdminEmail) {
            setDoc(
              doc(db, 'admins', user.uid),
              {
                uid: user.uid,
                username: ADMIN_USERNAME,
                createdAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch(() => {});
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
        setAllUsers([]);
      }
    });

    return () => unsubscribe();
  }, [clearSessionTokens]);

  // Keep saved ID token synchronized if Firebase refreshes it during an active session
  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, async (user) => {
      if (user && sessionStorage.getItem(SESSION_UID_KEY) === user.uid) {
        try {
          const token = await user.getIdToken();
          sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        } catch {
          // Ignore
        }
      }
    });
    return () => unsubToken();
  }, []);

  // Listen to all users in real time when signed in
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserProfile;
          list.push(data);
          if (docSnap.id === currentUser.uid) {
            setUserProfile(data);
          }
        });
        list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
        setAllUsers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Listen to registered account credentials in real time for Admin only
  useEffect(() => {
    if (!currentUser || !isAdmin) {
      setAdminCredentialsMap({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'adminUserCredentials'),
      (snapshot) => {
        const creds: Record<string, string> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as { uid?: string; password?: string };
          if (typeof data.password === 'string') {
            creds[docSnap.id] = data.password;
          }
        });
        setAdminCredentialsMap(creds);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'adminUserCredentials');
      }
    );

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Listen to global calculator lock updates in real time:
  // If Admin changes the Calculator PIN while any user session is active, revoke old PIN & re-lock immediately
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'appConfig', 'calculatorLock'),
      (docSnap) => {
        if (!docSnap.exists()) {
          setCachedCalculatorLock(null);
          setCalculatorPinVersion(0);
          return;
        }
        const data = docSnap.data() as CalculatorLockPublicConfig;
        setCachedCalculatorLock(data);
        setCalculatorPinVersion(data.version || 0);

        if (
          typeof data.version === 'number' &&
          data.version > unlockedPinVersionRef.current
        ) {
          unlockedPinVersionRef.current = data.version;
          logout('تم تغيير رمز الدخول من قِبل مدير النظام، يرجى الدخول بالرمز الجديد', false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appConfig/calculatorLock');
      }
    );

    return () => unsubscribe();
  }, [currentUser, logout]);

  // Admin-only listener for the current plaintext Calculator PIN & Decoy PIN
  useEffect(() => {
    if (!currentUser || !isAdmin) {
      setAdminCalculatorPin(DEFAULT_CALCULATOR_PIN);
      setAdminDecoyPin('');
      setDecoyPinVersion(0);
      return;
    }

    const unsubscribeMain = onSnapshot(
      doc(db, 'adminConfig', 'calculatorLock'),
      (docSnap) => {
        if (!docSnap.exists()) {
          setAdminCalculatorPin(DEFAULT_CALCULATOR_PIN);
          return;
        }
        const data = docSnap.data() as CalculatorLockAdminConfig;
        if (typeof data.pin === 'string' && /^\d{4,12}$/.test(data.pin)) {
          setAdminCalculatorPin(data.pin);
          setCalculatorPinVersion(data.version || 0);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'adminConfig/calculatorLock');
      }
    );

    const unsubscribeDecoy = onSnapshot(
      doc(db, 'adminConfig', 'decoyLock'),
      (docSnap) => {
        if (!docSnap.exists()) {
          setAdminDecoyPin('');
          setDecoyPinVersion(0);
          return;
        }
        const data = docSnap.data() as CalculatorLockAdminConfig;
        if (typeof data.pin === 'string' && /^\d{4,12}$/.test(data.pin)) {
          setAdminDecoyPin(data.pin);
          setDecoyPinVersion(data.version || 0);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'adminConfig/decoyLock');
      }
    );

    return () => {
      unsubscribeMain();
      unsubscribeDecoy();
    };
  }, [currentUser, isAdmin]);

  // Monitor Background (configurable auto-lock timeout) & App Exit / Leaving Lifecycle
  const hideLastSeen = Boolean(userProfile?.privacyHideLastSeen);
  const autoLockSeconds = userProfile?.autoLockSeconds;

  useEffect(() => {
    if (!currentUser) return;

    const timeoutMs = getConfiguredBgTimeoutMs(autoLockSeconds);

    const enterBackground = () => {
      if (!bgStartedAtRef.current) {
        const now = Date.now();
        bgStartedAtRef.current = now;
        sessionStorage.setItem(BG_TIMESTAMP_KEY, String(now));
        localStorage.setItem(BG_TIMESTAMP_KEY, String(now));
      }

      if (!hideLastSeen) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }

      if (timeoutMs === 0) {
        logout('تم قفل الخزنة تلقائياً عند الخروج إلى الخلفية', false);
        return;
      }

      if (timeoutMs > 0 && !bgLogoutTimerRef.current) {
        bgLogoutTimerRef.current = setTimeout(() => {
          logout('تم قفل الخزنة تلقائياً لحماية خصوصيتك بعد البقاء في الخلفية', false);
        }, timeoutMs);
      }
    };

    const returnToForeground = () => {
      if (bgLogoutTimerRef.current) {
        clearTimeout(bgLogoutTimerRef.current);
        bgLogoutTimerRef.current = null;
      }

      const bgTs =
        bgStartedAtRef.current ||
        Number(
          sessionStorage.getItem(BG_TIMESTAMP_KEY) ||
            localStorage.getItem(BG_TIMESTAMP_KEY) ||
            0
        );

      bgStartedAtRef.current = null;
      sessionStorage.removeItem(BG_TIMESTAMP_KEY);
      localStorage.removeItem(BG_TIMESTAMP_KEY);

      if (timeoutMs >= 0 && bgTs > 0 && Date.now() - bgTs >= timeoutMs) {
        logout('تم قفل الخزنة تلقائياً لحماية خصوصيتك', false);
        return;
      }

      if (!hideLastSeen) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: true,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        enterBackground();
      } else if (document.visibilityState === 'visible') {
        returnToForeground();
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible' && bgStartedAtRef.current) {
        returnToForeground();
      }
    };

    const handleLeaveApp = () => {
      if (bgLogoutTimerRef.current) {
        clearTimeout(bgLogoutTimerRef.current);
        bgLogoutTimerRef.current = null;
      }
      bgStartedAtRef.current = null;

      if (!hideLastSeen) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }

      clearSessionTokens();
      sessionStorage.setItem(LEFT_APP_KEY, '1');
      signOut(auth).catch(() => {});
      setLockCounter((c) => c + 1);
    };

    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && !hideLastSeen) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: true,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }
    }, 30_000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('pause', enterBackground);
    document.addEventListener('resume', returnToForeground);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handleLeaveApp);
    window.addEventListener('unload', handleLeaveApp);

    return () => {
      clearInterval(heartbeatTimer);
      if (bgLogoutTimerRef.current) {
        clearTimeout(bgLogoutTimerRef.current);
        bgLogoutTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pause', enterBackground);
      document.removeEventListener('resume', returnToForeground);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handleLeaveApp);
      window.removeEventListener('unload', handleLeaveApp);
    };
  }, [currentUser, logout, clearSessionTokens, hideLastSeen, autoLockSeconds]);

  const unlockWithCalculatorCode = useCallback(
    async (code: string): Promise<'real' | 'decoy' | false> => {
      if (hasDeviceVault()) {
        setIsAutoLoggingIn(true);
      }
      isLoggingInRef.current = true;
      setLogoutReason('');

      try {
        const verification = await verifyCalculatorPin(code);
        if (!verification.matched) {
          setIsAutoLoggingIn(false);
          return false;
        }

        // Decoy / Panic PIN unlocks harmless empty workspace without logging into the real vault
        if (verification.mode === 'decoy') {
          isLoggingInRef.current = false;
          setIsAutoLoggingIn(false);
          return 'decoy';
        }

        unlockedPinVersionRef.current = verification.version;

        if (auth.currentUser && sessionStorage.getItem(SESSION_UID_KEY) === auth.currentUser.uid) {
          setIsAutoLoggingIn(false);
          return 'real';
        }

        if (!hasDeviceVault()) {
          setIsAutoLoggingIn(false);
          return 'real';
        }

        const creds = await decryptDeviceVault();
        if (!creds) {
          clearDeviceVault();
          setLogoutReason('يرجى تسجيل الدخول للمتابعة');
          return 'real';
        }

        await setPersistence(auth, browserSessionPersistence);
        const cred = await signInWithEmailAndPassword(auth, creds.email, creds.password);
        await saveSessionToken(cred.user);
        await saveDeviceVault({
          email: creds.email,
          password: creds.password,
          uid: cred.user.uid,
        }).catch(() => {});
        return 'real';
      } catch (error: unknown) {
        const fbErr = error as { code?: string };
        const errCode = fbErr?.code || '';
        if (
          errCode === 'auth/wrong-password' ||
          errCode === 'auth/user-not-found' ||
          errCode === 'auth/invalid-credential' ||
          errCode === 'auth/user-disabled'
        ) {
          clearDeviceVault();
          setLogoutReason('انتهت صلاحية بيانات الدخول المحفوظة، يرجى تسجيل الدخول مرة أخرى');
        } else {
          setLogoutReason('تعذر الاتصال لتسجيل الدخول التلقائي، يرجى تسجيل الدخول');
        }
        return 'real';
      } finally {
        isLoggingInRef.current = false;
        setIsAutoLoggingIn(false);
      }
    },
    [saveSessionToken]
  );

  const updateCalculatorPinByAdmin = useCallback(
    async (newPinRaw: string) => {
      if (!currentUser || !isAdmin) {
        throw new Error('هذه الصلاحية متاحة للأدمن فقط');
      }

      const cleanPin = normalizeArabicDigits(newPinRaw).trim();
      if (!/^\d{4,12}$/.test(cleanPin)) {
        throw new Error('يجب أن يتكون رمز الآلة الحاسبة من 4 إلى 12 رقماً إنجليزياً فقط');
      }

      if (cleanPin === adminCalculatorPin) {
        throw new Error('يرجى إدخال رمز جديد مختلف عن الرمز الحالي لتعطيل الرمز السابق');
      }

      if (adminDecoyPin && cleanPin === adminDecoyPin) {
        throw new Error('لا يمكن استخدام نفس الرمز الوهمي كرمز دخول رئيسي');
      }

      const { pinHash, salt, pinLength } = await buildCalculatorPinHash(cleanPin);
      const nextVersion = Math.max(calculatorPinVersion, unlockedPinVersionRef.current) + 1;
      const now = new Date().toISOString();

      unlockedPinVersionRef.current = nextVersion;

      const publicPayload: CalculatorLockPublicConfig = {
        pinHash,
        salt,
        pinLength,
        version: nextVersion,
        updatedAt: now,
      };

      const adminPayload: CalculatorLockAdminConfig = {
        pin: cleanPin,
        version: nextVersion,
        updatedAt: now,
        updatedBy: currentUser.uid,
      };

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'appConfig', 'calculatorLock'), publicPayload);
        batch.set(doc(db, 'adminConfig', 'calculatorLock'), adminPayload);
        await batch.commit();

        setCachedCalculatorLock(publicPayload);
        setAdminCalculatorPin(cleanPin);
        setCalculatorPinVersion(nextVersion);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'appConfig/calculatorLock');
      }
    },
    [currentUser, isAdmin, adminCalculatorPin, adminDecoyPin, calculatorPinVersion]
  );

  const updateDecoyPinByAdmin = useCallback(
    async (newPinRaw: string) => {
      if (!currentUser || !isAdmin) {
        throw new Error('هذه الصلاحية متاحة للأدمن فقط');
      }

      const cleanPin = normalizeArabicDigits(newPinRaw).trim();
      if (!/^\d{4,12}$/.test(cleanPin)) {
        throw new Error('يجب أن يتكون الرمز الوهمي من 4 إلى 12 رقماً إنجليزياً فقط');
      }

      if (cleanPin === adminCalculatorPin) {
        throw new Error('يجب أن يكون الرمز الوهمي مختلفاً عن رمز الدخول الرئيسي');
      }

      const { pinHash, salt, pinLength } = await buildCalculatorPinHash(cleanPin);
      const nextVersion = Math.max(1, decoyPinVersion + 1);
      const now = new Date().toISOString();

      const publicPayload: CalculatorLockPublicConfig = {
        pinHash,
        salt,
        pinLength,
        version: nextVersion,
        updatedAt: now,
      };

      const adminPayload: CalculatorLockAdminConfig = {
        pin: cleanPin,
        version: nextVersion,
        updatedAt: now,
        updatedBy: currentUser.uid,
      };

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'appConfig', 'decoyLock'), publicPayload);
        batch.set(doc(db, 'adminConfig', 'decoyLock'), adminPayload);
        await batch.commit();

        setCachedDecoyLock(publicPayload);
        setAdminDecoyPin(cleanPin);
        setDecoyPinVersion(nextVersion);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'appConfig/decoyLock');
      }
    },
    [currentUser, isAdmin, adminCalculatorPin, decoyPinVersion]
  );

  const disableDecoyPinByAdmin = useCallback(async () => {
    if (!currentUser || !isAdmin) {
      throw new Error('هذه الصلاحية متاحة للأدمن فقط');
    }
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'appConfig', 'decoyLock'));
      batch.delete(doc(db, 'adminConfig', 'decoyLock'));
      await batch.commit();
      setCachedDecoyLock(null);
      setAdminDecoyPin('');
      setDecoyPinVersion(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'appConfig/decoyLock');
    }
  }, [currentUser, isAdmin]);

  const loginWithCredentials = async (identifier: string, password: string) => {
    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      throw new Error('يرجى إدخال اسم المستخدم أو رقم الهاتف وكلمة المرور');
    }

    const isPhone = isPhoneIdentifier(trimmed);
    const phoneDigits = isPhone ? extractPhoneDigits(trimmed) : '';
    const cleanUsername = trimmed.toLowerCase().replace(/^@/, '');
    const email = isPhone ? phoneToEmail(phoneDigits) : usernameToEmail(cleanUsername);

    isLoggingInRef.current = true;
    setLogoutReason('');

    try {
      await setPersistence(auth, browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await saveSessionToken(cred.user);
      await saveDeviceVault({ email, password, uid: cred.user.uid }).catch(() => {});
      if (password.length >= 6 && password.length <= 128) {
        await setDoc(doc(db, 'adminUserCredentials', cred.user.uid), {
          uid: cred.user.uid,
          password,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (error: unknown) {
      const fbErr = error as { code?: string; message?: string };
      const code = fbErr?.code || '';

      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        throw new Error('PROVIDER_DISABLED');
      }

      // Auto-bootstrap admin account "jehan" with password "xxx20xx" on very first login
      if (
        !isPhone &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential') &&
        cleanUsername === ADMIN_USERNAME &&
        password === 'xxx20xx'
      ) {
        try {
          await setPersistence(auth, browserSessionPersistence);
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: 'Jehan' });
          await saveSessionToken(cred.user);
          await saveDeviceVault({ email, password, uid: cred.user.uid }).catch(() => {});

          await setDoc(doc(db, 'admins', cred.user.uid), {
            uid: cred.user.uid,
            username: ADMIN_USERNAME,
            createdAt: new Date().toISOString(),
          });
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            username: ADMIN_USERNAME,
            displayName: 'Jehan',
            role: 'admin',
            photoURL: '',
            avatarColor: '#2481cc',
            bio: 'مدير النظام في JanaX',
            phone: '',
            isOnline: true,
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
          await setDoc(doc(db, 'adminUserCredentials', cred.user.uid), {
            uid: cred.user.uid,
            password,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          return;
        } catch (createErr: unknown) {
          const cErr = createErr as { code?: string };
          if (cErr?.code === 'auth/operation-not-allowed' || cErr?.code === 'auth/admin-restricted-operation') {
            throw new Error('PROVIDER_DISABLED');
          }
          if (cErr?.code === 'auth/email-already-in-use') {
            throw new Error('كلمة المرور غير صحيحة');
          }
          throw createErr;
        }
      }

      if (
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email'
      ) {
        throw new Error('اسم المستخدم / رقم الهاتف أو كلمة المرور غير صحيحة');
      }

      if (code === 'auth/too-many-requests') {
        throw new Error('تم تجاوز عدد المحاولات المسموح بها، يرجى الانتظار قليلاً');
      }

      throw new Error('تعذر تسجيل الدخول، تأكد من الاتصال بالإنترنت');
    } finally {
      isLoggingInRef.current = false;
    }
  };

  const registerWithPhone = async (payload: {
    phone: string;
    password: string;
    displayName?: string;
  }) => {
    const digits = extractPhoneDigits(payload.phone);
    if (digits.length < 7 || digits.length > 15) {
      throw new Error('يرجى إدخال رقم هاتف صحيح (من 7 إلى 15 رقماً)');
    }
    if (!payload.password || payload.password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const formattedPhone = formatPhoneDisplay(payload.phone).slice(0, 30);
    const cleanDisplayName = ((payload.displayName || '').trim() || formattedPhone).slice(0, 100);
    const username = `p_${digits}`;
    const email = phoneToEmail(digits);

    isLoggingInRef.current = true;
    pendingSignupRef.current = {
      displayName: cleanDisplayName,
      phone: formattedPhone,
      username,
    };
    setLogoutReason('');

    try {
      await setPersistence(auth, browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, payload.password);
      if (pendingSignupRef.current) {
        pendingSignupRef.current.uid = cred.user.uid;
      }
      await updateProfile(cred.user, { displayName: cleanDisplayName });
      await saveSessionToken(cred.user);
      await saveDeviceVault({ email, password: payload.password, uid: cred.user.uid }).catch(
        () => {}
      );

      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        username,
        displayName: cleanDisplayName,
        role: 'user',
        photoURL: '',
        avatarColor: '#2481cc',
        bio: 'مرحباً، أنا أستخدم JanaX!',
        phone: formattedPhone,
        isOnline: true,
        lastSeen: now,
        createdAt: now,
      };

      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      await setDoc(doc(db, 'adminUserCredentials', cred.user.uid), {
        uid: cred.user.uid,
        password: payload.password,
        updatedAt: now,
      }).catch(() => {});
      setUserProfile(newProfile);
    } catch (error: unknown) {
      const fbErr = error as { code?: string };
      const code = fbErr?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        throw new Error('PROVIDER_DISABLED');
      }
      if (code === 'auth/email-already-in-use') {
        throw new Error('رقم الهاتف مسجل مسبقاً، يمكنك تسجيل الدخول مباشرة');
      }
      if (code === 'auth/weak-password') {
        throw new Error('كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('تم تجاوز عدد المحاولات المسموح بها، يرجى الانتظار قليلاً');
      }
      throw new Error('تعذر إنشاء الحساب، تأكد من الاتصال بالإنترنت');
    } finally {
      isLoggingInRef.current = false;
      pendingSignupRef.current = null;
    }
  };

  const createAccountByAdmin = async (payload: CreateAccountPayload): Promise<UserProfile> => {
    if (!currentUser || !isAdmin) {
      throw new Error('هذه الصلاحية متاحة للأدمن فقط');
    }

    const cleanUsername = payload.username.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      throw new Error('اسم المستخدم يجب أن يحتوي على 3 إلى 30 حرفاً إنجليزياً أو أرقاماً فقط');
    }

    if (payload.password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const exists = allUsers.some((u) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      throw new Error('اسم المستخدم مسجل مسبقاً، اختر اسماً آخر');
    }

    const secAuth = getSecondaryAuth();
    const email = usernameToEmail(cleanUsername);

    try {
      await setPersistence(secAuth, inMemoryPersistence);
      const cred = await createUserWithEmailAndPassword(secAuth, email, payload.password);
      await updateProfile(cred.user, { displayName: payload.displayName.trim() });

      const newUserProfile: UserProfile = {
        uid: cred.user.uid,
        username: cleanUsername,
        displayName: payload.displayName.trim(),
        role: 'user',
        photoURL: '',
        avatarColor: '#2481cc',
        bio: payload.bio?.trim() || 'مرحباً، أنا أستخدم JanaX!',
        phone: payload.phone?.trim() || '',
        isOnline: false,
        lastSeen: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', cred.user.uid), newUserProfile);
      await setDoc(doc(db, 'adminUserCredentials', cred.user.uid), {
        uid: cred.user.uid,
        password: payload.password,
        updatedAt: newUserProfile.createdAt || new Date().toISOString(),
      }).catch(() => {});
      await signOut(secAuth);
      return newUserProfile;
    } catch (error: unknown) {
      await signOut(secAuth).catch(() => {});
      const fbErr = error as { code?: string };
      if (fbErr?.code === 'auth/email-already-in-use') {
        throw new Error('اسم المستخدم مستخدم بالفعل في قاعدة البيانات');
      }
      if (fbErr?.code === 'auth/weak-password') {
        throw new Error('كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل');
      }
      if (fbErr?.code === 'auth/operation-not-allowed') {
        throw new Error('PROVIDER_DISABLED');
      }
      throw error;
    }
  };

  const getUserCredentialByAdmin = useCallback(
    async (uid: string): Promise<string | null> => {
      if (!isAdmin || !uid) return null;
      try {
        const snap = await getDoc(doc(db, 'adminUserCredentials', uid));
        if (!snap.exists()) return null;
        const data = snap.data() as { password?: string };
        return typeof data.password === 'string' ? data.password : null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `adminUserCredentials/${uid}`);
        return null;
      }
    },
    [isAdmin]
  );

  const updateUserProfileByAdmin = useCallback(
    async (uid: string, data: { displayName: string; phone?: string; bio?: string }) => {
      if (!currentUser || !isAdmin) {
        throw new Error('هذه الصلاحية متاحة للأدمن فقط');
      }

      const cleanName = data.displayName.trim().slice(0, 100);
      if (!cleanName) {
        throw new Error('يرجى إدخال الاسم الكامل');
      }

      const cleanPhone = (data.phone || '').trim().slice(0, 30);
      const cleanBio = (data.bio || '').trim().slice(0, 300);

      try {
        await updateDoc(doc(db, 'users', uid), {
          displayName: cleanName,
          phone: cleanPhone,
          bio: cleanBio,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [currentUser, isAdmin]
  );

  const updateUserPasswordByAdmin = useCallback(
    async (uid: string, newPassword: string, fallbackCurrentPassword?: string) => {
      if (!currentUser || !isAdmin) {
        throw new Error('هذه الصلاحية متاحة للأدمن فقط');
      }

      if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
        throw new Error('كلمة المرور الجديدة يجب أن تكون بين 6 و 128 حرفاً');
      }

      const targetUser = allUsers.find((u) => u.uid === uid);
      if (!targetUser) {
        throw new Error('الحساب غير موجود في السجل');
      }

      const savedPassword = adminCredentialsMap[uid] || (await getUserCredentialByAdmin(uid));
      const effectiveOldPassword = (savedPassword || fallbackCurrentPassword || '').trim();
      const targetEmail = usernameToEmail(targetUser.username);
      const now = new Date().toISOString();

      if (!effectiveOldPassword) {
        throw new Error('كلمة المرور الحالية غير محفوظة بعد؛ يرجى إدخال كلمة المرور الحالية لإتمام التغيير');
      }

      if (uid === currentUser.uid) {
        try {
          await updatePassword(currentUser, newPassword);
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code || '';
          if (code === 'auth/requires-recent-login') {
            try {
              await signInWithEmailAndPassword(auth, targetEmail, effectiveOldPassword);
              if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
              }
            } catch {
              throw new Error('تعذر التحقق من كلمة المرور الحالية لتحديث كلمة مرور الأدمن');
            }
          } else if (code === 'auth/weak-password') {
            throw new Error('كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل');
          } else {
            throw new Error('تعذر تحديث كلمة المرور في نظام المصادقة');
          }
        }

        try {
          await setDoc(doc(db, 'adminUserCredentials', uid), {
            uid,
            password: newPassword,
            updatedAt: now,
          });
          await saveDeviceVault({ email: targetEmail, password: newPassword, uid }).catch(() => {});
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `adminUserCredentials/${uid}`);
        }
        return;
      }

      const secAuth = getSecondaryAuth();
      try {
        await setPersistence(secAuth, inMemoryPersistence);
        const cred = await signInWithEmailAndPassword(secAuth, targetEmail, effectiveOldPassword);
        await updatePassword(cred.user, newPassword);
        await signOut(secAuth);
      } catch (err: unknown) {
        await signOut(secAuth).catch(() => {});
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          throw new Error('كلمة المرور الحالية غير مطابقة لكلمة مرور الحساب في السحابة');
        }
        if (code === 'auth/user-not-found') {
          throw new Error('حساب المصادقة غير موجود في Firebase Auth');
        }
        if (code === 'auth/weak-password') {
          throw new Error('كلمة المرور الجديدة ضعيفة، يجب أن تكون 6 أحرف على الأقل');
        }
        if (code === 'auth/too-many-requests') {
          throw new Error('تم إرسال محاولات كثيرة، يرجى المحاولة بعد قليل');
        }
        throw new Error('تعذر تغيير كلمة المرور، تأكد من الاتصال بالإنترنت');
      }

      try {
        await setDoc(doc(db, 'adminUserCredentials', uid), {
          uid,
          password: newPassword,
          updatedAt: now,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `adminUserCredentials/${uid}`);
      }
    },
    [currentUser, isAdmin, allUsers, adminCredentialsMap, getUserCredentialByAdmin]
  );

  const deleteUserProfileByAdmin = async (uid: string) => {
    if (!isAdmin || uid === currentUser?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'adminUserCredentials', uid)).catch(() => {});
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const updateUserProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    try {
      const safeData = { ...data };
      delete safeData.role;
      delete safeData.uid;
      delete safeData.username;

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, safeData);
      setUserProfile((prev) => (prev ? { ...prev, ...safeData } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  }, [currentUser]);

  const toggleBlockUser = useCallback(
    async (targetUid: string): Promise<boolean> => {
      if (!currentUser || !targetUid || targetUid === currentUser.uid) return false;
      const currentBlocked = Array.isArray(userProfile?.blockedUserIds)
        ? userProfile.blockedUserIds
        : [];
      const isCurrentlyBlocked = currentBlocked.includes(targetUid);
      const nextBlocked = isCurrentlyBlocked
        ? currentBlocked.filter((id) => id !== targetUid)
        : [...currentBlocked, targetUid].slice(0, 200);
      await updateUserProfile({ blockedUserIds: nextBlocked });
      return !isCurrentlyBlocked;
    },
    [currentUser, userProfile?.blockedUserIds, updateUserProfile]
  );

  const toggleMuteChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      if (!currentUser || !chatId) return false;
      const currentMuted = Array.isArray(userProfile?.mutedChatIds)
        ? userProfile.mutedChatIds
        : [];
      const isMuted = currentMuted.includes(chatId);
      const nextMuted = isMuted
        ? currentMuted.filter((id) => id !== chatId)
        : [...currentMuted, chatId].slice(0, 500);
      await updateUserProfile({ mutedChatIds: nextMuted });
      return !isMuted;
    },
    [currentUser, userProfile?.mutedChatIds, updateUserProfile]
  );

  const togglePinChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      if (!currentUser || !chatId) return false;
      const currentPinned = Array.isArray(userProfile?.pinnedChatIds)
        ? userProfile.pinnedChatIds
        : [];
      const isPinned = currentPinned.includes(chatId);
      const nextPinned = isPinned
        ? currentPinned.filter((id) => id !== chatId)
        : [chatId, ...currentPinned].slice(0, 50);
      await updateUserProfile({ pinnedChatIds: nextPinned });
      return !isPinned;
    },
    [currentUser, userProfile?.pinnedChatIds, updateUserProfile]
  );

  const updatePrivacySettings = useCallback(
    async (settings: {
      privacyHideLastSeen?: boolean;
      autoLockSeconds?: number;
      screenSecurityEnabled?: boolean;
      discreetNotifications?: boolean;
    }) => {
      if (!currentUser) return;
      const payload: Partial<UserProfile> = { ...settings };
      if (typeof settings.autoLockSeconds === 'number') {
        localStorage.setItem(AUTOLOCK_SECONDS_CACHE_KEY, String(settings.autoLockSeconds));
      }
      if (settings.privacyHideLastSeen === true) {
        payload.isOnline = false;
      } else if (settings.privacyHideLastSeen === false) {
        payload.isOnline = true;
        payload.lastSeen = new Date().toISOString();
      }
      await updateUserProfile(payload);
    },
    [currentUser, updateUserProfile]
  );

  const contextValue = useMemo<AuthContextType>(
    () => ({
      currentUser,
      userProfile,
      allUsers,
      usersMap,
      adminCredentialsMap,
      adminCalculatorPin,
      calculatorPinVersion,
      adminDecoyPin,
      decoyPinVersion,
      isAdmin,
      loading,
      isAutoLoggingIn,
      lockCounter,
      logoutReason,
      clearLogoutReason,
      theme,
      toggleTheme,
      wallpaper,
      setWallpaper,
      fontSize,
      setFontSize,
      loginWithCredentials,
      registerWithPhone,
      unlockWithCalculatorCode,
      updateCalculatorPinByAdmin,
      updateDecoyPinByAdmin,
      disableDecoyPinByAdmin,
      createAccountByAdmin,
      getUserCredentialByAdmin,
      updateUserProfileByAdmin,
      updateUserPasswordByAdmin,
      deleteUserProfileByAdmin,
      logout,
      updateUserProfile,
      toggleBlockUser,
      toggleMuteChat,
      togglePinChat,
      updatePrivacySettings,
    }),
    [
      currentUser,
      userProfile,
      allUsers,
      usersMap,
      adminCredentialsMap,
      adminCalculatorPin,
      calculatorPinVersion,
      adminDecoyPin,
      decoyPinVersion,
      isAdmin,
      loading,
      isAutoLoggingIn,
      lockCounter,
      logoutReason,
      clearLogoutReason,
      theme,
      toggleTheme,
      wallpaper,
      setWallpaper,
      fontSize,
      setFontSize,
      unlockWithCalculatorCode,
      updateCalculatorPinByAdmin,
      updateDecoyPinByAdmin,
      disableDecoyPinByAdmin,
      getUserCredentialByAdmin,
      updateUserProfileByAdmin,
      updateUserPasswordByAdmin,
      logout,
      updateUserProfile,
      toggleBlockUser,
      toggleMuteChat,
      togglePinChat,
      updatePrivacySettings,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
