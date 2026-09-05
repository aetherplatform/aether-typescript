import {
  AetherError,
  type AccessToken,
  type Fetch,
  type RetryEvent,
  type RetryMetadata,
  type TokenProvider,
} from "./index.js";

export interface ClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: readonly string[];
  fetch?: Fetch;
  timeoutMs?: number;
  maxRetries?: number;
  clockSkewSeconds?: number;
  onRetry?: (event: RetryEvent) => void;
}

export class ClientCredentialsTokenProvider implements TokenProvider {
  readonly #config: Required<Pick<ClientCredentialsConfig, "timeoutMs" | "maxRetries" | "clockSkewSeconds">> & ClientCredentialsConfig;
  readonly #fetch: Fetch;
  #cached: AccessToken | undefined;
  #pending: Promise<AccessToken> | undefined;

  constructor(config: ClientCredentialsConfig) {
    this.#config = {timeoutMs: 10_000, maxRetries: 1, clockSkewSeconds: 30, ...config};
    this.#fetch = config.fetch ?? globalThis.fetch;
    if (!this.#fetch) throw new TypeError("A fetch implementation is required");
    if (!Number.isSafeInteger(this.#config.timeoutMs) || this.#config.timeoutMs <= 0) {
      throw new TypeError("timeoutMs must be a positive safe integer");
    }
    if (!Number.isSafeInteger(this.#config.maxRetries) || this.#config.maxRetries < 0) {
      throw new TypeError("maxRetries must be a non-negative safe integer");
    }
    if (!Number.isFinite(this.#config.clockSkewSeconds) || this.#config.clockSkewSeconds < 0) {
      throw new TypeError("clockSkewSeconds must be a non-negative finite number");
    }
    if (!config.tokenUrl.trim() || !config.clientId.trim() || !config.clientSecret || !config.audience.trim()) {
      throw new TypeError("tokenUrl, clientId, clientSecret, and audience are required");
    }
    try {
      const tokenUrl = new URL(config.tokenUrl);
      if (!new Set(["http:", "https:"]).has(tokenUrl.protocol)) throw new Error("invalid protocol");
    } catch {
      throw new TypeError("tokenUrl must be an absolute HTTP URL");
    }
  }

  async getToken(): Promise<AccessToken> {
    if (this.#cached && this.#cached.expiresAt - this.#config.clockSkewSeconds * 1000 > Date.now()) {
      return this.#cached;
    }
    if (this.#pending) return this.#pending;

    this.#pending = this.#issue().finally(() => {
      this.#pending = undefined;
    });
    return this.#pending;
  }

  invalidate(): void {
    this.#cached = undefined;
  }

  async #issue(): Promise<AccessToken> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.#issueOnce();
      } catch (error) {
        if (!(error instanceof AetherError) || attempt > this.#config.maxRetries || !retryable(error)) throw error;
        const delayMs = retryDelayMilliseconds(error, attempt);
        this.#config.onRetry?.({
          operation: "clientCredentialsToken",
          attempt,
          maximumAttempts: this.#config.maxRetries + 1,
          delayMs,
          status: error.status,
          code: error.code,
          ...(error.requestId ? {requestId: error.requestId} : {}),
        });
        await delay(delayMs);
      }
    }
  }

  async #issueOnce(): Promise<AccessToken> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs);
    const credentials = Buffer.from(`${this.#config.clientId}:${this.#config.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      audience: this.#config.audience,
      scope: this.#config.scope.join(" "),
    });

    try {
      const response = await this.#fetch(this.#config.tokenUrl, {
        method: "POST",
        headers: {
          authorization: `Basic ${credentials}`,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw errorFromResponse(response, payload, this.#config.clientSecret);
      }
      if (
        typeof payload?.access_token !== "string"
        || payload.access_token.length === 0
        || typeof payload?.token_type !== "string"
        || payload.token_type.toLowerCase() !== "bearer"
        || typeof payload?.expires_in !== "number"
        || !Number.isFinite(payload.expires_in)
        || payload.expires_in <= 0
      ) {
        throw new AetherError({
          status: response.status,
          code: "invalid_token_response",
          message: "Identity returned an invalid client credentials response",
        });
      }

      const token: AccessToken = {
        accessToken: payload.access_token,
        expiresAt: Date.now() + payload.expires_in * 1000,
      };
      this.#cached = token;
      return token;
    } catch (error) {
      if (error instanceof AetherError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new AetherError({
        status: 0,
        code: timedOut ? "request_timeout" : "network_error",
        message: timedOut ? "Token request timed out" : "Token request failed",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function retryable(error: AetherError): boolean {
  if (error.status === 0) return new Set(["network_error", "request_timeout"]).has(error.code);
  if (new Set([502, 503, 504]).has(error.status)) return true;
  return error.status === 429 && error.code === "rate_limited";
}

function retryDelayMilliseconds(error: AetherError, attempt: number): number {
  if (error.retry.retryAfterSeconds !== undefined) return Math.max(0, error.retry.retryAfterSeconds * 1_000);
  return Math.min(100 * 2 ** (attempt - 1), 1_000);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function errorFromResponse(response: Response, payload: any, secret: string): AetherError {
  const envelope = payload?.error;
  const code = typeof envelope === "object" && typeof envelope?.code === "string"
    ? envelope.code
    : typeof envelope === "string"
      ? envelope
      : "request_failed";
  const rawMessage = typeof envelope === "object" && typeof envelope?.message === "string"
    ? envelope.message
    : `Aether request failed with HTTP ${response.status}`;
  const requestId = response.headers.get("x-request-id") ?? (typeof envelope?.request_id === "string" ? envelope.request_id : undefined);
  return new AetherError({
    status: response.status,
    code,
    message: rawMessage.replaceAll(secret, "[REDACTED]"),
    ...(requestId ? {requestId} : {}),
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
