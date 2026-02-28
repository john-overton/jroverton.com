const CLEARCUT_JWT_STORAGE_PREFIX = 'clearcut_jwt_';

function getStorageKey(token: string): string {
  return `${CLEARCUT_JWT_STORAGE_PREFIX}${token}`;
}

function getFromStorage(token: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(getStorageKey(token));
  } catch {
    return null;
  }
}

function setInStorage(token: string, jwt: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(token), jwt);
  } catch {
    // ignore (e.g. private browsing)
  }
}

function removeFromStorage(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getStorageKey(token));
  } catch {
    // ignore
  }
}

const sessionJwtByToken = new Map<string, string>();

export function getSessionJwt(token: string): string | null {
  return sessionJwtByToken.get(token) ?? getFromStorage(token);
}

export function setSessionJwt(token: string, jwt: string): void {
  sessionJwtByToken.set(token, jwt);
  setInStorage(token, jwt);
}

export function clearSessionJwt(token: string): void {
  sessionJwtByToken.delete(token);
  removeFromStorage(token);
}

export function clearAllSessionJwt(): void {
  sessionJwtByToken.clear();
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CLEARCUT_JWT_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
