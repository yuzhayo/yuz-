const SESSION_PREFIX = 'yuzha:passkey-session:';
const SESSION_EVENT = 'yuzha:passkey-session:changed';

type SessionEventDetail = {
  moduleId?: string;
};

export type Session = {
  moduleId?: string;
  user: {
    id: string;
    passkey: string;
  };
  createdAt: string;
};

let memorySessions: Record<string, Session | undefined> = {};

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getSessionKey(moduleId?: string): string {
  return `${SESSION_PREFIX}${moduleId ?? 'global'}`;
}

function hashValue(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function createUserId(passkey: string, moduleId?: string): string {
  return `local-${moduleId ?? 'global'}-${hashValue(passkey)}`;
}

function readRawSession(moduleId?: string): Session | null {
  const key = getSessionKey(moduleId);
  const storage = safeSessionStorage();
  if (storage) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw) as Session;
      } catch {
        storage.removeItem(key);
      }
    }
  }
  const fallback = memorySessions[key];
  return fallback ? deepClone(fallback) : null;
}

function writeRawSession(session: Session | null, moduleId?: string): void {
  const key = getSessionKey(moduleId);
  const storage = safeSessionStorage();
  if (session) {
    const serialised = JSON.stringify(session);
    if (storage) {
      storage.setItem(key, serialised);
    }
    memorySessions[key] = deepClone(session);
  } else {
    if (storage) {
      storage.removeItem(key);
    }
    delete memorySessions[key];
  }
  notifySessionChange(moduleId);
}

function notifySessionChange(moduleId?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SessionEventDetail>(SESSION_EVENT, { detail: { moduleId } }));
  }
}

export function getActiveSession(moduleId?: string): Session | null {
  const session = readRawSession(moduleId);
  return session ? deepClone(session) : null;
}

export async function signInWithPasskey(
  passkey: string,
  moduleId?: string
): Promise<{ session: Session | null; error?: string }> {
  const trimmed = passkey.trim();
  if (!trimmed) {
    return { session: null, error: 'Passkey tidak boleh kosong' };
  }

  const session: Session = {
    moduleId,
    user: {
      id: createUserId(trimmed, moduleId),
      passkey: trimmed
    },
    createdAt: new Date().toISOString()
  };
  writeRawSession(session, moduleId);
  return { session: deepClone(session) };
}

export async function signOut(moduleId?: string): Promise<void> {
  writeRawSession(null, moduleId);
}

export function subscribeToSessionChanges(listener: () => void, moduleId?: string): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SessionEventDetail>).detail;
    if (!moduleId || detail?.moduleId === moduleId) {
      listener();
    }
  };
  window.addEventListener(SESSION_EVENT, handler);
  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
  };
}

export function clearSession(moduleId?: string): void {
  writeRawSession(null, moduleId);
}

export function clearAllSessions(): void {
  const keys = Object.keys(memorySessions);
  for (const key of keys) {
    writeRawSession(null, key.replace(SESSION_PREFIX, '') || undefined);
  }
}

