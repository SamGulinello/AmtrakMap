import { describe, expect, it } from 'vitest';
import {
  buildStationPositionMap,
  computeDelaySummary,
  delayMinutes,
  deriveRoutes,
  parseStationResponse,
  normalizeStopStatus,
  stopStatusLabel,
  parseTrain,
  parseTrainResponse,
  validIso,
} from '../../src/data/amtraker/normalize';
import type {
  AmtrakerStop,
  AmtrakerTrain,
  AmtrakerTrainResponse,
} from '../../src/data/amtraker/types';

function baseTrain(overrides: Partial<AmtrakerTrain>): AmtrakerTrain {
  return {
    dataSource: 'amtraker-v3',
    routeName: 'California Zephyr',
    trainNum: '5',
    trainNumRaw: '5',
    trainID: '5-26',
    lat: 39.5,
    lon: -104.9,
    trainTimely: '',
    iconColor: '#2a893d',
    textColor: '#ffffff',
    stations: [],
    heading: 'E',
    eventCode: 'DEN',
    eventTZ: 'America/Denver',
    eventName: 'Denver',
    origCode: 'CHI',
    originTZ: 'America/Chicago',
    origName: 'Chicago Union',
    destCode: 'EMY',
    destTZ: 'America/Los_Angeles',
    destName: 'Emeryville',
    trainState: 'Active',
    velocity: 55,
    statusMsg: '',
    createdAt: '2026-10-26T22:00:00-04:00',
    updatedAt: '2026-10-26T22:00:00-04:00',
    lastValTS: '2026-10-26T21:00:00-06:00',
    objectID: 1,
    provider: 'Amtrak',
    providerShort: 'AMTK',
    onlyOfTrainNum: true,
    alerts: [],
    ...overrides,
  };
}

describe('validIso', () => {
  it('accepts well-formed ISO strings', () => {
    expect(validIso('2026-10-26T09:00:00-05:00')).toBe('2026-10-26T09:00:00-05:00');
  });
  it('rejects empty, null, and malformed values', () => {
    expect(validIso(undefined)).toBeUndefined();
    expect(validIso('')).toBeUndefined();
    expect(validIso('   ')).toBeUndefined();
    expect(validIso('not-a-date')).toBeUndefined();
    expect(validIso(null)).toBeUndefined();
  });
});

describe('delayMinutes', () => {
  it('computes positive delays', () => {
    expect(delayMinutes('2026-10-26T10:00:00-05:00', '2026-10-26T10:30:00-05:00')).toBe(30);
  });
  it('computes negative (early) arrivals', () => {
    expect(delayMinutes('2026-10-26T10:00:00-05:00', '2026-10-26T09:45:00-05:00')).toBe(-15);
  });
  it('is undefined when either input is missing or malformed', () => {
    expect(delayMinutes(undefined, '2026-10-26T10:00:00-05:00')).toBeUndefined();
    expect(delayMinutes('2026-10-26T10:00:00-05:00', 'garbage')).toBeUndefined();
  });
});

describe('stop status mapping', () => {
  it('maps provider vocabulary to the normalized enum', () => {
    expect(normalizeStopStatus('Enroute')).toBe('enroute');
    expect(normalizeStopStatus('STATION')).toBe('station');
    expect(normalizeStopStatus('Departed')).toBe('departed');
    expect(normalizeStopStatus('')).toBe('unknown');
    expect(normalizeStopStatus(undefined)).toBe('unknown');
  });
  it('produces human labels', () => {
    expect(stopStatusLabel('departed')).toBe('Departed');
    expect(stopStatusLabel('unknown')).toBe('Unknown');
  });
});

