/**
 * Raw wire shapes returned by the Amtraker API (api.amtraker.com).
 *
 * These mirror the documented response contracts. Only the fields we consume
 * are typed; the rest are ignored by design.
 */

export interface AmtrakerStop {
  name: string;
  code: string;
  tz: string;
  bus?: boolean;
  /** Scheduled arrival ISO timestamp in station tz. */
  schArr?: string | null;
  /** Scheduled departure ISO timestamp in station tz. */
  schDep?: string | null;
  /** Estimated or actual arrival (depends on station status). */
  arr?: string | null;
  /** Estimated or actual departure. */
  dep?: string | null;
  /** Human delay comment (deprecated upstream, may be empty). */
  arrCmnt?: string;
  depCmnt?: string;
  status?: string;
  platform?: string;
}

export interface AmtrakerTrain {
  dataSource: string;
  routeName: string;
  trainNum: string;
  trainNumRaw: string;
  trainID: string;
  lat?: number | null;
  lon?: number | null;
  trainTimely: string;
  iconColor: string;
  textColor: string;
  stations: AmtrakerStop[];
  heading: string;
  eventCode: string;
  eventTZ: string;
  eventName: string;
  origCode: string;
  originTZ: string;
  origName: string;
  destCode: string;
  destTZ: string;
  destName: string;
  trainState: string;
  velocity?: number | null;
  statusMsg: string;
  createdAt: string;
  updatedAt: string;
  lastValTS: string;
  objectID: number;
  provider: string;
  providerShort: string;
  onlyOfTrainNum: boolean;
  alerts: Array<{ message?: string } | string>;
}

export type AmtrakerTrainResponse = Record<string, AmtrakerTrain[]>;

export interface AmtrakerStationMeta {
  name: string;
  code: string;
  tz: string;
  lat: number;
  lon: number;
  hasAddress?: boolean;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: number | string;
  trains: string[];
}

export type AmtrakerStationResponse = Record<string, AmtrakerStationMeta>;

export interface AmtrakerStaleResponse {
  avgLastUpdate: number;
  medianLastUpdate: number;
  lastUpdatedArr: Array<{ timeSince: number; trainID: string }>;
  activeTrains: number;
  stale: boolean;
}