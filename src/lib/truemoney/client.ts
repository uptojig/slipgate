/**
 * Shared client utilities for `apis.truemoneyservices.com` service APIs.
 *
 * All TrueMoney service endpoints share the same response envelope:
 *
 *   success:  { "status": "ok",  "data": { ...payload... } }
 *   error:    { "status": "err", "err":  "human message" }
 *
 * Plus shared HTTP status codes:
 *   401 — token invalid          (unauthorized)
 *   403 — token rejected         (forbidden)
 *   404 — transaction not found
 *   429 — rate limited (30 req / 30 sec)
 *   500 — server error
 *
 * Each menu in the TrueMoney app issues its OWN bearer token, so we
 * accept the token as an argument rather than reading a single env.
 */

export type TmnEnvelope<T> =
  | { status: "ok"; data: T }
  | { status: "err"; err: string };

export type TmnCallResult<T> =
  | { ok: true; data: T; raw: TmnEnvelope<T> }
  | { ok: false; code: TmnErrorCode; message: string; status?: number; raw?: unknown };

export type TmnErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE"
  | "ERR_STATUS";

const httpCodeMap: Record<number, TmnErrorCode> = {
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "RATE_LIMITED",
  500: "SERVER_ERROR",
};

export async function tmnCall<T>(opts: {
  method: "GET" | "POST";
  url: string;
  token: string | undefined;
  body?: unknown;
  timeoutMs?: number;
}): Promise<TmnCallResult<T>> {
  if (!opts.token) {
    return { ok: false, code: "NOT_CONFIGURED", message: "Bearer token is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  let res: Response;
  try {
    res = await fetch(opts.url, {
      method: opts.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${opts.token}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, code: "NETWORK_ERROR", message: (e as Error).message };
  }
  clearTimeout(timer);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    const fallback = httpCodeMap[res.status] ?? "BAD_RESPONSE";
    return { ok: false, code: fallback, status: res.status, message: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const obj = json as { err?: string; message?: string };
    return {
      ok: false,
      code: httpCodeMap[res.status] ?? "BAD_RESPONSE",
      status: res.status,
      message: obj.err ?? obj.message ?? `HTTP ${res.status}`,
      raw: json,
    };
  }

  const env = json as TmnEnvelope<T>;
  if (env.status === "ok") {
    return { ok: true, data: env.data, raw: env };
  }

  return {
    ok: false,
    code: "ERR_STATUS",
    message: env.err ?? "Unknown error",
    raw: env,
  };
}
