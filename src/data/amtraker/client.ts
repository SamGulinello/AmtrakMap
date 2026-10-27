/**
 * Amtraker API client with snapshot assembly and caching.
 *
 * Data freshness is not faked: each snapshot carries `fetchedAt` (wall-clock
 * request time) and the provider's own per-train position timestamps.
 */
import type {
  DataSourceStatus,
  Route,
  Station,
  Train,
} from '../../types/domain';
import type { NetworkSnapshot } from '../provider';
import { fetchJson } from '../http';
import { LIVE_SOURCE_LABEL } from './normalize';
import {
  buildStationPositionMap,
  deriveRoutes,
  parseStationResponse,
  parseTrainResponse,
} from './normalize';
import type {
  AmtrakerStaleResponse,
  AmtrakerStationResponse,
  AmtrakerTrainResponse,
} from './types';

export interface AmtrakerEndpoints {
  trains: string;
  stations: string;
  stale: string;
}

export const DEFAULT_ENDPOINTS: AmtrakerEndpoints = {
  trains: 'https://api.amtraker.com/v2/trains',
  stations: 'https://api.amtraker.com/v2/stations',
  stale: 'https://api.amtraker.com/v2/stale',
};

/** How long a successful snapshot may be reused between manual refreshes. */
export const CACHE_TTL_MS = 1000 * 60 * 2;

export class AmtrakerClient {
  readonly id = 'amtraker';
  readonly demoMode = false;

  private cache: { at: number; snapshot: NetworkSnapshot } | undefined;
  private inFlight: Promise<NetworkSnapshot> | undefined;

  constructor(
    private endpoints: AmtrakerEndpoints = DEFAULT_ENDPOINTS,
    private now: () => number = Date.now,
    private fetchJsonImpl: typeof fetchJson = fetchJson,
  ) {}

  private async refresh(): Promise<NetworkSnapshot> {
    const [trainResp, stationResp, staleResp] = await Promise.all([
      this.fetchJsonImpl<AmtrakerTrainResponse>(this.endpoints.trains),
      this.fetchJsonImpl<AmtrakerStationResponse>(this.endpoints.stations),
      this.fetchJsonImpl<AmtrakerStaleResponse>(this.endpoints.stale).catch(() => undefined),
    ]);

    const trains = parseTrainResponse(trainResp);
    const stations = parseStationResponse(stationResp);
    const positionMap = buildStationPositionMap(stations);
    const routes = deriveRoutes(trains, positionMap);

    const status: DataSourceStatus = {
      ok: true,
      sourceLabel: LIVE_SOURCE_LABEL,
      providerId: this.id,
      dataKind: 'live',
      lastUpdated: new Date(this.now()).toISOString(),
      staleInfo: staleResp
        ? {
            averageLastUpdateMs: staleResp.avgLastUpdate,
            stale: staleResp.stale,
          }
        : undefined,
      loading: false,
      refreshing: false,
    };

    return {
      trains,
      stations,
      routes,
      fetchedAt: new Date(this.now()).toISOString(),
      status,
    };
  }

  /** Assemble a fresh snapshot, deduplicating concurrent calls. */
  async fetchSnapshot(): Promise<NetworkSnapshot> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.refresh()
      .then((snapshot) => {
        this.cache = { at: Date.now(), snapshot };
        return snapshot;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }

  /** Cached snapshot when one is still within TTL, else undefined. */
  cachedSnapshot(): { snapshot: NetworkSnapshot; reused: boolean } | undefined {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return { snapshot: this.cache.snapshot, reused: true };
    }
    return undefined;
  }
}

export type { Train, Station, Route };