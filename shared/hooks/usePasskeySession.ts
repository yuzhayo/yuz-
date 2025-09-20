import { useCallback, useEffect, useState } from 'react';
import {
  getActiveSession,
  signInWithPasskey,
  signOut,
  subscribeToSessionChanges,
  type Session
} from '../auth/passkey';

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

function translateValidationError(message: string | null | undefined): string {
  if (!message) return 'Gagal memverifikasi passkey';
  return message;
}

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

export type { Session } from '../auth/passkey';
