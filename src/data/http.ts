/**
 * Minimal HTTP helpers for Amtraker requests.
 *
 * Amtraker is a public, keyless API (see DATA_SOURCES.md for license terms).
 * When embedded in a page it honors CORS (`access-control-allow-origin: *`),
 * so requests can be made directly from the browser. The API asks clients to
 * identify themselves with a User-Agent header; browsers cannot set that
 * header cross-origin, so we document the limitation instead.
 */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface HttpFetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const DEFAULT_TIMEOUT_MS = 20000;

/**
 * fetch wrapper with a deadline. Rejects with an Error when the deadline
 * elapses or the request is aborted.
 */
export async function fetchWithTimeout(
  url: string,
  options: HttpFetchOptions = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** Fetch JSON, throwing HttpError on non-2xx and on malformed payloads. */
export async function fetchJson<T>(
  url: string,
  options: HttpFetchOptions = {},
  timeoutMs?: number,
): Promise<T> {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  if (!res.ok) {
    throw new HttpError(res.status, `Request failed with status ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Malformed JSON from ${url}`);
  }
}