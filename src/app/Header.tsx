import type { DataSourceStatus } from '../types/domain';
import { formatClock, formatRelative } from '../utils/time';

function SourceBadge({ status }: { status: DataSourceStatus }) {
  let cls = 'source-badge';
  if (!status.ok) cls += ' error';
  else if (status.dataKind === 'demo') cls += ' demo';
  else if (status.dataKind === 'live') cls += ' live';
  return (
    <span className={cls} title={status.error ?? status.sourceLabel}>
      <span className="dot" aria-hidden="true" />
      <span>
        {status.dataKind === 'demo' ? 'DEMO SNAPSHOT' : status.dataKind === 'live' ? 'LIVE' : 'UNKNOWN'}
      </span>
    </span>
  );
}

export function Header({
  status,
  onRefresh,
  onToggleSidebar,
  sidebarOpen,
}: {
  status: DataSourceStatus;
  onRefresh: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen: boolean;
}) {
  const lastUpdateEpoch = status.lastUpdated ? Date.parse(status.lastUpdated) : NaN;
  const canRefresh = !status.refreshing;

  return (
    <header className="app-header">
      {onToggleSidebar && (
        <button
          className="btn btn-ghost network-toggle-hamburger"
          aria-label="Toggle filters panel"
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
          data-testid="sidebar-toggle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      )}
      <div className="brand">
        <span className="brand-name">Amtrak Live Explorer</span>
        <span className="brand-sub">Amtrak passenger rail network</span>
      </div>
      <SourceBadge status={status} />
      <div className="header-right">
        <div className="status-strip" data-testid="status-strip">
          {status.refreshing && <span className="spinner" aria-label="Refreshing" />}
          {status.error && (
            <span className="status-dot error" aria-hidden="true" data-testid="error-indicator" />
          )}
          <span className="time">
            {!status.lastUpdated
              ? '—'
              : status.ok
                ? `Updated ${formatRelative(Number.isNaN(lastUpdateEpoch) ? 0 : lastUpdateEpoch)}`
                : `Last good ${formatClock(status.lastUpdated)}`}
          </span>
        </div>
        <button className="btn" onClick={onRefresh} disabled={!canRefresh} data-testid="refresh-button">
          {status.refreshing ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
          )}
          Refresh
        </button>
      </div>
    </header>
  );
}