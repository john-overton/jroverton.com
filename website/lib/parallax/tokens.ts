import { randomBytes } from 'node:crypto';

import { CLEARCUT_TOKEN_BYTES, CLEARCUT_TOKEN_REGEX } from './config';

export function generateToken(): string {
  return randomBytes(CLEARCUT_TOKEN_BYTES).toString('hex');
}

export function isValidToken(token: string): boolean {
  return CLEARCUT_TOKEN_REGEX.test(token);
}
