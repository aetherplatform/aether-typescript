import {AetherError, type Fetch, type RetryMetadata} from "@aetherplatform/core";

export interface IdentityRequestOptions {
  requestId?: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface IdentityRetryEvent {
  operation: string;
  attempt: number;
  maximumAttempts: number;
  delayMs: number;
  status: number;
  code: string;
  requestId?: string;
}

export interface IdentityTransportConfig {
  baseUrl: string;
  fetch?: Fetch;
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  onRetry?: (event: IdentityRetryEvent) => void;
}

interface ProtocolRequest {
  operation: string;
  method: "GET" | "POST";
  path: string;
  successStatuses: readonly number[];
  retrySafe: boolean;
  headers?: HeadersInit;
  body?: URLSearchParams | string;
  contentType?: string;
  redact?: readonly string[];
  omitErrorDetails?: boolean;
}

export class IdentityTransport {
  readonly #baseUrl: URL;
  readonly #fetch: Fetch;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #userAgent: string;
  readonly #onRetry: ((event: IdentityRetryEvent) => void) | undefined;

  constructor(config: IdentityTransportConfig) {
    this.#baseUrl = parseBaseUrl(config.baseUrl);
    this.#fetch = config.fetch ?? globalThis.fetch;
    this.#timeoutMs = config.timeoutMs ?? 15_000;
    this.#maxRetries = config.maxRetries ?? 2;
    this.#userAgent = config.userAgent ?? "aether-typescript-sdk/0.1.0-beta.1.1";
    this.#onRetry = config.onRetry;

    if (!this.#fetch) throw new TypeError("A fetch implementation is required");
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new TypeError("timeoutMs must be a positive safe integer");
    }
    if (!Number.isSafeInteger(this.#maxRetries) || this.#maxRetries < 0) {
      throw new TypeError("maxRetries must be a non-negative safe integer");
    }
  }

  resolve(path: string): URL {
    return new URL(path, this.#baseUrl);
  }

  async request<ResponseBody>(request: ProtocolRequest, options: IdentityRequestOptions = {}): Promise<ResponseBody> {
    const requestId = options.requestId ?? crypto.randomUUID();

    for (let attempt = 1; ; attempt += 1) {
      if (options.signal?.aborted) {
        throw new AetherError({status: 0, code: "request_aborted", message: "Identity request was aborted"});
      }

      try {
        const {response, payload} = await this.#send(request, options, requestId);
        if (request.successStatuses.includes(response.status)) return payload as ResponseBody;
        throw errorFromResponse(response, payload, request.redact, request.omitErrorDetails);
      } catch (error) {
        if (error instanceof AetherError) {
          if (!request.retrySafe || attempt > this.#maxRetries || !retryable(error)) throw error;
          await this.#backoff(request.operation, attempt, error, options.signal);
          continue;
        }
        if (options.signal?.aborted) {
          throw new AetherError({status: 0, code: "request_aborted", message: "Identity request was aborted"});
        }
        throw error;
      }
    }
  }

  async #send(
    request: ProtocolRequest,
    options: IdentityRequestOptions,
    requestId: string,
  ): Promise<{response: Response; payload: unknown}> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, {once: true});

    try {
      const headers = new Headers(request.headers);
      headers.set("accept", "application/json");
      headers.set("user-agent", this.#userAgent);
      headers.set("x-request-id", requestId);
      if (options.correlationId) headers.set("x-correlation-id", options.correlationId);
      if (request.body) headers.set("content-type", request.contentType ?? "application/x-www-form-urlencoded");

      let response: Response;
      try {
        response = await this.#fetch(this.resolve(request.path), {
          method: request.method,
          headers,
          ...(request.body ? {body: request.body} : {}),
          signal: controller.signal,
          redirect: "error",
          credentials: "omit",
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        const code = aborted ? (options.signal?.aborted ? "request_aborted" : "request_timeout") : "network_error";
        const message = code === "request_aborted"
          ? "Identity request was aborted"
          : code === "request_timeout"
            ? "Identity request timed out"
            : "Identity request failed";
        throw new AetherError({status: 0, code, message});
      }
      return {response, payload: await readJson(response, request.successStatuses.includes(response.status))};
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  async #backoff(operation: string, attempt: number, error: AetherError, signal?: AbortSignal): Promise<void> {
    const delayMs = error.retry.retryAfterSeconds === undefined
      ? Math.min(100 * 2 ** (attempt - 1), 1_000)
      : Math.max(0, error.retry.retryAfterSeconds * 1_000);
    this.#onRetry?.({
      operation,
      attempt,
      maximumAttempts: this.#maxRetries + 1,
      delayMs,
      status: error.status,
      code: error.code,
      ...(error.requestId ? {requestId: error.requestId} : {}),
    });
    await delay(delayMs, signal);
  }
}

function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be an absolute HTTP URL");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new TypeError("baseUrl must be an absolute HTTP URL");
  }
  return new URL(`${url.origin}${url.pathname.replace(/\/$/, "")}/`);
}

