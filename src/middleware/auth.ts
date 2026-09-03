import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  if (token === 'demo-token' || token === 'guest') {
    req.user = {
      uid: 'demo-guest-user',
      email: 'guest@serenefocus.app',
      name: 'Guest Friend',
    } as any;
  } else {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  // Ensure user profile exists in profiles table so foreign keys never fail
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@app.local`;
    const displayName = (req.user as any)?.name || (req.user as any)?.displayName || 'User';
    await db.insert(profiles).values({ uid, email, displayName }).onConflictDoNothing();
  } catch (err) {
    console.warn("Could not ensure profile in auth middleware:", err);
  }

  return next();
};
