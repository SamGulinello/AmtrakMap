import { useMemo } from 'react';
import type { Station, Train } from '../types/domain';
import { SectionTitle } from '../components/Status';

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-btn" onClick={onClick} aria-label="Close station details">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function StationDetailPanel({
  station,
  trains,
  onClose,
  onSelectTrain,
}: {
  station: Station;
  trains: Train[];
  onClose: () => void;
  onSelectTrain: (id: string) => void;
}) {
  const serving = useMemo(
    () => trains.filter((t) => station.servingTrainIds.includes(t.id)),
    [station, trains],
  );
  const addr = station.address;

  return (
    <section className="detail-panel" data-testid="station-detail" role="dialog" aria-label={`${station.name} station details`}>
      <div className="detail-header">
        <div>
          <h2>{station.name}</h2>
          <div className="sub">
            {station.code} · {addr?.city ?? ''}{addr?.city && addr?.state ? ', ' : ''}{addr?.state ?? ''}
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="detail-body">
        <div>
          <SectionTitle>Location</SectionTitle>
          <div className="kv-grid">
            <div className="kv">
              <div className="k">Coordinates</div>
              <div className="v" data-testid="station-coords">
                {station.position ? (
                  <span className="time">
                    {station.position.lat.toFixed(3)}, {station.position.lon.toFixed(3)}
                  </span>
                ) : (
                  '—'
                )}
              </div>
            </div>
            {addr?.line1 && (
              <div className="kv">
                <div className="k">Address</div>
                <div className="v">{addr.line1}</div>
              </div>
            )}
          </div>
        </div>
        <div>
          <SectionTitle>Trains serving this station ({serving.length})</SectionTitle>
          {serving.length === 0 ? (
            <div style={{ color: 'var(--fg-dim)', fontSize: 12.5 }}>No trains with recorded positions in this snapshot.</div>
          ) : (
            <div className="train-list">
              {serving.slice(0, 12).map((t) => (
                <button key={t.id} className="train-item" onClick={() => onSelectTrain(t.id)}>
                  <span className="train-number">{t.number}</span>
                  <span className="train-main">
                    <span className="train-route">{t.routeName}</span>
                    <span className="train-meta">
                      {t.originName ?? '—'} → {t.destinationName ?? '—'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="provenance-note">
          Station metadata and coordinates come from the synchronized Amtrak station list
          maintained by the data provider.
        </div>
      </div>
    </section>
  );
}