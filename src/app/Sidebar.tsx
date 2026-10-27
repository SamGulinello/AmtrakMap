import type { AppFilters } from '../data/provider';
import type { Train } from '../types/domain';
import type { NetworkSummary, SearchResults } from '../trains/selectors';
import { routeSlug } from '../data/routes';
import { StatusDot } from '../components/Status';
import type { Selection } from './App';
import type { DataSourceStatus } from '../types/domain';
import { formatAge } from '../utils/time';

/** Stable id so the "/" shortcut can focus the search field from the shell. */
export const SEARCH_INPUT_ID = 'explorer-search';

/** Render a service date compactly: full ISO dates as "Oct 25", day-of-month as "day 25". */
function formatServiceDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
  return `day ${value}`;
}

function SearchField({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="search-field">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        id={SEARCH_INPUT_ID}
        className="search-input"
        type="text"
        placeholder="Search trains, stations, routes…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search trains, stations, routes"
        role="searchbox"
      />
      {query && (
        <button className="clear-search" onClick={() => onQueryChange('')} aria-label="Clear search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TrainListItem({
  train,
  selected,
  onSelect,
}: {
  train: Train;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const tone = train.isStale
    ? 'stale'
    : train.position?.dataKind === 'demo'
      ? 'demo'
      : train.position
        ? 'live'
        : 'scheduled';
  const label = train.isStale
    ? 'Stale'
    : train.position?.dataKind === 'demo'
      ? 'Demo'
      : train.position
        ? 'Live'
        : 'Scheduled';

  return (
    <button
      className={`train-item${selected ? ' selected' : ''}`}
      onClick={() => onSelect(train.id)}
      aria-pressed={selected}
      data-testid="train-list-item"
    >
      <span className="train-number">{train.number}</span>
      <span className="train-main">
        <span className="train-route">{train.routeName}</span>
        <span className="train-meta">
          {train.originName ?? '—'} → {train.destinationName ?? '—'}
        </span>
      </span>
      <span className="train-side">
        {train.serviceDate && (
          <span className="train-service-date" data-testid="train-service-date">
            {formatServiceDate(train.serviceDate)}
          </span>
        )}
        <StatusDot tone={tone} label={label} dotOnly />
      </span>
    </button>
  );
}

function SearchResultsPane({
  results,
  onSelectTrain,
  onSelectStation,
}: {
  results: SearchResults;
  onSelectTrain: (id: string) => void;
  onSelectStation: (code: string) => void;
}) {
  return (
    <div data-testid="search-results">
      {results.trains.length > 0 && (
        <div className="panel">
          <div className="panel-title">Trains ({results.trains.length})</div>
          <div className="train-list">
            {results.trains.slice(0, 8).map((t) => (
              <TrainListItem key={t.id} train={t} selected={false} onSelect={onSelectTrain} />
            ))}
          </div>
        </div>
      )}
      {results.stations.length > 0 && (
        <div className="panel">
          <div className="panel-title">Stations ({results.stations.length})</div>
          <div className="train-list">
            {results.stations.slice(0, 6).map((s) => (
              <button
                key={s.code}
                className="train-item"
                onClick={() => onSelectStation(s.code)}
                data-testid="station-result"
              >
                <span className="train-number" style={{ fontSize: 11 }}>{s.code}</span>
                <span className="train-main">
                  <span className="train-route">{s.name}</span>
                  <span className="train-meta">
                    {s.address?.city ?? ''}{s.address?.city && s.address?.state ? ', ' : ''}{s.address?.state ?? ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {results.routes.length > 0 && (
        <div className="panel">
          <div className="panel-title">Routes ({results.routes.length})</div>
          <div className="train-list">
            {results.routes.slice(0, 6).map((r) => (
              <div key={r.slug} className="route-item">
                <span className="train-main">
                  <span className="train-route">{r.name}</span>
                  <span className="train-meta">
                    {r.serviceStart} — {r.serviceEnd} · {r.activeTrainCount} active
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.trains.length + results.stations.length + results.routes.length === 0 && (
        <div className="empty-state" data-testid="empty-state">
          <strong>No matches</strong>
          Try a different search term.
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  summary,
  status,
  filters,
  onFiltersChange,
  routeNames,
  filteredTrains,
  onSelectTrain,
  onSelectStation,
  selection,
  query,
  onQueryChange,
  searchResults,
  visible,
  onClose,
}: {
  summary: NetworkSummary;
  status: DataSourceStatus;
  filters: AppFilters;
  onFiltersChange: (f: AppFilters) => void;
  routeNames: string[];
  filteredTrains: Train[];
  onSelectTrain: (id: string) => void;
  onSelectStation: (code: string) => void;
  selection: Selection;
  query: string;
  onQueryChange: (q: string) => void;
  searchResults?: SearchResults;
  visible: boolean;
  onClose: () => void;
}) {
  const hasActiveFilters =
    filters.routeSlug !== '' || filters.trainState !== 'all' || filters.onlyWithPosition;

  const patch = (p: Partial<AppFilters>) => onFiltersChange({ ...filters, ...p });

  return (
    <aside className={`sidebar${visible ? ' visible' : ''}`} aria-label="Network filters and trains" data-testid="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-inner">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost sidebar-close-mobile" onClick={onClose} aria-label="Close filters panel">
              ✕
            </button>
          </div>
          <div className="panel">
            <SearchField query={query} onQueryChange={onQueryChange} />
            <div className="filter-row">
              <select
                className="filter-select"
                value={filters.routeSlug}
                onChange={(e) => patch({ routeSlug: e.target.value })}
                aria-label="Filter by route"
                data-testid="route-filter"
              >
                <option value="">All routes</option>
                {routeNames.map((name) => (
                  <option key={name} value={routeSlug(name)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-row">
              <select
                className="filter-select"
                value={filters.trainState}
                onChange={(e) => patch({ trainState: e.target.value as AppFilters['trainState'] })}
                aria-label="Filter by train status"
              >
                <option value="all">Any status</option>
                <option value="active">Active</option>
                <option value="predeparture">Predeparture</option>
              </select>
            </div>
            <div className="filter-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.onlyWithPosition}
                  onChange={(e) => patch({ onlyWithPosition: e.target.checked })}
                />
                Live positions only
              </label>
            </div>
            <div className="toolbar-actions">
              {hasActiveFilters && (
                <button className="btn" onClick={() => onFiltersChange({ ...filters, routeSlug: '', trainState: 'all', onlyWithPosition: false })}>
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Network summary</div>
            <div className="summary-grid">
              <div className="summary-cell">
                <div className="summary-value" data-testid="summary-active">{summary.activeTrains}</div>
                <div className="summary-label">Active trains</div>
              </div>
              <div className="summary-cell">
                <div className="summary-value" data-testid="summary-positions">{summary.withPosition}</div>
                <div className="summary-label">With position</div>
              </div>
              <div className="summary-cell">
                <div className="summary-value" data-testid="summary-stations">{summary.stations}</div>
                <div className="summary-label">Stations</div>
              </div>
            </div>
            {summary.staleTrains > 0 && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--warn)' }}>
                ⚠ {summary.staleTrains} train{summary.staleTrains === 1 ? '' : 's'} with stale position data
              </div>
            )}
            {status.staleInfo && (
              <div className="freshness-line" data-testid="freshness-line">
                {/* The dot states what the data is, so demo data never gets the
                    live colour even when the timestamps look recent. */}
                <span
                  className={`status-dot ${
                    status.dataKind === 'demo'
                      ? 'demo'
                      : status.staleInfo.stale
                        ? 'stale'
                        : 'live'
                  }`}
                  aria-hidden="true"
                />
                {status.dataKind === 'demo'
                  ? 'Snapshot positions averaged '
                  : 'Positions reported on average '}
                <strong>{formatAge(status.staleInfo.averageLastUpdateMs)}</strong>
                {status.staleInfo.stale && ' · upstream flags the feed as stale'}
              </div>
            )}
            <div className="freshness-line" data-testid="source-line">
              Source: {status.sourceLabel || 'unknown'}
            </div>
            {query.trim() === '' && (
              <div className="panel-title" style={{ marginTop: 10 }}>Rail services</div>
            )}
          </div>

          {searchResults ? (
            <SearchResultsPane
              results={searchResults}
              onSelectTrain={onSelectTrain}
              onSelectStation={onSelectStation}
            />
          ) : (
            <div className="train-list" data-testid="train-list">
              {filteredTrains.map((t) => (
                <TrainListItem
                  key={t.id}
                  train={t}
                  selected={selection?.type === 'train' && selection.trainId === t.id}
                  onSelect={onSelectTrain}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}