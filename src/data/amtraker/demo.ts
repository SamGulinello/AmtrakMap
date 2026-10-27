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

const FIXTURE_TIME = '2026-10-27T02:17:00Z';

interface Fixtures {
  trains: AmtrakerTrainResponse;
  stations: AmtrakerStationResponse;
  stale: AmtrakerStaleResponse;
}

let fixtures: Promise<Fixtures> | undefined;

/**
 * The snapshot is over a megabyte, so it is loaded on demand rather than
 * bundled into the initial payload. Offline users never download it twice.
 */
function loadFixtures(): Promise<Fixtures> {
  fixtures ??= Promise.all([
    import('../fixtures/amtraker-trains.snapshot.json'),
    import('../fixtures/amtraker-stations.snapshot.json'),
    import('../fixtures/amtraker-stale.snapshot.json'),
  ]).then(([trains, stations, stale]) => ({
    trains: trains.default as unknown as AmtrakerTrainResponse,
    stations: stations.default as unknown as AmtrakerStationResponse,
    stale: stale.default as unknown as AmtrakerStaleResponse,
  }));
  return fixtures;
}

export class DemoProvider {
  readonly id = 'demo';
  readonly demoMode = true;

  async fetchSnapshot(): Promise<NetworkSnapshot> {
    const raw = await loadFixtures();
    const trains = parseTrainResponse(raw.trains);
    const stations = parseStationResponse(raw.stations);
    // Convert all train positions to demo provenance.
    for (const train of trains) {
      train.isStale = false;
      train.alerts = train.alerts.map((a) => ({ ...a }));
      if (train.position) {
        train.position.dataKind = 'demo';
        train.position.sourceLabel = DEMO_SOURCE_LABEL;
      }
    }
    const stale = raw.stale;
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