describe('parseTrain', () => {
  it('normalizes an active train with position data kind live', () => {
    const stops: AmtrakerStop[] = [
      { name: 'Chicago Union', code: 'CHI', tz: 'America/Chicago', status: 'Departed', schArr: '2026-10-26T14:00:00-05:00', schDep: '2026-10-26T14:00:00-05:00' },
      { name: 'Omaha', code: 'OMA', tz: 'America/Chicago', status: 'Enroute', schArr: '2026-10-26T19:00:00-06:00', schDep: '2026-10-26T19:10:00-06:00' },
      { name: 'Denver', code: 'DEN', tz: 'America/Denver', status: 'Enroute', schArr: '2026-10-27T07:15:00-06:00', schDep: '2026-10-27T07:40:00-06:00' },
    ];
    const train = parseTrain(baseTrain({ stations: stops }));
    expect(train.state).toBe('active');
    expect(train.position?.dataKind).toBe('live');
    expect(train.position?.sourceLabel).toBe('Amtraker live feed');
    expect(train.position?.lat).toBe(39.5);
    expect(train.stops[0].status).toBe('origin');
    expect(train.stops[1].status).toBe('enroute');
    expect(train.stops[2].status).toBe('destination');
    expect(train.routeSlug).toBe('california-zephyr');
  });

  it('omits position for predeparture trains (never present the start as live)', () => {
    const train = parseTrain(baseTrain({ trainState: 'Predeparture', lat: 39.5, lon: -104.9 }));
    expect(train.state).toBe('predeparture');
    expect(train.position).toBeUndefined();
  });

  it('omits position for invalid coordinates', () => {
    const train = parseTrain(baseTrain({ lat: 999, lon: -104.9 }));
    expect(train.position).toBeUndefined();
  });

  it('flags stale positions based on the provider timestamp', () => {
    const staleTs = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString();
    const train = parseTrain(baseTrain({ lastValTS: staleTs }));
    expect(train.isStale).toBe(true);
    const fresh = parseTrain(baseTrain({ lastValTS: new Date().toISOString() }));
    expect(fresh.isStale).toBe(false);
  });

  it('treats arr/dep on departed stops as actuals, on enroute stops as estimates', () => {
    const stops: AmtrakerStop[] = [
      { name: 'A', code: 'AAA', tz: 'America/Chicago', status: 'Departed', schArr: '2026-10-26T10:00:00-05:00', arr: '2026-10-26T10:15:00-05:00', dep: '2026-10-26T10:16:00-05:00' },
      { name: 'B', code: 'BBB', tz: 'America/Chicago', status: 'Enroute', schArr: '2026-10-26T11:00:00-05:00', arr: '2026-10-26T11:12:00-05:00' },
    ];
    const train = parseTrain(baseTrain({ stations: stops }));
    expect(train.stops[0].actualArrival).toBe('2026-10-26T10:15:00-05:00');
    expect(train.stops[0].actualDeparture).toBe('2026-10-26T10:16:00-05:00');
    expect(train.stops[0].estimatedArrival).toBeUndefined();
    expect(train.stops[0].delayMinutes).toBe(16);
    expect(train.stops[1].estimatedArrival).toBe('2026-10-26T11:12:00-05:00');
    expect(train.stops[1].actualArrival).toBeUndefined();
    expect(train.stops[1].delayMinutes).toBe(12);
  });

  it('extracts alerts from string and object entries', () => {
    const train = parseTrain(baseTrain({ alerts: [{ message: 'Boarding via Track 4' }, 'Crew change'] }));
    expect(train.alerts).toHaveLength(2);
    expect(train.alerts[0].message).toBe('Boarding via Track 4');
    expect(train.alerts[0].severity).toBe('warning');
  });

  it('survives malformed station arrays and missing codes', () => {
    const train = parseTrain(baseTrain({ stations: undefined as unknown as AmtrakerStop[] }));
    expect(train.stops).toEqual([]);
    expect(train.number).toBe('5');
  });
});

describe('parseTrainResponse', () => {
  it('flattens response buckets and skips malformed records', () => {
    const resp: AmtrakerTrainResponse = {
      '5': [baseTrain({})],
      '48': [baseTrain({ trainID: '48-26', trainNum: '48' }), { garbage: true } as unknown as AmtrakerTrain],
      broken: 'nope' as unknown as [],
    };
    const trains = parseTrainResponse(resp);
    expect(trains).toHaveLength(2);
  });
});

describe('deriveRoutes', () => {
  const pos = new Map([
    ['CHI', { lat: 41.878, lon: -87.636 }],
    ['OMA', { lat: 41.26, lon: -95.935 }],
    ['DEN', { lat: 39.758, lon: -104.993 }],
    ['EMY', { lat: 37.842, lon: -122.295 }],
  ]);
  const stops = (codes: string[]) =>
    codes.map((code, i) => ({ stationCode: code, status: i === 0 ? 'origin' : i === codes.length - 1 ? 'destination' : 'enroute' } as const));

  it('derives corridor geometry from station sequences, drop routes without coordinates', () => {
    const trains = [
      { routeName: 'California Zephyr', routeSlug: 'california-zephyr', state: 'active' as const, stops: stops(['CHI', 'OMA', 'DEN', 'EMY']) },
      { routeName: 'Mystery Corridor', routeSlug: 'mystery', state: 'active' as const, stops: stops(['ZZZ', 'YYY']) },
    ];
    const routes = deriveRoutes(trains as unknown as Parameters<typeof deriveRoutes>[0], pos);
    const zephyr = routes.find((r) => r.slug === 'california-zephyr');
    expect(zephyr).toBeDefined();
    expect(zephyr?.stationCodes).toEqual(['CHI', 'OMA', 'DEN', 'EMY']);
    expect(zephyr?.activeTrainCount).toBe(1);
    expect(routes.some((r) => r.slug === 'mystery')).toBe(false);
  });
});

describe('computeDelaySummary', () => {
  it('returns undefined when no delay is derivable', () => {
    expect(computeDelaySummary({ stops: [] })).toBeUndefined();
  });
  it('formats lateness and punctuality', () => {
    const train = {
      stops: [
        { stationCode: 'A', status: 'departed' as const, delayMinutes: 5 },
        { stationCode: 'B', status: 'enroute' as const, delayMinutes: 130 },
      ],
    };
    expect(computeDelaySummary(train)).toBe('2 hr 10 min late');
    const onTime = { stops: [{ stationCode: 'B', status: 'enroute' as const, delayMinutes: 1 }] };
    expect(computeDelaySummary(onTime)).toBe('On time');
  });
});

