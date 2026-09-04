export type Fetch = typeof fetch;

export interface AccessToken {
  accessToken: string;
  expiresAt: number;
  scope?: string;
}

export interface TokenProvider {
  getToken(): Promise<AccessToken>;
  invalidate?(): void;
}

export type IdempotencyPolicy = "required" | "optional" | "request_field" | "unsupported" | "not_applicable";

export interface OperationDefinition {
  method: string;
  path: string;
  tokenProfiles: readonly string[];
  requiredCapability: string | null;
  availability: readonly string[];
  idempotency: IdempotencyPolicy;
  successStatuses: readonly number[];
}

export interface AetherClientConfig {
  baseUrl: string;
  tokenProvider: TokenProvider;
  fetch?: Fetch;
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
}

export interface RequestOptions<Body = unknown> {
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Body;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  correlationId?: string;
  requestId?: string;
  signal?: AbortSignal;
}

export interface RetryMetadata {
  retryAfterSeconds?: number;
  rateLimitLimit?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  quotaReset?: string;
}

export class AetherError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: unknown;
  readonly retry: RetryMetadata;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    retry?: RetryMetadata;
  }) {
    super(input.message);
    this.name = "AetherError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.details = input.details;
    this.retry = input.retry ?? {};
  }
}

export interface CursorPage<Item> {
  items: readonly Item[];
  nextCursor?: string | null;
}

export interface CursorPaginationOptions {
  initialCursor?: string;
  maxPages?: number;
  signal?: AbortSignal;
}

export class CursorPaginationError extends Error {
  readonly code: "invalid_max_pages" | "repeated_cursor" | "max_pages_exceeded";

  constructor(code: CursorPaginationError["code"], message: string) {
    super(message);
    this.name = "CursorPaginationError";
    this.code = code;
  }
}

export async function* paginateCursor<Item>(
  fetchPage: (cursor: string | undefined, signal: AbortSignal | undefined) => Promise<CursorPage<Item>>,
  options: CursorPaginationOptions = {},
): AsyncGenerator<Item, void, undefined> {
  const maxPages = options.maxPages ?? 1_000;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new CursorPaginationError("invalid_max_pages", "maxPages must be a positive safe integer");
  }

  let cursor = options.initialCursor;
  const seenCursors = new Set<string>();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    options.signal?.throwIfAborted();
    const page = await fetchPage(cursor, options.signal);
    options.signal?.throwIfAborted();

    for (const item of page.items) yield item;

    const nextCursor = page.nextCursor;
    if (!nextCursor) return;
    if (nextCursor === cursor || seenCursors.has(nextCursor)) {
      throw new CursorPaginationError("repeated_cursor", "The server returned a repeated pagination cursor");
    }

    if (pageNumber === maxPages) {
      throw new CursorPaginationError("max_pages_exceeded", `Pagination exceeded the configured ${maxPages} page limit`);
    }

    if (cursor) seenCursors.add(cursor);
    cursor = nextCursor;
  }
}

type OperationResponse<Value> = Value extends {response: infer Response} ? Response : unknown;
type OperationBody<Value> = Value extends {request: infer Body} ? Body : unknown;

export class OperationClient<Operations> {
  readonly #config: Required<Pick<AetherClientConfig, "timeoutMs" | "maxRetries" | "userAgent">> & AetherClientConfig;
  readonly #fetch: Fetch;
  readonly #operations: Record<keyof Operations & string, OperationDefinition>;

