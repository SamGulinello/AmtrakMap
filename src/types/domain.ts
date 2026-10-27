/**
 * Shared domain types for Amtrak Live Explorer.
 *
 * These types are the normalized contract between data providers, the map,
 * and the UI. Only fields that are meaningful and supportable by the selected
 * data source(s) are included. Unavailable values are represented explicitly
 * as `undefined` (optional) rather than invented.
 */

/** Point of latitude/longitude. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Province classification of a value's truthfulness. */
export type DataKind = 'live' | 'scheduled' | 'estimate' | 'demo' | 'unknown';

/**
 * A named Amtrak route (e.g. "California Zephyr"). The geometry of an Amtrak
 * corridor is not published by the live data source, so routes here are
 * defined by their station sequences — the shape shown on the map is the
 * polyline through the stations served.
 */
export interface Route {
  /** Route name, e.g. "Lake Shore Limited". */
  name: string;
  /** Simplified slug used for URLs and lookups. */
  slug: string;
  /** City of the route's principal western/southern terminus. */
  serviceStart: string;
  /** City of the route's principal eastern/northern terminus. */
  serviceEnd: string;
  /** Ordered station codes that define the corridor geometry. */
  stationCodes: string[];
  /** Number of trains currently active on this route. */
  activeTrainCount: number;
}

/** A rail or bus stop served by the network. */
export interface Station {
  /** Station code, e.g. "CHI". Primary key. */
  code: string;
  /** Display name. */
  name: string;
  /** Geographic coordinates, when published. */
  position?: GeoPoint;
  /** IANA timezone id of the station. */
  timezone?: string;
  /** Whether the stop is a motorcoach stop rather than a rail station. */
  isBusStop: boolean;
  /** Civil address components when published. */
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  /** Train IDs that serve this station during the current service day. */
  servingTrainIds: string[];
}

/** A stop within a train's itinerary. */
export interface StopPrediction {
  stationCode: string;
  stationName?: string;
  /** Scheduled arrival (ISO 8601, station-local offset), when published. */
  scheduledArrival?: string;
  /** Scheduled departure (ISO 8601), when published. */
  scheduledDeparture?: string;
  /** Estimated (not yet realized) arrival, when published. */
  estimatedArrival?: string;
  /** Estimated departure, when published. */
  estimatedDeparture?: string;
  /** Actual arrival once the train has arrived, when realized. */
  actualArrival?: string;
  /** Actual departure once the train has departed, when realized. */
  actualDeparture?: string;
  /**
   * Operational stop status: whether the train is en route to the stop,
   * sits at the stop, or has already departed. 'Unknown' when not derivable.
   */
  status: 'enroute' | 'station' | 'departed' | 'origin' | 'destination' | 'unknown';
  /** Delay minutes computed from scheduled vs estimated/actual, when derivable. */
  delayMinutes?: number;
  /** Platform information, when published. */
  platform?: string;
}

/** A live vehicle location and its provenance. */
export interface TrainPosition {
  lat: number;
  lon: number;
  /** Speed in miles per hour when published. */
  velocityMph?: number;
  /** Compass direction when published. */
  heading?: string;
  /**
   * Time at which the railroad last received/validated this position,
   * in the provider's native scale. Convert with `toEpochMs`.
   */
  lastValidatedAt?: number;
  /** Kind of truth embodied by this position. */
  dataKind: DataKind;
  /** Human-readable provenance string for this position. */
  sourceLabel: string;
}

/** A status or service alert attached to a train or the network. */
export interface ServiceAlert {
  id: string;
  /** Message text published by the provider. */
  message: string;
  /** Scope of the alert. */
  scope: 'train' | 'network';
  /** Train ID when train-scoped. */
  trainId?: string;
  /** Alert priority. */
  severity: 'info' | 'warning' | 'critical';
  /** ISO timestamp of the alert, when known. */
  publishedAt?: string;
}

/**
 * An operational train (a single service) with its live position,
 * itinerary, and provenance metadata.
 */
export interface Train {
  /** Train number as a display string, e.g. "48". */
  number: string;
  /**
   * Unique service id composed of number and origin day, e.g. "48-26".
   * Primary key for the current service day.
   */
  id: string;
  /** Route name, e.g. "Lake Shore Limited". */
  routeName: string;
  /** Route slug, when derivable. */
  routeSlug?: string;
  /** Display name: route name plus train number. */
  displayName: string;
  /** Operational state: active or predeparture. */
  state: 'active' | 'predeparture' | 'unknown';
  /** Provider that supplies this train, e.g. "Amtrak", "Via", "Brightline". */
  provider: string;
  /** Current position when live/unavailable. */
  position?: TrainPosition;
  /** Origin station code. */
  originCode?: string;
  /** Origin station name. */
  originName?: string;
  /** Destination station code. */
  destinationCode?: string;
  /** Destination station name. */
  destinationName?: string;
  /** Station code of the next/current station event, when published. */
  eventStationCode?: string;
  /** Name of the next/current station event. */
  eventStationName?: string;
  /** Human machine-readable status message from the provider, if any. */
  statusMessage?: string;
  /** Rendered delay summary, e.g. "On time", "2 hr 10 min late", when derivable. */
  delaySummary?: string;
  /** Ordered itinerary. */
  stops: StopPrediction[];
  /** Published alerts for this train. */
  alerts: ServiceAlert[];
  /** When the record was created by the provider's database. */
  createdAt?: string;
  /** When the record was last updated by the provider's database. */
  updatedAt?: string;
  /** Whether the record should be considered stale relative to now. */
  isStale: boolean;
}

/**
 * Overall health/freshness summary of the active data source.
 */
export interface DataSourceStatus {
  /** Whether the most recent request succeeded. */
  ok: boolean;
  /** Human label of the active source, e.g. "Amtraker (live)". */
  sourceLabel: string;
  /** Owning provider id, e.g. "amtraker". */
  providerId: string;
  /** Kind of truth the source provides. */
  dataKind: DataKind;
  /** ISO timestamp of the last successful fetch. */
  lastUpdated?: string;
  /** Milliseconds since each train's data was last updated (averages). */
  staleInfo?: {
    averageLastUpdateMs: number;
    stale: boolean;
  };
  /** Error message from the last failed fetch, if any. */
  error?: string;
  /** True when an initial fetch has not yet completed. */
  loading: boolean;
  /** True when a refresh is currently in flight. */
  refreshing: boolean;
}

/** In-flight metadata about a fetch. */
export interface FetchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  lastAttempt?: Date;
}