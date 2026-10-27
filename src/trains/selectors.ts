/**
 * Pure selection/filter logic over a normalized snapshot.
 */
import type { AppFilters } from '../data/provider';
import type { Route, Station, Train } from '../types/domain';

export interface SearchResults {
  trains: Train[];
  stations: Station[];
  routes: Route[];
}

function queryMatches(q: string, ...fields: Array<string | undefined>): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === '') return true;
  return fields.some((f) => f !== undefined && f.toLowerCase().includes(needle));
}

/** Order trains sensibly: active first, then predeparture, by number. */
export function sortTrains(trains: Train[]): Train[] {
  const rank = (t: Train) => (t.state === 'active' ? 0 : t.state === 'predeparture' ? 1 : 2);
  return [...trains].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const an = Number.parseInt(a.number, 10);
    const bn = Number.parseInt(b.number, 10);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
    return a.id.localeCompare(b.id);
  });
}

export function filterTrains(trains: Train[], filters: AppFilters): Train[] {
  return trains.filter((t) => {
    if (filters.routeSlug && t.routeSlug !== filters.routeSlug) return false;
    if (filters.trainState !== 'all') {
      if (t.state === 'unknown') return false;
      if (t.state !== filters.trainState) return false;
    }
    if (filters.onlyWithPosition && !t.position) return false;
    if (!queryMatches(filters.query, t.displayName, t.number, t.routeName, t.originName, t.destinationName)) {
      return false;
    }
    return true;
  });
}

/** Route names from currently served trains (used for the route filter list). */
export function uniqueRouteNames(trains: Train[]): string[] {
  const seen = new Set<string>();
  for (const t of trains) {
    if (t.routeName) seen.add(t.routeName);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function filterStations(stations: Station[], filters: AppFilters): Station[] {
  if (
    filters.query.trim() === '' &&
    filters.routeSlug === '' &&
    filters.trainState === 'all' &&
    !filters.onlyWithPosition
  ) {
    return stations;
  }
  return stations.filter((s) => {
    if (!queryMatches(filters.query, s.name, s.code, s.address?.city, s.address?.state)) return false;
    return true;
  });
}

export function filterRoutes(routes: Route[], filters: AppFilters): Route[] {
  if (
    filters.query.trim() === '' &&
    filters.routeSlug === '' &&
    filters.trainState === 'all' &&
    !filters.onlyWithPosition
  ) {
    return routes;
  }
  return routes.filter((r) => {
    if (filters.routeSlug && r.slug !== filters.routeSlug) return false;
    if (!queryMatches(filters.query, r.name, r.serviceStart, r.serviceEnd)) return false;
    return true;
  });
}

export function searchAll(
  trains: Train[],
  stations: Station[],
  routes: Route[],
  query: string,
): SearchResults {
  const q = query.trim();
  if (q === '') {
    return { trains: sortTrains(trains), stations, routes };
  }
  return {
    trains: sortTrains(
      trains.filter((t) =>
        queryMatches(q, t.displayName, t.number, t.routeName, t.originName, t.destinationName, `${t.originCode} ${t.destinationCode}`.trim()),
      ),
    ).slice(0, 30),
    stations: stations.filter((s) => queryMatches(q, s.name, s.code, s.address?.city)).slice(0, 30),
    routes: routes.filter((r) => queryMatches(q, r.name, r.serviceStart, r.serviceEnd)).slice(0, 30),
  };
}

/** A quick national summary of the snapshot. */
export interface NetworkSummary {
  activeTrains: number;
  predepartureTrains: number;
  trackedTrains: number;
  withPosition: number;
  stations: number;
  routes: number;
  providers: string[];
  staleTrains: number;
}

export function summarizeNetwork(trains: Train[], stations: Station[], routes: Route[]): NetworkSummary {
  const withPosition = trains.filter((t) => t.position).length;
  return {
    activeTrains: trains.filter((t) => t.state === 'active').length,
    predepartureTrains: trains.filter((t) => t.state === 'predeparture').length,
    trackedTrains: trains.length,
    withPosition,
    stations: stations.length,
    routes: routes.length,
    providers: [...new Set(trains.map((t) => t.provider).filter(Boolean))],
    staleTrains: trains.filter((t) => t.isStale).length,
  };
}

/** Route slug resolved from a train (used for route filter highlighting). */
export function routeSlugOf(train: Train): string | undefined {
  return train.routeSlug;
}