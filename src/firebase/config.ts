import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Primary Firebase App
const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

// CRITICAL: The app requires firestoreDatabaseId specified in config
const databaseId = (firebaseConfig as { firestoreDatabaseId: string }).firestoreDatabaseId;
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalAutoDetectLongPolling: true,
    },
    databaseId
  );
} catch {
  firestoreInstance = getFirestore(app, databaseId);
}
export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Secondary Firebase App used solely by Admin (jehan) to create new accounts without signing out
export function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === 'SecondaryAdminCreator');
  const secApp = existing || initializeApp(firebaseConfig, 'SecondaryAdminCreator');
  return getAuth(secApp);
}

export const ADMIN_USERNAME = 'jehan';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._-]/g, '');
  return `${clean}@janax.app`;
}

export function normalizeArabicDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function extractPhoneDigits(phone: string): string {
  return normalizeArabicDigits(phone).replace(/\D/g, '');
}

export function isPhoneIdentifier(input: string): boolean {
  const normalized = normalizeArabicDigits(input).trim();
  if (!normalized) return false;
  if (!/^[+\d\s\-()]+$/.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function phoneToEmail(phone: string): string {
  const digits = extractPhoneDigits(phone);
  return `p_${digits}@janax.app`;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeArabicDigits(phone).trim();
  const hasPlus = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function isChatAccessibleOnServer(chatId: string, uid: string): Promise<boolean> {
  if (!chatId || !uid) return false;
  if (chatId === `saved_${uid}`) return true;
  try {
    const serverSnap = await getDocFromServer(doc(db, 'chats', chatId));
    if (!serverSnap.exists()) return false;
    const data = serverSnap.data() as {
      type?: string;
      createdBy?: string;
      memberIds?: unknown;
    };
    return (
      data.type === 'channel' ||
      data.createdBy === uid ||
      (Array.isArray(data.memberIds) && data.memberIds.includes(uid))
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') return false;
    return false;
  }
}

// Test connection on boot as mandated
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration or internet connection.');
    }
  }
}

testConnection();

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
};