describe('buildStationPositionMap', () => {
  it('maps only stations that have coordinates', () => {
    const stations = [
      { code: 'CHI', position: { lat: 41.8, lon: -87.6 }, name: 'Chicago Union', isBusStop: false, servingTrainIds: [] },
      { code: 'BUS', name: 'Bus Stop', isBusStop: true, servingTrainIds: [] },
    ];
    const map = buildStationPositionMap(stations as Parameters<typeof buildStationPositionMap>[0]);
    expect(map.has('CHI')).toBe(true);
    expect(map.has('BUS')).toBe(false);
  });
});

describe('parseStationResponse', () => {
  it('normalizes station metadata recursively', () => {
    const out = parseStationResponse({
      CHI: {
        name: 'Chicago Union', code: 'CHI', tz: 'America/Chicago', lat: 41.8, lon: -87.6,
        address1: '225 S Canal St', city: 'Chicago', state: 'IL', zip: 60606, trains: ['5-26'],
      },
      BAD: { name: 'Bad', code: 'BAD', tz: 'UTC', lat: 40.0, lon: -75.0, trains: [] },
    });
    expect(out).toHaveLength(2);
    expect(out[0].address?.city).toBe('Chicago');
    expect(out[0].position).toEqual({ lat: 41.8, lon: -87.6 });
  });
});
describe('stop realization rules', () => {
  const stop = (over: Partial<AmtrakerStop>): AmtrakerStop => ({
    code: 'XXX',
    name: 'Test',
    tz: 'America/Chicago',
    schArr: '2026-10-26T10:00:00-05:00',
    schDep: '2026-10-26T10:10:00-05:00',
    arr: '2026-10-26T10:00:00-05:00',
    dep: '2026-10-26T10:10:00-05:00',
    status: 'Enroute',
    ...over,
  });

  it('never reports a future stop projection as an actual time', () => {
    // The provider fills `arr`/`dep` ahead of the train with its own projection.
    const train = parseTrain(
      baseTrain({
        stations: [
          stop({ code: 'AAA', status: 'Departed', arr: '2026-10-26T09:58:00-05:00' }),
          stop({ code: 'BBB', status: 'Enroute', arr: '2026-10-26T10:20:00-05:00' }),
        ],
      }),
    );
    const future = train.stops[1];
    expect(future.actualArrival).toBeUndefined();
    expect(future.estimatedArrival).toBe('2026-10-26T10:20:00-05:00');
    expect(future.delayMinutes).toBe(20);
  });

  it('treats a destination projection as an estimate, not an arrival', () => {
    const train = parseTrain(
      baseTrain({
        stations: [
          stop({ code: 'AAA', status: 'Departed' }),
          stop({
            code: 'ZZZ',
            status: 'Enroute',
            schArr: '2026-10-28T05:35:00-07:00',
            arr: '2026-10-28T04:35:00-07:00',
            schDep: '2026-10-28T05:35:00-07:00',
            dep: '2026-10-28T04:35:00-07:00',
          }),
        ],
      }),
    );
    const destination = train.stops[1];
    expect(destination.status).toBe('destination');
    expect(destination.actualArrival).toBeUndefined();
    expect(destination.actualDeparture).toBeUndefined();
    expect(destination.estimatedArrival).toBe('2026-10-28T04:35:00-07:00');
    // A destination has no departure; the mirrored field is discarded.
    expect(destination.estimatedDeparture).toBeUndefined();
  });

  it('drops an "estimate" that merely repeats the schedule', () => {
    const train = parseTrain(
      baseTrain({
        stations: [
          stop({ code: 'AAA', status: 'Departed' }),
          stop({
            code: 'BBB',
            status: 'Enroute',
            schArr: '2026-10-26T12:00:00-05:00',
            arr: '2026-10-26T12:00:00-05:00',
            schDep: '2026-10-26T12:00:00-05:00',
            dep: '2026-10-26T12:00:00-05:00',
          }),
        ],
      }),
    );
    const future = train.stops[1];
    expect(future.estimatedArrival).toBeUndefined();
    expect(future.estimatedDeparture).toBeUndefined();
    expect(future.delayMinutes).toBeUndefined();
  });

  it('keeps reported actuals for departed stops', () => {
    const train = parseTrain(
      baseTrain({
        stations: [
          stop({
            code: 'AAA',
            status: 'Departed',
            arr: '2026-10-26T10:14:00-05:00',
            dep: '2026-10-26T10:16:00-05:00',
          }),
          stop({ code: 'BBB', status: 'Enroute' }),
        ],
      }),
    );
    expect(train.stops[0].actualArrival).toBe('2026-10-26T10:14:00-05:00');
    // The origin has no inbound arrival, so its delay is departure-based.
    expect(train.stops[0].delayMinutes).toBe(6);
  });
});
