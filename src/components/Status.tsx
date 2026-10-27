import type { ReactNode } from 'react';
import type { DataKind } from '../types/domain';

export type StatusTone = 'live' | 'scheduled' | 'demo' | 'stale' | 'unknown' | 'error';

export function dataKindTone(kind: DataKind): StatusTone {
  switch (kind) {
    case 'live':
      return 'live';
    case 'scheduled':
      return 'scheduled';
    case 'estimate':
      return 'scheduled';
    case 'demo':
      return 'demo';
    default:
      return 'unknown';
  }
}

export interface StatusDotProps {
  tone: StatusTone;
  label: string;
  /** Render just the dot (for inline use). */
  dotOnly?: boolean;
}

export function StatusDot({ tone, label, dotOnly = false }: StatusDotProps) {
  const dot = <span className={`status-dot ${tone}`} aria-hidden="true" />;
  if (dotOnly) return dot;
  return (
    <span className="status-indicator">
      {dot}
      <span>{label}</span>
    </span>
  );
}

export function DataKindLabel({ kind }: { kind: DataKind }) {
  return <StatusDot tone={dataKindTone(kind)} label={kind} />;
}

/** Small monospace time with an em-dash for missing values. */
export function TimeValue({ iso, plain }: { iso?: string; plain?: string }) {
  if (!iso) return <>{plain ?? '—'}</>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <>{plain ?? '—'}</>;
  return (
    <time dateTime={iso}>
      {d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
    </time>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="detail-section-title">{children}</div>;
}