/**
 * React hook owning the network snapshot lifecycle: initial load, bounded
 * auto-refresh, manual refresh, loading/error/demo states.
 *
 * The polling interval honors the provider's cadence (~3 min upstream server
 * refresh). We refresh from the client at that rate with a jitter to avoid
 * thundering herds, and dedupe in-flight requests.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NetworkSnapshot, TrainProvider } from '../data/provider';
import type { DataSourceStatus } from '../types/domain';

export const REFRESH_INTERVAL_MS = 1000 * 60 * 3;
export const INITIAL_RETRY_MS = 1000 * 30;

export interface NetworkDataState {
  snapshot: NetworkSnapshot | undefined;
  status: DataSourceStatus;
  refresh: () => Promise<void>;
  /** True after the first successful load; used to hide perpetual spinners. */
  hasLoadedOnce: boolean;
}

const initialStatus: DataSourceStatus = {
  ok: true,
  sourceLabel: '',
  providerId: '',
  dataKind: 'unknown',
  loading: true,
  refreshing: false,
};

export function useNetworkData(
  provider: TrainProvider,
  opts: { autoRefresh?: boolean } = {},
): NetworkDataState {
  const { autoRefresh = true } = opts;
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | undefined>(undefined);
  const [status, setStatus] = useState<DataSourceStatus>(initialStatus);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void>>(undefined);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    setStatus((s) => ({ ...s, refreshing: true }));
    const run = (async () => {
      try {
        const next = await provider.fetchSnapshot();
        if (!mounted.current) return;
        setSnapshot(next);
        setStatus(next.status);
        setHasLoadedOnce(true);
      } catch (err) {
        if (!mounted.current) return;
        setStatus((s) => ({
          ...s,
          ok: false,
          loading: false,
          refreshing: false,
          lastUpdated: s.lastUpdated,
          error: (err as Error).message,
        }));
      } finally {
        if (mounted.current) {
          setStatus((s) => ({ ...s, loading: false, refreshing: false }));
        }
      }
    })();
    inFlight.current = run.finally(() => {
      inFlight.current = undefined;
    });
    return inFlight.current;
  }, [provider]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS + Math.random() * 1000 * 15);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  return { snapshot, status, refresh, hasLoadedOnce };
}
