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
  body?: URLSearchParams;
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
    this.#userAgent = config.userAgent ?? "aether-typescript-sdk/0.1.0-beta.1";
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

        if (request.successStatuses.includes(response.status)) {
          return payload as ResponseBody;
        }

        const error = errorFromResponse(response, payload, request.redact, request.omitErrorDetails);
        if (!request.retrySafe || attempt > this.#maxRetries || !retryable(error)) throw error;
        await this.#backoff(request.operation, attempt, error, options.signal);
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
      if (request.body) headers.set("content-type", "application/x-www-form-urlencoded");

      try {
        const response = await this.#fetch(this.resolve(request.path), {
          method: request.method,
          headers,
          ...(request.body ? {body: request.body} : {}),
          signal: controller.signal,
        });
        return {response, payload: await readJson(response)};
      } catch (error) {
        if (error instanceof AetherError) throw error;
        const aborted = error instanceof Error && error.name === "AbortError";
        const code = aborted ? (options.signal?.aborted ? "request_aborted" : "request_timeout") : "network_error";
        const message = code === "request_aborted"
          ? "Identity request was aborted"
          : code === "request_timeout"
            ? "Identity request timed out"
            : "Identity request failed";
        throw new AetherError({status: 0, code, message});
      }
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

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
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
  const code = isRecord(envelope) && typeof envelope.code === "string"
    ? envelope.code
    : typeof envelope === "string"
      ? envelope
      : "request_failed";
  const rawMessage = isRecord(envelope) && typeof envelope.message === "string"
    ? envelope.message
    : `Identity request failed with HTTP ${response.status}`;
  const message = redactions.reduce(
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
    ...(requestId ? {requestId} : {}),
    ...(!omitDetails && details !== undefined ? {details} : {}),
    retry: retryMetadata(response),
  });
}

function retryMetadata(response: Response): RetryMetadata {
  return {
    ...integerHeader(response, "retry-after", "retryAfterSeconds"),
    ...integerHeader(response, "ratelimit-limit", "rateLimitLimit"),
    ...integerHeader(response, "ratelimit-remaining", "rateLimitRemaining"),
    ...integerHeader(response, "ratelimit-reset", "rateLimitReset"),
    ...(response.headers.get("quota-reset") ? {quotaReset: response.headers.get("quota-reset")!} : {}),
  };
}

function integerHeader(response: Response, header: string, property: keyof RetryMetadata): Partial<RetryMetadata> {
  const raw = response.headers.get(header);
  if (raw === null) return {};
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? {[property]: value} : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
