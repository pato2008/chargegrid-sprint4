import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSessions } from '../lib/api';
import type { ChargingSession } from '../mock/types';

const POLL_INTERVAL_MS = 2000;

interface SessionsContextValue {
  sessions: ChargingSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { ativas, finalizadas } = await getSessions();
      setSessions([...ativas, ...finalizadas]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conectar com a API.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <SessionsContext.Provider value={{ sessions, loading, error, refresh }}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error('useSessions precisa estar dentro de <SessionsProvider>');
  return ctx;
}
