/**
 * Provider factory. The app selects a provider by mode:
 *  - `live`: Amtraker API with automatic demo fallback on network failure.
 *  - `demo`: always use the frozen snapshot (used in tests and offline runs).
 */
import type { NetworkSnapshot, TrainProvider } from './provider';
import { AmtrakerClient } from './amtraker/client';
import { DemoProvider } from './amtraker/demo';

export type ProviderMode = 'live' | 'demo';

/** HTTP statuses considered unrecoverable network-level failures. */
const NETWORK_ERROR_STATUSES = new Set([0, 502, 503, 504, 429]);

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch rejected: offline/CORS
  const status = (err as { status?: number })?.status;
  return status !== undefined && NETWORK_ERROR_STATUSES.has(status);
}

export class FallbackProvider implements TrainProvider {
  readonly id = 'fallback';
  readonly demoMode = false;

  constructor(
    private live: AmtrakerClient = new AmtrakerClient(),
    private demo: DemoProvider = new DemoProvider(),
  ) {}

  async fetchSnapshot(): Promise<NetworkSnapshot> {
    try {
      const snapshot = await this.live.fetchSnapshot();
      return snapshot;
    } catch (liveErr) {
      if (!isNetworkFailure(liveErr)) throw liveErr;
      const demo = await this.demo.fetchSnapshot();
      return {
        ...demo,
        status: {
          ...demo.status,
          ok: false,
          error:
            `Live feed unavailable (${(liveErr as Error).message}); showing ` +
            `frozen snapshot instead.`,
        },
      };
    }
  }
}

let sharedLive: AmtrakerClient | undefined;
let sharedDemo: DemoProvider | undefined;
let sharedFallback: FallbackProvider | undefined;

export function getProvider(mode: ProviderMode): TrainProvider {
  sharedLive ??= new AmtrakerClient();
  sharedDemo ??= new DemoProvider();
  sharedFallback ??= new FallbackProvider(sharedLive, sharedDemo);
  return mode === 'demo' ? sharedDemo : sharedFallback;
}