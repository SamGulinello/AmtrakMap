/**
 * Demo provider.
 *
 * Serves a *frozen snapshot of real Amtraker data* captured at fixture time.
 * Every record is labeled `dataKind: 'demo'` so nothing in the UI can present
 * the snapshot positions as live. This is the honest fallback when the live
 * API is unreachable (offline, blocked, or rate limited).
 */
import type { DataSourceStatus } from '../../types/domain';
import type { NetworkSnapshot } from '../provider';
import { DEMO_SOURCE_LABEL } from './normalize';
import { parseStationResponse, parseTrainResponse } from './normalize';
import { buildStationPositionMap, deriveRoutes } from './normalize';
import type {
  AmtrakerStaleResponse,
  AmtrakerStationResponse,
  AmtrakerTrainResponse,
} from './types';

// Note: imported via Vite JSON loader; fixtures are committed in the repo.
import rawTrains from '../fixtures/amtraker-trains.snapshot.json';
import rawStations from '../fixtures/amtraker-stations.snapshot.json';
import rawStale from '../fixtures/amtraker-stale.snapshot.json';

const FIXTURE_TIME = '2026-10-27T02:17:00Z';

export class DemoProvider {
  readonly id = 'demo';
  readonly demoMode = true;

  async fetchSnapshot(): Promise<NetworkSnapshot> {
    const trains = parseTrainResponse(rawTrains as unknown as AmtrakerTrainResponse);
    const stations = parseStationResponse(rawStations as unknown as AmtrakerStationResponse);
    // Convert all train positions to demo provenance.
    for (const train of trains) {
      train.isStale = false;
      train.alerts = train.alerts.map((a) => ({ ...a }));
      if (train.position) {
        train.position.dataKind = 'demo';
        train.position.sourceLabel = DEMO_SOURCE_LABEL;
      }
    }
    const stale = rawStale as unknown as AmtrakerStaleResponse;
    const positionMap = buildStationPositionMap(stations);
    const routes = deriveRoutes(trains, positionMap);

    const status: DataSourceStatus = {
      ok: true,
      sourceLabel: `${DEMO_SOURCE_LABEL} (snapshot of ${FIXTURE_TIME})`,
      providerId: this.id,
      dataKind: 'demo',
      lastUpdated: FIXTURE_TIME,
      staleInfo: {
        averageLastUpdateMs: stale.avgLastUpdate,
        stale: stale.stale,
      },
      loading: false,
      refreshing: false,
    };

    return {
      trains,
      stations,
      routes,
      fetchedAt: FIXTURE_TIME,
      status,
    };
  }
}