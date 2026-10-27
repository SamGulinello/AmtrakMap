/**
 * Time formatting helpers.
 *
 * Every timestamp from the data source carries the *station-local* UTC offset
 * (e.g. `2026-10-26T09:00:00-05:00`). Those times must be displayed as the
 * wall clock the railroad published, not converted into the viewer's timezone.
 * We therefore strip the offset and format the literal components in UTC.
 */
const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});
const dayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const LOCAL_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Parse an ISO timestamp's wall-clock components, ignoring its UTC offset. */
function wallClock(iso: string): Date | undefined {
  const m = LOCAL_ISO.exec(iso);
  if (!m) return undefined;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Station-local time as published, e.g. "9:00 AM". */
export function formatTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = wallClock(iso);
  if (!d) return '—';
  return timeFmt.format(d);
}

/** Station-local date and time, e.g. "Oct 26, 9:00 AM". */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = wallClock(iso);
  if (!d) return '—';
  return dateTimeFmt.format(d);
}

/** Station-local calendar day, e.g. "Oct 26". */
export function formatDay(iso: string | undefined): string {
  if (!iso) return '—';
  const d = wallClock(iso);
  if (!d) return '—';
  return dayFmt.format(d);
}

/**
 * Compare two timestamps for the same instant. Offsets differ per station, so
 * wall-clock comparison is wrong; this uses the true epoch.
 */
export function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return Date.parse(a) === Date.parse(b);
}

/** Compact relative time, e.g. "2m ago". */
export function formatRelative(epochMs: number, now: number = Date.now()): string {
  const diff = now - epochMs;
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Wall-clock time for a given Date, e.g. "3:12 PM". */
export function formatClock(time: string | Date): string {
  const d = typeof time === 'string' ? new Date(time) : time;
  if (Number.isNaN(d.getTime())) return '—';
  return timeFmt.format(d);
}

export function formatNumber(n: number | undefined, digits = 0): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
