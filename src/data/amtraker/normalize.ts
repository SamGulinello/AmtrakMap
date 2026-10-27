/**
 * Normalization of raw Amtraker payloads into the shared domain types.
 *
 * Truthfulness rules enforced here:
 * - Position `dataKind` is 'live' only when the train state is "Active" and
 *   both coordinates are finite. Otherwise the position is omitted rather than
 *   presented as live.
 * - Estimated vs actual stop times are distinguished: when a stop's status is
 *   "Departed", the `arr`/`dep` values are treated as actuals; otherwise they
 *   are estimates.
 * - `isStale` derives from the provider's own position timestamps, not from
 *   page-visit time.
 */
import type {
  Route,
  ServiceAlert,
  Station,
  StopPrediction,
  Train,
  TrainPosition,
} from '../../types/domain';
import { routeMeta, routeSlug } from '../routes';
import { sameInstant } from '../../utils/time';
import type {
  AmtrakerStationMeta,
  AmtrakerStationResponse,
  AmtrakerStop,
  AmtrakerTrain,
  AmtrakerTrainResponse,
} from './types';

/** Healthy network identifier. */
export const AMTRAKER_NETWORK =
  'Amtrak passenger rail network (Amtraker real-time feed)';

export const LIVE_SOURCE_LABEL = 'Amtraker live feed';
export const DEMO_SOURCE_LABEL = 'Amtraker snapshot (demo)';

/** Report a position stale when the provider timestamp is older than this. */
export const STALE_MS = 1000 * 60 * 45; // 45 minutes

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** True when an ISO string parses to a valid date. */
export function validIso(v?: string | null): string | undefined {
  if (!v || !nonEmpty(v)) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : v;
}

/**
 * The provider's station status vocabulary. We collapse to our own enum.
 */
export function normalizeStopStatus(raw?: string): StopPrediction['status'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'enroute':
      return 'enroute';
    case 'station':
      return 'station';
    case 'departed':
      return 'departed';
    default:
      return 'unknown';
  }
}

export function stopStatusLabel(status: StopPrediction['status']): string {
  switch (status) {
    case 'departed':
      return 'Departed';
    case 'station':
      return 'At station';
    case 'enroute':
      return 'En route';
    case 'origin':
      return 'Origin';
    case 'destination':
      return 'Destination';
    default:
      return 'Unknown';
  }
}

/** Delay minutes between a scheduled and an epoch-comparable timestamp. */
export function delayMinutes(
  scheduled?: string,
  actualOrEstimate?: string,
): number | undefined {
  const s = scheduled ? Date.parse(scheduled) : NaN;
  const a = actualOrEstimate ? Date.parse(actualOrEstimate) : NaN;
  if (Number.isNaN(s) || Number.isNaN(a)) return undefined;
  return Math.round((a - s) / 60000);
}

function parseStop(raw: AmtrakerStop, index: number, count: number): StopPrediction {
  const scheduledArrival = validIso(raw.schArr);
  const scheduledDeparture = validIso(raw.schDep);
  const actualArrival = validIso(raw.arr);
  const actualDeparture = validIso(raw.dep);

  const status = normalizeStopStatus(raw.status);

  // Treat arr/dep as estimates only while the stop has not yet been departed.
  // The provider fills future stops with the scheduled time verbatim; an
  // identical value is not a prediction, so it must never be shown as one.
  const isDeparted = status === 'departed' || (index === count - 1 && actualDeparture !== undefined);
  const estimatedArrival =
    isDeparted || sameInstant(raw.arr, raw.schArr) ? undefined : actualArrival;
  const estimatedDeparture =
    isDeparted || sameInstant(raw.dep, raw.schDep) ? undefined : actualDeparture;

  // The delay badge must describe the time that is actually displayed, so both
  // use the same basis: an arrival when the stop has one, else a departure.
  // The origin has no inbound arrival, so it is always departure-based.
  const isOrigin = index === 0;
  let delay: number | undefined;
  if (isDeparted) {
    if (!isOrigin && actualArrival) {
      delay = delayMinutes(scheduledArrival ?? scheduledDeparture, actualArrival);
    } else if (actualDeparture) {
      delay = delayMinutes(scheduledDeparture ?? scheduledArrival, actualDeparture);
    }
  } else if (isOrigin && estimatedDeparture) {
    delay = delayMinutes(scheduledDeparture ?? scheduledArrival, estimatedDeparture);
  } else if (estimatedArrival) {
    delay = delayMinutes(scheduledArrival ?? scheduledDeparture, estimatedArrival);
  } else if (estimatedDeparture) {
    delay = delayMinutes(scheduledDeparture ?? scheduledArrival, estimatedDeparture);
  }

  let normalizedStatus = status;
  if (index === 0) normalizedStatus = 'origin';
  if (index === count - 1 && status !== 'departed') normalizedStatus = 'destination';

  return {
    stationCode: raw.code || `unknown-${index}`,
    stationName: nonEmpty(raw.name) ? raw.name : undefined,
    scheduledArrival,
    scheduledDeparture,
    estimatedArrival,
    estimatedDeparture,
    actualArrival: isDeparted ? actualArrival : undefined,
    actualDeparture: isDeparted ? actualDeparture : undefined,
    status: normalizedStatus,
    delayMinutes: delay,
    platform: nonEmpty(raw.platform) ? raw.platform : undefined,
  };
}

