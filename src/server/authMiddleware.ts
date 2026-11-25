import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebaseAdmin.ts';

export type AuthRequest = Request & {
  user?: DecodedIdToken;
};

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 8192) {
    res.status(401).json({ error: 'Unauthorized: Invalid token format' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('Firebase ID token verification failed:', err instanceof Error ? err.message : String(err));
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
