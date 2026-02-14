const sessionJwtByToken = new Map<string, string>();

export function getSessionJwt(token: string): string | null {
  return sessionJwtByToken.get(token) ?? null;
}

export function setSessionJwt(token: string, jwt: string): void {
  sessionJwtByToken.set(token, jwt);
}

export function clearSessionJwt(token: string): void {
  sessionJwtByToken.delete(token);
}

export function clearAllSessionJwt(): void {
  sessionJwtByToken.clear();
}