function parsePosition(raw: AmtrakerTrain, trainState: Train['state']): TrainPosition | undefined {
  if (trainState !== 'active') return undefined;
  if (!isFiniteNumber(raw.lat) || !isFiniteNumber(raw.lon)) return undefined;
  if (raw.lat < -90 || raw.lat > 90 || raw.lon < -180 || raw.lon > 180) return undefined;
  const lastValidatedAt = validIso(raw.lastValTS);
  return {
    lat: raw.lat,
    lon: raw.lon,
    velocityMph: isFiniteNumber(raw.velocity) ? raw.velocity : undefined,
    heading: nonEmpty(raw.heading) ? raw.heading : undefined,
    lastValidatedAt: lastValidatedAt !== undefined ? Date.parse(lastValidatedAt) : undefined,
    dataKind: 'live',
    sourceLabel: LIVE_SOURCE_LABEL,
  };
}

function parseAlerts(raw: AmtrakerTrain): ServiceAlert[] {
  if (!Array.isArray(raw.alerts)) return [];
  const alerts: ServiceAlert[] = [];
  raw.alerts.forEach((a, i) => {
    const message = typeof a === 'string' ? a : a.message;
    if (nonEmpty(message)) {
      alerts.push({
        id: `${raw.trainID}-alert-${i}`,
        message,
        scope: 'train',
        trainId: raw.trainID,
        severity: 'warning',
      });
    }
  });
  return alerts;
}

function slugFor(name: string): string {
  return routeMeta(name)?.slug ?? routeSlug(name);
}

export function parseTrain(raw: AmtrakerTrain): Train {
  const state: Train['state'] =
    raw.trainState === 'Active'
      ? 'active'
      : raw.trainState === 'Predeparture'
        ? 'predeparture'
        : raw.trainState === 'Completed'
          ? 'unknown'
          : 'unknown';

  const position = parsePosition(raw, state);
  const stops = (Array.isArray(raw.stations) ? raw.stations : [])
    .filter((s) => s && typeof s === 'object')
    .map((s, i) => parseStop(s, i, raw.stations.length));

  // The provider's own "stale" notion is the distance between the last
  // position validation and now.
  let isStale = false;
  if (position?.lastValidatedAt !== undefined) {
    isStale = Date.now() - position.lastValidatedAt > STALE_MS;
  }

  const lastStop = stops[stops.length - 1];
  const firstStop = stops[0];
  const isWithin = (c?: string) => c !== undefined && (c.length === 3 || c.length === 4);

  return {
    number: raw.trainNum ?? '',
    id: raw.trainID ?? '',
    routeName: nonEmpty(raw.routeName) ? raw.routeName : 'Unknown',
    routeSlug: slugFor(raw.routeName),
    displayName: `${nonEmpty(raw.routeName) ? raw.routeName : 'Train'} ${raw.trainNum ?? ''}`.trim(),
    serviceDate: serviceDateOf(raw.trainID, firstStop?.scheduledDeparture),
    state,
    provider: nonEmpty(raw.provider) ? raw.provider : 'Unknown',
    position,
    originCode: isWithin(raw.origCode) ? raw.origCode : firstStop?.stationCode,
    originName: nonEmpty(raw.origName) ? raw.origName : firstStop?.stationName,
    destinationCode: isWithin(raw.destCode) ? raw.destCode : lastStop?.stationCode,
    destinationName: nonEmpty(raw.destName) ? raw.destName : lastStop?.stationName,
    eventStationCode: isWithin(raw.eventCode) ? raw.eventCode : undefined,
    eventStationName: nonEmpty(raw.eventName) ? raw.eventName : undefined,
    statusMessage: nonEmpty(raw.statusMsg) && raw.statusMsg !== ' ' ? raw.statusMsg : undefined,
    delaySummary: computeDelaySummary({ stops }),
    stops,
    alerts: parseAlerts(raw),
    createdAt: validIso(raw.createdAt),
    updatedAt: validIso(raw.updatedAt),
    isStale,
  };
}

/**
 * Derive the service (origin departure) date. The provider encodes the origin
 * day-of-month in the train id suffix ("5-26"), and the origin stop carries the
 * authoritative scheduled departure date when present. Long-distance trains
 * from different origin days share a train number, so this date disambiguates
 * them in the UI.
 */
