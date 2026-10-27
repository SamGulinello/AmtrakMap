import { useMemo } from 'react';
import type { DataKind, Station, StopPrediction, Train } from '../types/domain';
import { formatNumber, formatRelative, formatTime } from '../utils/time';
import { StatusDot } from '../components/Status';

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-btn" onClick={onClick} aria-label="Close train details">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function delayLabel(delay: number | undefined): string {
  if (delay === undefined) return '';
  if (delay <= 5 && delay >= -5) return 'On time';
  if (delay < 0) return `${-delay} min early`;
  if (delay < 60) return `${delay} min late`;
  const h = Math.floor(delay / 60);
  const m = delay % 60;
  return m ? `${h} hr ${m} min late` : `${h} hr late`;
}

function StopRow({
  stop,
  stationName,
  highlight,
}: {
  stop: StopPrediction;
  stationName: string | undefined;
  highlight: boolean;
}) {
  const departed = stop.status === 'departed' || stop.status === 'origin';
  let badge: React.ReactNode = null;
  if (stop.delayMinutes !== undefined) {
    const d = stop.delayMinutes;
    const cls = d <= -5 ? 'early' : d >= 8 ? 'late' : '';
    if (cls) badge = <span className={`stop-badge ${cls}`}>{delayLabel(d)}</span>;
  }
  return (
    <div className={`stop-row${departed ? ' departed' : ''}`}>
      <span className="stop-ind" aria-hidden="true">
        <span className="stop-dot" />
      </span>
      <span className="stop-name">
        {stationName ?? stop.stationCode}
        <span className="stop-code">{stop.stationCode}</span>
        {highlight && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>▲</span>}
        {stop.status === 'station' && <span style={{ fontSize: 10, color: 'var(--warn)', marginLeft: 4 }}>(at station)</span>}
      </span>
      <span className="stop-times">
        {stop.actualArrival ? (
          <>
            <span className="stop-act">{formatTime(stop.actualArrival)}</span>
            <span className="stop-sched"> {formatTime(stop.scheduledArrival)}</span>
          </>
        ) : stop.actualDeparture ? (
          <>
            <span className="stop-act">{formatTime(stop.actualDeparture)}</span>
            <span className="stop-sched"> {formatTime(stop.scheduledDeparture)}</span>
          </>
        ) : stop.estimatedArrival || stop.estimatedDeparture ? (
          <span className="stop-est">
            est {formatTime(stop.estimatedArrival ?? stop.estimatedDeparture)}
          </span>
        ) : (
          <span className="stop-sched">{formatTime(stop.scheduledArrival ?? stop.scheduledDeparture)}</span>
        )}
        {badge}
      </span>
    </div>
  );
}