  constructor(config: AetherClientConfig, operations: Record<keyof Operations & string, OperationDefinition>) {
    this.#config = {timeoutMs: 15_000, maxRetries: 2, userAgent: "aether-typescript-sdk/0.1.0-beta.1", ...config};
    this.#fetch = config.fetch ?? globalThis.fetch;
    this.#operations = operations;
    if (!this.#fetch) throw new TypeError("A fetch implementation is required");
    if (!Number.isSafeInteger(this.#config.timeoutMs) || this.#config.timeoutMs <= 0) {
      throw new TypeError("timeoutMs must be a positive safe integer");
    }
    if (!Number.isSafeInteger(this.#config.maxRetries) || this.#config.maxRetries < 0) {
      throw new TypeError("maxRetries must be a non-negative safe integer");
    }
  }

  async request<Name extends keyof Operations & string>(
    operationName: Name,
    options: RequestOptions<OperationBody<Operations[Name]>> = {},
  ): Promise<OperationResponse<Operations[Name]>> {
    const operation = this.#operations[operationName];
    if (!operation) throw new TypeError(`Unknown operation: ${operationName}`);
    const canRetry = retrySafe(operation, options);
    let attempt = 0;

    while (true) {
      const token = await this.#config.tokenProvider.getToken();
      let response: Response;
      try {
        response = await this.#send(operation, options, token.accessToken);
      } catch (error) {
        if (!(error instanceof AetherError) || !canRetry || attempt >= this.#config.maxRetries || !retryable(error)) throw error;
        attempt += 1;
        await delay(retryDelayMilliseconds(error, attempt), options.signal);
        continue;
      }
      if (operation.successStatuses.includes(response.status)) {
        return (await readJson(response)) as OperationResponse<Operations[Name]>;
      }

      const payload = await readJson(response);
      const error = errorFromResponse(response, payload);
      const canRefreshAuthorization = response.status === 401
        && attempt === 0
        && typeof this.#config.tokenProvider.invalidate === "function";
      if (canRefreshAuthorization) this.#config.tokenProvider.invalidate!();
      const canRetryResponse = response.status === 401 ? canRefreshAuthorization : retryable(error);
      if (!canRetry || attempt >= this.#config.maxRetries || !canRetryResponse) throw error;
      attempt += 1;
      await delay(retryDelayMilliseconds(error, attempt), options.signal);
    }
  }

  async #send(operation: OperationDefinition, options: RequestOptions, token: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs);
    const abort = () => controller.abort();
    if (options.signal?.aborted) {
      clearTimeout(timeout);
      throw new AetherError({status: 0, code: "request_aborted", message: "Aether request was aborted"});
    }
    options.signal?.addEventListener("abort", abort, {once: true});

    try {
      const headers = new Headers(options.headers);
      headers.set("accept", "application/json");
      headers.set("authorization", `Bearer ${token}`);
      headers.set("user-agent", this.#config.userAgent);
      headers.set("x-request-id", options.requestId ?? crypto.randomUUID());
      if (options.correlationId) headers.set("x-correlation-id", options.correlationId);
      if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
      if (options.body !== undefined) headers.set("content-type", "application/json");

      try {
        return await this.#fetch(buildUrl(this.#config.baseUrl, operation.path, options.path, options.query), {
          method: operation.method,
          headers,
          ...(options.body === undefined ? {} : {body: JSON.stringify(options.body)}),
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        const code = aborted ? (options.signal?.aborted ? "request_aborted" : "request_timeout") : "network_error";
        const message = code === "request_aborted"
          ? "Aether request was aborted"
          : code === "request_timeout"
            ? "Aether request timed out"
            : "Aether request failed";
        throw new AetherError({status: 0, code, message});
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

function buildUrl(
  baseUrl: string,
  pathTemplate: string,
  pathValues: Record<string, string | number> = {},
  query: Record<string, string | number | boolean | undefined> = {},
): string {
  const path = pathTemplate.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = pathValues[name];
    if (value === undefined) throw new TypeError(`Missing path parameter: ${name}`);
    return encodeURIComponent(String(value));
  });
  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.toString();
}

function retrySafe(operation: OperationDefinition, options: RequestOptions): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(operation.method)) return true;
  if (operation.idempotency === "required" || operation.idempotency === "optional") {
    return Boolean(options.idempotencyKey);
  }
  if (operation.idempotency === "request_field") {
    return typeof options.body === "object" && options.body !== null && "idempotency_key" in options.body;
  }
  return false;
}

function retryable(error: AetherError): boolean {
  if (error.status === 0) return ["network_error", "request_timeout"].includes(error.code);
  if ([502, 503, 504].includes(error.status)) return true;
  return error.status === 429 && error.code === "rate_limited";
}

function retryDelayMilliseconds(error: AetherError, attempt: number): number {
  if (error.retry.retryAfterSeconds !== undefined) return error.retry.retryAfterSeconds * 1000;
  return Math.min(100 * 2 ** (attempt - 1), 1_000);
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
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timeout = setTimeout(complete, milliseconds);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, {once: true});
  });
}

async function readJson(response: Response): Promise<any> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function errorFromResponse(response: Response, payload: any, secret?: string): AetherError {
  const envelope = payload?.error;
  const code = typeof envelope === "object" && typeof envelope?.code === "string"
    ? envelope.code
    : typeof envelope === "string"
      ? envelope
      : "request_failed";
  const rawMessage = typeof envelope === "object" && typeof envelope?.message === "string"
    ? envelope.message
    : `Aether request failed with HTTP ${response.status}`;
  const message = secret ? rawMessage.replaceAll(secret, "[REDACTED]") : rawMessage;
  const requestId = response.headers.get("x-request-id") ?? (typeof envelope?.request_id === "string" ? envelope.request_id : undefined);
  return new AetherError({
    status: response.status,
    code,
    message,
    ...(requestId ? {requestId} : {}),
    ...(secret || envelope?.details === undefined ? {} : {details: envelope.details}),
    retry: {
      ...integerHeader(response, "retry-after", "retryAfterSeconds"),
      ...integerHeader(response, "ratelimit-limit", "rateLimitLimit"),
      ...integerHeader(response, "ratelimit-remaining", "rateLimitRemaining"),
      ...integerHeader(response, "ratelimit-reset", "rateLimitReset"),
      ...(response.headers.get("quota-reset") ? {quotaReset: response.headers.get("quota-reset")!} : {}),
    },
  });
}

function integerHeader(response: Response, header: string, property: keyof RetryMetadata): Partial<RetryMetadata> {
  const raw = response.headers.get(header);
  if (raw === null) return {};
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? {[property]: value} : {};
}