export function serviceDateOf(trainId: string | undefined, originDeparture?: string): string | undefined {
  const fromStop = originDeparture ? originDeparture.slice(0, 10) : undefined;
  if (fromStop && /^\d{4}-\d{2}-\d{2}$/.test(fromStop)) return fromStop;
  const dayPart = trainId?.split('-')[1];
  if (dayPart && /^\d{1,2}$/.test(dayPart)) {
    const day = Number.parseInt(dayPart, 10);
    if (day >= 1 && day <= 31) return String(day).padStart(2, '0');
  }
  return undefined;
}

/** Compute a human delay summary from the current (next) stop when possible. */
export function computeDelaySummary(train: Pick<Train, 'stops'>): string | undefined {
  const next = train.stops.find(
    (s) => s.status === 'enroute' || s.status === 'station',
  );
  const delay = next?.delayMinutes;
  if (delay === undefined) return undefined;
  if (Math.abs(delay) <= 4) return 'On time';
  const abs = Math.abs(delay);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts = h > 0 ? `${h} hr ${m > 0 ? `${m} min` : ''}`.trim() : `${m} min`;
  return delay < 0 ? `${parts} early` : `${parts} late`;
}

export function parseTrainResponse(raw: AmtrakerTrainResponse): Train[] {
  if (!raw || typeof raw !== 'object') return [];
  const trains: Train[] = [];
  for (const key of Object.keys(raw)) {
    const group = raw[key];
    if (!Array.isArray(group)) continue;
    for (const t of group) {
      if (t && typeof t === 'object' && nonEmpty(t.trainID)) {
        try {
          trains.push(parseTrain(t));
        } catch {
          // skip malformed records without failing the whole snapshot
        }
      }
    }
  }
  return trains;
}

export function parseStationMeta(raw: AmtrakerStationMeta): Station {
  return {
    code: raw.code || '',
    name: nonEmpty(raw.name) ? raw.name : raw.code || 'Unknown',
    position:
      isFiniteNumber(raw.lat) && isFiniteNumber(raw.lon)
        ? { lat: raw.lat, lon: raw.lon }
        : undefined,
    timezone: nonEmpty(raw.tz) ? raw.tz : undefined,
    isBusStop: false,
    address:
      nonEmpty(raw.address1) || nonEmpty(raw.city) || nonEmpty(raw.state)
        ? {
            line1: nonEmpty(raw.address1) ? raw.address1 : undefined,
            city: nonEmpty(raw.city) ? raw.city : undefined,
            state: nonEmpty(raw.state) ? raw.state : undefined,
            zip: raw.zip !== undefined && raw.zip !== '' ? String(raw.zip) : undefined,
          }
        : undefined,
    servingTrainIds: Array.isArray(raw.trains) ? raw.trains.filter(nonEmpty) : [],
  };
}

export function parseStationResponse(raw: AmtrakerStationResponse): Station[] {
  if (!raw || typeof raw !== 'object') return [];
  const stations: Station[] = [];
  for (const code of Object.keys(raw)) {
    const s = raw[code];
    if (s && typeof s === 'object' && nonEmpty(s.code)) {
      try {
        stations.push(parseStationMeta(s));
      } catch {
        // skip malformed records
      }
    }
  }
  return stations;
}

/**
 * Derive route definitions from the trains that serve them. The live source
 * does not publish station-to-station geometry, so the route corridor is the
 * ordered sequence of stations observed across active services.
 */
export function deriveRoutes(
  trains: Train[],
  stationPositions: Map<string, { lat: number; lon: number }>,
): Route[] {
  const bySlug = new Map<string, Route>();
  for (const train of trains) {
    const slug = train.routeSlug ?? slugFor(train.routeName);
    const codes = train.stops.map((s) => s.stationCode);
    const existing = bySlug.get(slug);
    if (!existing) {
      const meta = routeMeta(train.routeName);
      bySlug.set(slug, {
        name: train.routeName,
        slug,
        serviceStart: meta?.endA ?? train.originName ?? '',
        serviceEnd: meta?.endB ?? train.destinationName ?? '',
        stationCodes: codes,
        activeTrainCount: train.state === 'active' ? 1 : 0,
      });
    } else {
      existing.activeTrainCount += train.state === 'active' ? 1 : 0;
      // Append any new stations not already present to capture corridor length.
      for (const code of codes) {
        if (!existing.stationCodes.includes(code)) existing.stationCodes.push(code);
      }
    }
  }
  const toDrop = new Set<string>();
  for (const route of bySlug.values()) {
    route.stationCodes = route.stationCodes
      .filter((c) => stationPositions.has(c))
      .filter((c, i, arr) => arr.indexOf(c) === i);
    if (route.stationCodes.length < 2) toDrop.add(route.slug);
  }
  for (const slug of toDrop) bySlug.delete(slug);
  return [...bySlug.values()];
}

export function buildStationPositionMap(
  stations: Station[],
): Map<string, { lat: number; lon: number }> {
  const m = new Map<string, { lat: number; lon: number }>();
  for (const s of stations) {
    if (s.position) m.set(s.code, s.position);
  }
  return m;
}