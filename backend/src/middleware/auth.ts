import type { RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Authentication required'));
  try { const payload = verifyAccessToken(header.slice(7)); req.auth = { userId: payload.sub, role: payload.role }; next(); } catch { next(unauthorized('Invalid or expired access token')); }
};

export function requireRole(role: UserRole): RequestHandler { return (req, _res, next) => req.auth?.role === role ? next() : next(forbidden(`Only ${role.toLowerCase()} accounts can access this resource`)); }; 
