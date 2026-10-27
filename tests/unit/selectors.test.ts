import { describe, expect, it } from 'vitest';
import { emptyFilters, type AppFilters } from '../../src/data/provider';
import {
  filterRoutes,
  filterStations,
  filterTrains,
  searchAll,
  sortTrains,
  summarizeNetwork,
} from '../../src/trains/selectors';
import type { Route, Station, Train } from '../../src/types/domain';

function makeTrain(id: string, overrides: Partial<Train> = {}): Train {
  const [num] = id.split('-');
  return {
    id,
    number: num,
    routeName: 'California Zephyr',
    routeSlug: 'california-zephyr',
    displayName: `California Zephyr ${num}`,
    state: 'active',
    provider: 'Amtrak',
    stops: [],
    alerts: [],
    isStale: false,
    ...overrides,
  };
}

const trains: Train[] = [
  makeTrain('5-26', { state: 'active', position: { lat: 39.5, lon: -104.9, dataKind: 'live', sourceLabel: 'x' } }),
  makeTrain('48-26', { routeName: 'Lake Shore Limited', routeSlug: 'lake-shore-limited', displayName: 'Lake Shore Limited 48', number: '48' }),
  makeTrain('2-26', { state: 'predeparture', displayName: 'California Zephyr 2', number: '2' }),
  makeTrain('6-26', { state: 'active', routeName: 'Empire Builder', routeSlug: 'empire-builder', displayName: 'Empire Builder 6', number: '6' }),
];

describe('filterTrains', () => {
  it('returns everything for empty filters', () => {
    expect(filterTrains(trains, emptyFilters())).toHaveLength(4);
  });
  it('filters by route slug', () => {
    const f: AppFilters = { ...emptyFilters(), routeSlug: 'california-zephyr' };
    expect(filterTrains(trains, f).map((t) => t.id)).toEqual(['5-26', '2-26']);
  });
  it('filters by operational state', () => {
    const f: AppFilters = { ...emptyFilters(), trainState: 'predeparture' };
    expect(filterTrains(trains, f).map((t) => t.id)).toEqual(['2-26']);
  });
  it('filters to trains with live positions', () => {
    const f: AppFilters = { ...emptyFilters(), onlyWithPosition: true };
    expect(filterTrains(trains, f).map((t) => t.id)).toEqual(['5-26']);
  });
  it('matches by number, name, route, and endpoints', () => {
    expect(filterTrains(trains, { ...emptyFilters(), query: '48' }).map((t) => t.id)).toEqual(['48-26']);
    expect(filterTrains(trains, { ...emptyFilters(), query: 'lake shore' }).map((t) => t.id)).toEqual(['48-26']);
    expect(filterTrains(trains, { ...emptyFilters(), query: 'empire builder' }).map((t) => t.id)).toEqual(['6-26']);
  });
});

describe('sortTrains', () => {
  it('sorts active first, then predeparture, by number', () => {
    const sorted = sortTrains([trains[2], trains[3], trains[0]]).map((t) => t.id);
    expect(sorted).toEqual(['5-26', '6-26', '2-26']);
  });
});

describe('searchAll', () => {
  it('finds trains, stations, and routes from one query', () => {
    const stations: Station[] = [
      { code: 'CHI', name: 'Chicago Union', isBusStop: false, servingTrainIds: [] },
      { code: 'NYC', name: 'New York Penn', isBusStop: false, servingTrainIds: [] },
    ];
    const routes: Route[] = [
      { name: 'California Zephyr', slug: 'california-zephyr', serviceStart: 'Chicago', serviceEnd: 'Emeryville', stationCodes: [], activeTrainCount: 1 },
      { name: 'Empire Builder', slug: 'empire-builder', serviceStart: 'Chicago', serviceEnd: 'Portland', stationCodes: [], activeTrainCount: 1 },
    ];
    const results = searchAll(trains.map((t) => (t.id === '5-26' ? { ...t, originName: 'Chicago Union', destinationName: 'Emeryville' } : t)), stations, routes, 'chicago');
    expect(results.trains.length).toBeGreaterThanOrEqual(1);
    expect(results.stations.map((s) => s.code)).toContain('CHI');
    expect(results.routes.map((r) => r.slug)).toEqual(expect.arrayContaining(['california-zephyr', 'empire-builder']));
  });
});

describe('filterStations/filterRoutes', () => {
  const stations: Station[] = [
    { code: 'CHI', name: 'Chicago Union', isBusStop: false, servingTrainIds: [] },
    { code: 'EMY', name: 'Emeryville', isBusStop: false, servingTrainIds: [], address: { city: 'Emeryville', state: 'CA' } },
  ];
  const routes: Route[] = [
    { name: 'California Zephyr', slug: 'california-zephyr', serviceStart: 'Chicago', serviceEnd: 'Emeryville', stationCodes: [], activeTrainCount: 1 },
    { name: 'Empire Builder', slug: 'empire-builder', serviceStart: 'Chicago', serviceEnd: 'Portland', stationCodes: [], activeTrainCount: 1 },
  ];
  it('queries over names, codes, cities', () => {
    expect(filterStations(stations, { ...emptyFilters(), query: 'eMERY' }).map((s) => s.code)).toEqual(['EMY']);
    expect(filterStations(stations, { ...emptyFilters(), query: 'chi' }).map((s) => s.code)).toEqual(['CHI']);
  });
  it('filters routes by slug and query', () => {
    expect(filterRoutes(routes, { ...emptyFilters(), routeSlug: 'empire-builder' }).map((r) => r.slug)).toEqual(['empire-builder']);
    expect(filterRoutes(routes, { ...emptyFilters(), query: 'zephyr' }).map((r) => r.slug)).toEqual(['california-zephyr']);
  });
});

describe('summarizeNetwork', () => {
  it('summarizes counts across a snapshot', () => {
    const stations: Station[] = [{ code: 'CHI', name: 'Chicago', isBusStop: false, servingTrainIds: [] }];
    const routes: Route[] = [{ name: 'California Zephyr', slug: 'california-zephyr', serviceStart: 'a', serviceEnd: 'b', stationCodes: [], activeTrainCount: 1 }];
    const summary = summarizeNetwork(trains, stations, routes);
    expect(summary.activeTrains).toBe(3);
    expect(summary.predepartureTrains).toBe(1);
    expect(summary.withPosition).toBe(1);
    expect(summary.routes).toBe(1);
    expect(summary.stations).toBe(1);
  });
});