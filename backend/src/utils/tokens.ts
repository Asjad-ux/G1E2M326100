import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env.js';

export type AuthPayload = { sub: string; role: UserRole };

export function issueAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });
}

export function issueRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.refreshTokenSecret, { expiresIn: env.refreshTokenExpiresIn as SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AuthPayload { return jwt.verify(token, env.jwtSecret) as AuthPayload; }
export function verifyRefreshToken(token: string): AuthPayload { return jwt.verify(token, env.refreshTokenSecret) as AuthPayload; }
export function hashToken(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }

export function refreshExpiry(): Date {
  const raw = env.refreshTokenExpiresIn;
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const multiplier = ({ s: 1000, m: 60000, h: 3600000, d: 86400000 } as Record<string, number>)[match[2]];
  return new Date(Date.now() + Number(match[1]) * multiplier);
}
