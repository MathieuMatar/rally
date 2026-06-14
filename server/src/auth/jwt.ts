import jwt from 'jsonwebtoken';
import type { Role } from '@rally/shared';
import { config } from '../config.js';

export interface TeamTokenPayload {
  role: 'team';
  teamId: string;
}

export interface StaffTokenPayload {
  role: 'organizer' | 'admin';
}

export type TokenPayload = TeamTokenPayload | StaffTokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded !== 'object' || decoded === null || !('role' in decoded)) {
    throw new Error('Invalid token payload');
  }
  const role = (decoded as { role: unknown }).role;
  if (role !== 'team' && role !== 'organizer' && role !== 'admin') {
    throw new Error('Invalid token role');
  }
  return decoded as TokenPayload;
}

export function isRole(payload: TokenPayload, ...roles: Role[]): boolean {
  return (roles as string[]).includes(payload.role);
}
