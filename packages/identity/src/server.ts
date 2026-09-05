import {AetherError} from "@aetherplatform/core";
import {ClientCredentialsTokenProvider} from "@aetherplatform/core/server";

import type {IntrospectionResponse, TokenHandleRequest, TokenRequest, TokenResponse} from "./generated.js";
import {
  IdentityTransport,
  type IdentityRequestOptions,
  type IdentityTransportConfig,
} from "./internal.js";

export {ClientCredentialsTokenProvider};
export type {ClientCredentialsConfig} from "@aetherplatform/core/server";
export type {AccessToken, TokenProvider} from "@aetherplatform/core";

const codeVerifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

export interface ConfidentialIdentityClientConfig extends IdentityTransportConfig {
  clientId: string;
  clientSecret: string;
}

export class ConfidentialIdentityClient {
  readonly #transport: IdentityTransport;
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor(config: ConfidentialIdentityClientConfig) {
    if (!config.clientId.trim() || !config.clientSecret) {
      throw new TypeError("clientId and clientSecret are required");
    }
    this.#transport = new IdentityTransport(config);
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
  }

  async exchangeOAuthToken(request: TokenRequest, options: IdentityRequestOptions = {}): Promise<TokenResponse> {
    const {form, sensitiveValues} = tokenRequestForm(request);
    const response = await this.#request<TokenResponse>(
      "exchangeOAuthToken",
      "/oauth/token",
      form,
      [...sensitiveValues, this.#clientSecret],
      options,
    );
    if (!response?.access_token || response.token_type.toLowerCase() !== "bearer" || response.expires_in <= 0) {
      throw new AetherError({
        status: 0,
        code: "invalid_token_response",
        message: "Identity returned an invalid OAuth token response",
      });
    }
    return response;
  }

  async revokeOAuthToken(request: TokenHandleRequest, options: IdentityRequestOptions = {}): Promise<void> {
    const form = tokenHandleForm(request);
    await this.#request<void>(
      "revokeOAuthToken",
      "/oauth/revoke",
      form,
      [request.token, this.#clientSecret],
      options,
    );
  }

  async introspectOAuthToken(
    request: TokenHandleRequest,
    options: IdentityRequestOptions = {},
  ): Promise<IntrospectionResponse> {
    const form = tokenHandleForm(request);
    return this.#request<IntrospectionResponse>(
      "introspectOAuthToken",
      "/oauth/introspect",
      form,
      [request.token, this.#clientSecret],
      options,
    );
  }

  #request<ResponseBody>(
    operation: string,
    path: string,
    body: URLSearchParams,
    redact: readonly string[],
    options: IdentityRequestOptions,
  ): Promise<ResponseBody> {
    const credentials = Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString("base64");
    return this.#transport.request<ResponseBody>({
      operation,
      method: "POST",
      path,
      headers: {authorization: `Basic ${credentials}`},
      body,
      successStatuses: [200],
      retrySafe: false,
      redact,
      omitErrorDetails: true,
    }, options);
  }
}

function tokenRequestForm(request: TokenRequest): {form: URLSearchParams; sensitiveValues: string[]} {
  const form = new URLSearchParams({grant_type: request.grant_type});
  const sensitiveValues = [request.code, request.code_verifier, request.refresh_token].filter(
    (value): value is string => Boolean(value),
  );

  switch (request.grant_type) {
    case "authorization_code":
      if (!request.code || !request.redirect_uri || !request.code_verifier) {
        throw new TypeError("code, redirect_uri, and code_verifier are required for authorization_code");
      }
      if (!codeVerifierPattern.test(request.code_verifier)) {
        throw new TypeError("code_verifier must be 43 to 128 RFC 7636 characters");
      }
      form.set("code", request.code);
      form.set("redirect_uri", request.redirect_uri);
      form.set("code_verifier", request.code_verifier);
      break;
    case "refresh_token":
      if (!request.refresh_token) throw new TypeError("refresh_token is required for refresh_token");
      form.set("refresh_token", request.refresh_token);
      break;
    case "client_credentials":
      if (!request.audience || !request.scope) {
        throw new TypeError("audience and scope are required for client_credentials");
      }
      form.set("audience", request.audience);
      form.set("scope", request.scope);
      break;
    default:
      throw new TypeError("Unsupported OAuth grant type");
  }

  return {form, sensitiveValues};
}

function tokenHandleForm(request: TokenHandleRequest): URLSearchParams {
  if (!request.token) throw new TypeError("token is required");
  const form = new URLSearchParams({token: request.token});
  if (request.token_type_hint) form.set("token_type_hint", request.token_type_hint);
  return form;
}