function retryable(error: AetherError): boolean {
  if (error.status === 0) return new Set(["network_error", "request_timeout"]).has(error.code);
  if (new Set([502, 503, 504]).has(error.status)) return true;
  return error.status === 429 && error.code === "rate_limited";
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const complete = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(new AetherError({status: 0, code: "request_aborted", message: "Identity request was aborted"}));
    };
    const timeout = setTimeout(complete, milliseconds);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, {once: true});
  });
}

async function readJson(response: Response, success: boolean): Promise<unknown> {
  if (response.status === 204) return undefined;
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new AetherError({status: response.status, code: "invalid_response", message: "Identity response could not be read"});
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    if (!success) return undefined;
    throw new AetherError({
      status: response.status,
      code: "invalid_response",
      message: "Identity returned an invalid JSON response",
    });
  }
}

function errorFromResponse(
  response: Response,
  payload: unknown,
  redactions: readonly string[] = [],
  omitDetails = false,
): AetherError {
  const envelope = isRecord(payload) ? payload.error : undefined;
  const rawCode = isRecord(envelope) && typeof envelope.code === "string"
    ? envelope.code
    : typeof envelope === "string"
      ? envelope
      : "request_failed";
  const rawMessage = isRecord(envelope) && typeof envelope.message === "string"
    ? envelope.message
    : `Identity request failed with HTTP ${response.status}`;
  const code = omitDetails && !safeAuthErrorCodes.has(rawCode.toLowerCase()) ? "request_failed" : rawCode;
  const message = omitDetails ? `Identity request failed with HTTP ${response.status}` : redactions.reduce(
    (value, secret) => secret ? value.replaceAll(secret, "[REDACTED]") : value,
    rawMessage,
  );
  const envelopeRequestId = isRecord(envelope) && typeof envelope.request_id === "string"
    ? envelope.request_id
    : undefined;
  const requestId = response.headers.get("x-request-id") ?? envelopeRequestId;
  const details = isRecord(envelope) ? envelope.details : undefined;

  return new AetherError({
    status: response.status,
    code,
    message,
    ...(!omitDetails && requestId ? {requestId} : {}),
    ...(!omitDetails && details !== undefined ? {details} : {}),
    retry: retryMetadata(response, !omitDetails),
  });
}

function retryMetadata(response: Response, includeText = true): RetryMetadata {
  return {
    ...integerHeader(response, "retry-after", "retryAfterSeconds"),
    ...integerHeader(response, "ratelimit-limit", "rateLimitLimit"),
    ...integerHeader(response, "ratelimit-remaining", "rateLimitRemaining"),
    ...integerHeader(response, "ratelimit-reset", "rateLimitReset"),
    ...(includeText && response.headers.get("quota-reset") ? {quotaReset: response.headers.get("quota-reset")!} : {}),
  };
}

function integerHeader(response: Response, header: string, property: keyof RetryMetadata): Partial<RetryMetadata> {
  const raw = response.headers.get(header);
  if (raw === null) return {};
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? {[property]: value} : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const safeAuthErrorCodes = new Set([
  "invalid_request", "invalid_passwordless_request", "invalid_client", "invalid_grant",
  "invalid_scope", "unauthorized_client", "unsupported_grant_type", "access_denied",
  "invalid_target", "token_issuance_unavailable", "invalid_code", "code_already_used",
  "code_expired", "invalid_redirect_uri", "invalid_code_verifier", "invalid_token",
  "origin_not_allowed", "custom_completion_not_allowed", "rate_limited",
  "temporarily_unavailable", "identity_role_unavailable", "revocation_backend_unavailable",
]);
