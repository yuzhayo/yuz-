import { useCallback, useEffect, useState } from 'react';

// Constants
const SESSION_PREFIX = 'yuzha:passkey-session:';
const SESSION_EVENT = 'yuzha:passkey-session:changed';

// Types
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

type Status = 'checking' | 'authenticated' | 'unauthenticated';

type PasskeyState = {
  status: Status;
  session: Session | null;
  error: string | null;
  signIn: (passkey: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type Options = {
  moduleId?: string;
  requirePasskey?: boolean;
};

// Internal state
let memorySessions: Record<string, Session | undefined> = {};

// Utility functions
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

function translateValidationError(message: string | null | undefined): string {
  if (!message) return 'Gagal memverifikasi passkey';
  return message;
}

// Core passkey functions
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

// React hook
export function usePasskeySession(options: Options = {}): PasskeyState {
  const { moduleId, requirePasskey = false } = options;
  const [status, setStatus] = useState<Status>('checking');
  const [session, setSession] = useState<Session | null>(() => getActiveSession(moduleId));
  const [error, setError] = useState<string | null>(null);
  const autoPasskey = requirePasskey ? null : `auto-${moduleId ?? 'global'}`;

  useEffect(() => {
    let active = true;

    async function ensureSession() {
      let current = getActiveSession(moduleId);
      if (!current && !requirePasskey && autoPasskey) {
        const result = await signInWithPasskey(autoPasskey, moduleId);
        current = result.session ?? null;
      }
      if (!active) return;
      setSession(current);
      setStatus(current ? 'authenticated' : 'unauthenticated');
      if (!current) {
        setError(null);
      }
    }

    void ensureSession();

    const unsubscribe = subscribeToSessionChanges(() => {
      void ensureSession();
    }, moduleId);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [moduleId, requirePasskey, autoPasskey]);

  const signInHandler = useCallback(async (passkey: string) => {
    setStatus('checking');
    setError(null);

    const result = await signInWithPasskey(passkey, moduleId);
    if (!result.session || result.error) {
      setStatus('unauthenticated');
      setSession(null);
      setError(translateValidationError(result.error));
      return;
    }

    setSession(result.session);
    setStatus('authenticated');
  }, [moduleId]);

  const signOutHandler = useCallback(async () => {
    await signOut(moduleId);
    setSession(null);
    setStatus(requirePasskey ? 'unauthenticated' : 'checking');
    setError(null);
  }, [moduleId, requirePasskey]);

  return { status, session, error, signIn: signInHandler, signOut: signOutHandler };
}