export function TrainDetailPanel({
  train,
  stations,
  onClose,
  onSelectStation,
}: {
  train: Train;
  stations: Station[];
  onClose: () => void;
  onSelectStation: (code: string) => void;
}) {
  const stationByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stations) map.set(s.code, s.name);
    return map;
  }, [stations]);

  const pos = train.position;
  const stopStatus = train.isStale ? 'stale' : pos?.dataKind === 'demo' ? 'demo' : pos ? 'live' : 'scheduled';
  const lastValid = pos?.lastValidatedAt;
  const updatedEpoch = train.updatedAt ? Date.parse(train.updatedAt) : NaN;

  const upcomingStops = useMemo(
    () =>
      train.stops.filter((s) => s.status === 'enroute' || s.status === 'station').length +
      (train.stops.filter((s) => s.status === 'destination').length),
    [train.stops],
  );

  return (
    <section className="detail-panel" data-testid="train-detail" role="dialog" aria-label={`${train.displayName} details`}>
      <div className="detail-header">
        <div>
          <h2>{train.number} · {train.routeName}</h2>
          <div className="sub">
            <StatusDot tone={stopStatus} label={train.isStale ? 'Stale position' : statusLabel(pos?.dataKind)} />
            {train.delaySummary && <> · {train.delaySummary}</>}
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="detail-body">
        <div>
          <div className="detail-section-title">Service</div>
          <div className="kv-grid">
            <div className="kv">
              <div className="k">From</div>
              <div className="v"><button className="btn btn-ghost" style={{ padding: 0, fontSize: 13, color: 'var(--sched)' }} onClick={() => onSelectStation(train.originCode ?? '')}>{train.originName ?? '—'}</button></div>
            </div>
            <div className="kv">
              <div className="k">To</div>
              <div className="v"><button className="btn btn-ghost" style={{ padding: 0, fontSize: 13, color: 'var(--sched)' }} onClick={() => onSelectStation(train.destinationCode ?? '')}>{train.destinationName ?? '—'}</button></div>
            </div>
            {train.eventStationName && (
              <div className="kv">
                <div className="k">Next stop</div>
                <div className="v"><button className="btn btn-ghost" style={{ padding: 0, fontSize: 13, color: 'var(--sched)' }} onClick={() => onSelectStation(train.eventStationCode ?? '')}>{train.eventStationName}</button></div>
              </div>
            )}
            <div className="kv">
              <div className="k">Status</div>
              <div className="v" data-testid="train-state">{train.statusMessage ?? stateLabel(train.state)}</div>
            </div>
          </div>
        </div>

        {pos ? (
          <div>
            <div className="detail-section-title">Live position</div>
            <div className="kv-grid">
              <div className="kv">
                <div className="k">Coordinates</div>
                <div className="v" data-testid="train-coords">
                  {pos.lat.toFixed(3)}, {pos.lon.toFixed(3)}
                </div>
              </div>
              {pos.velocityMph !== undefined && (
                <div className="kv">
                  <div className="k">Speed</div>
                  <div className="v">{formatNumber(pos.velocityMph, 0)} mph</div>
                </div>
              )}
              {pos.heading && (
                <div className="kv">
                  <div className="k">Heading</div>
                  <div className="v">{pos.heading}</div>
                </div>
              )}
              {lastValid !== undefined && (
                <div className="kv">
                  <div className="k">Reported</div>
                  <div className="v">{formatRelative(lastValid)}</div>
                </div>
              )}
            </div>
            <div className="provenance-note" data-testid="position-provenance">
              {pos.dataKind === 'live'
                ? `Live position from ${pos.sourceLabel}.`
                : pos.dataKind === 'demo'
                  ? `Demo snapshot position (${pos.sourceLabel}); not live Amtrak data.`
                  : `Position source: ${pos.sourceLabel}.`}
              {updatedEpoch && !Number.isNaN(updatedEpoch) && (
                <span> Train record updated {formatRelative(updatedEpoch)}.</span>
              )}
            </div>
          </div>
        ) : (
          <div className="provenance-note">
            No live position available{upcomingStops > 0 ? '; itinerary below is scheduled information' : ''}.
            {train.state === 'predeparture' ? ' This service has not departed yet.' : ''}
          </div>
        )}

        {train.alerts.length > 0 && (
          <div>
            <div className="detail-section-title">Alerts</div>
            {train.alerts.map((a, i) => (
              <div key={a.id || i} className="alert-box" data-testid="train-alert">
                {a.message}
              </div>
            ))}
          </div>
        )}

        {train.stops.length > 0 && (
          <div>
            <div className="detail-section-title">
              Stops · {train.stops.length}
            </div>
            <div className="stops-list">
              {train.stops.map((s, i) => (
                <StopRow
                  key={`${s.stationCode}-${i}`}
                  stop={s}
                  stationName={stationByName.get(s.stationCode) ?? s.stationName}
                  highlight={s.stationCode === train.eventStationCode}
                />
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', marginTop: 6 }}>
              Times shown in each station's local timezone. Struck-through times are scheduled;
              purple times are estimates; plain times are actuals.
            </div>
          </div>
        )}

        <div className="provenance-note">
          <strong>Data provenance.</strong> Train metadata is {pos?.dataKind === 'demo' ? 'from a frozen demo snapshot' : `from ${train.provider} via the selected provider`}.
          Operational details beyond this itinerary (crew, onboard amenities) are not shown because the source does not publish them.
        </div>
      </div>
    </section>
  );
}

function statusLabel(kind: DataKind | undefined): string {
  switch (kind) {
    case 'live':
      return 'Live position';
    case 'demo':
      return 'Demo position';
    case 'estimate':
      return 'Estimated';
    case 'scheduled':
      return 'Scheduled';
    case undefined:
    default:
      return 'Position unknown';
  }
}

function stateLabel(state: Train['state']): string {
  switch (state) {
    case 'active':
      return 'Active';
    case 'predeparture':
      return 'Predeparture';
    default:
      return 'Unknown';
  }
}