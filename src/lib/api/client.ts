/**
 * Typed fetch wrapper for the Nivaran API.
 *
 * This module is intentionally minimal: it owns base URL resolution, JSON
 * (de)serialization, credential handling, query-string assembly, and error
 * normalization. It does not own caching, retries, or auth refresh — those
 * concerns live in the React Query layer that calls into this client.
 */

/**
 * Resolve the API base URL from Vite environment variables, falling back to
 * the same-origin `/api` prefix that the dev proxy forwards to the server.
 */
const BASE_URL: string =
  // `import.meta.env` is typed loosely so this file does not require a
  // `vite/client` triple-slash reference in the project tsconfig.
  ((import.meta as unknown as { env?: Record<string, string | undefined> })
    .env?.VITE_API_BASE_URL ?? '/api');

/** Methods that may carry a JSON body. */
type BodyMethod = 'POST' | 'PATCH' | 'PUT';

/** Methods that never carry a body. */
type NoBodyMethod = 'GET' | 'DELETE';

/** Allowed scalar values for a single query-string key. */
export type QueryValue = string | number | boolean | undefined | null;

/** A flat record of query-string parameters. Arrays are not supported here. */
export type Query = Record<string, QueryValue>;

/** Options accepted by every {@link apiClient} method. */
export interface RequestOptions {
  /** Optional query parameters appended to the URL. */
  query?: Query;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
  /** Extra headers merged on top of the defaults. */
  headers?: Record<string, string>;
}

/**
 * Error thrown by every {@link apiClient} method on a non-2xx response or a
 * network failure. The shape mirrors the server's error envelope:
 * `{ code: string; details?: unknown }`.
 */
export class ApiError extends Error {
  /** HTTP status code, or `0` for network-level failures. */
  public readonly status: number;
  /** Stable machine-readable error code, when the server provides one. */
  public readonly code?: string;
  /** Additional structured information returned by the server. */
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Build a fully-qualified request URL by joining `path` to the configured
 * base URL and appending non-empty query parameters. Values that are
 * `undefined` or `null` are omitted; everything else is coerced to a string.
 *
 * Exported for unit-test reuse and for adapters that need to mirror the
 * URL shape.
 */
export function buildUrl(path: string, query?: Query): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${suffix}`;

  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Parse a `fetch` response into either a JSON object (when the response
 * advertises `application/json`) or its raw text body.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    // An empty 204 with a JSON content-type is rare but possible; guard it.
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return response.text();
}

/**
 * Convert a non-2xx response into an {@link ApiError}, pulling `code` and
 * `details` from a JSON envelope when one is present.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const body = await parseResponseBody(response).catch(() => undefined);

  let code: string | undefined;
  let details: unknown;
  let message = `HTTP ${response.status} ${response.statusText}`.trim();

  if (body && typeof body === 'object') {
    const envelope = body as { code?: unknown; message?: unknown; [k: string]: unknown };
    if (typeof envelope.code === 'string') code = envelope.code;
    if (typeof envelope.message === 'string' && envelope.message.length > 0) {
      message = envelope.message;
    }
    details = body;
  } else if (typeof body === 'string' && body.length > 0) {
    details = body;
  }

  return new ApiError(message, response.status, code, details);
}

/**
 * Core request runner. Handles serialization, credentials, and error
 * normalization for both body-bearing and bodyless requests.
 */
async function request<T>(
  method: BodyMethod | NoBodyMethod,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, options.query);

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isBodyMethod = method === 'POST' || method === 'PATCH' || method === 'PUT';
  if (isBodyMethod && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
    signal: options.signal,
  };

  if (isBodyMethod && body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    // `fetch` throws on DNS failure, offline, CORS preflight failure, and
    // explicit aborts. Preserve `AbortError` as-is so callers can detect
    // cancellation; everything else becomes a network-level ApiError.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(message, 0, 'network_error', err);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204 No Content and similar bodyless successes resolve to `undefined`.
  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = await parseResponseBody(response);
  return parsed as T;
}

/**
 * Typed API client. Every method is generic over the response type and
 * returns `Promise<T>`. Errors from the server or network are normalized
 * into {@link ApiError}.
 */
export const apiClient = {
  /** GET `path` with optional query and abort signal. */
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },

  /** POST `body` as JSON to `path`. */
  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options);
  },

  /** PATCH `body` as JSON to `path`. */
  patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, options);
  },

  /** PUT `body` as JSON to `path`. */
  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options);
  },

  /** DELETE `path`. Named `del` to avoid shadowing the JS `delete` keyword. */
  del<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
};

/** Public type of the client object, useful for dependency injection. */
export type ApiClient = typeof apiClient;
