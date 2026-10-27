import type {
  DataSourceStatus,
  Route,
  Station,
  Train,
} from '../types/domain';

/**
 * Provider abstraction: the UI depends only on this interface, never on a
 * concrete API client. Providers are data-shape-agnostic; each returns a
 * normalized `NetworkSnapshot` with whatever fields are supportable.
 */
export interface NetworkSnapshot {
  trains: Train[];
  stations: Station[];
  routes: Route[];
  /** When the snapshot was captured (wall-clock fetch time). */
  fetchedAt: string;
  status: DataSourceStatus;
}

export interface TrainProvider {
  /** Short, stable provider id. */
  readonly id: string;
  /** If true, the snapshot is simulated; never label as live data. */
  readonly demoMode: boolean;
  /** Fetch a complete network snapshot. */
  fetchSnapshot(): Promise<NetworkSnapshot>;
}

/** Filters applied across trains, stations, and routes. */
export interface AppFilters {
  /** Substring query over train numbers, station names/codes, route names. */
  query: string;
  /** Restrict to a single route slug (empty = all). */
  routeSlug: string;
  /** Restrict to a train operational state. */
  trainState: 'all' | 'active' | 'predeparture';
  /** True to show only trains with a live position. */
  onlyWithPosition: boolean;
}

export function emptyFilters(): AppFilters {
  return {
    query: '',
    routeSlug: '',
    trainState: 'all',
    onlyWithPosition: false,
  };
}

export function filtersAreEmpty(f: AppFilters): boolean {
  return (
    f.query.trim() === '' &&
    f.routeSlug === '' &&
    f.trainState === 'all' &&
    !f.onlyWithPosition
  );
}