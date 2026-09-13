import {AetherError, type TokenProvider} from "@aetherplatform/core";

import type {
  Jwks, OpenIdConfiguration, UserInfo, TokenResponse,
  PasswordlessStartRequest, PasswordlessStartResponse,
  PasswordlessVerifyRequest, PasswordlessVerifyResponse,
  PasswordlessCompleteRequest, PasswordlessCompleteResponse,
} from "./generated.js";
import {passwordlessRequest, resolveClientId, clientPath, validateCodeVerifier} from "./passwordless.js";
import {
  IdentityTransport,
  type IdentityRequestOptions,
  type IdentityRetryEvent,
  type IdentityTransportConfig,
} from "./internal.js";

export * from "./generated.js";
export {generatePkce, validateOAuthCallback, type PkcePair, type OAuthCallbackResult} from "./pkce.js";
export type {IdentityRequestOptions, IdentityRetryEvent};

const codeChallengePattern = /^[A-Za-z0-9_-]{43,128}$/;

export interface IdentityClientConfig extends IdentityTransportConfig {
  clientId?: string;
}

export type PublicTokenRequest = {client_id?: string} & (
  | {grant_type: "authorization_code"; code: string; redirect_uri: string; code_verifier: string}
  | {grant_type: "refresh_token"; refresh_token: string}
);

export interface PublicTokenHandleRequest {
  client_id?: string;
  token: string;
  token_type_hint?: string;
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  nonce?: string;
  codeChallenge: string;
}

export interface ScopeCatalog {
  scopes: string[];
}

export class IdentityClient {
  readonly #transport: IdentityTransport;
  readonly #clientId: string | undefined;

  constructor(config: IdentityClientConfig) {
    this.#transport = new IdentityTransport(config);
    this.#clientId = config.clientId;
  }

  startPasswordless(request: PasswordlessStartRequest, options: IdentityRequestOptions = {}): Promise<PasswordlessStartResponse> {
    return passwordlessRequest(this.#transport, "startPasswordless", request, resolveClientId(this.#clientId, request.client_id), options);
  }

  verifyPasswordless(request: PasswordlessVerifyRequest, options: IdentityRequestOptions = {}): Promise<PasswordlessVerifyResponse> {
    return passwordlessRequest(this.#transport, "verifyPasswordless", request, resolveClientId(this.#clientId, request.client_id), options);
  }

  completePasswordless(request: PasswordlessCompleteRequest, options: IdentityRequestOptions = {}): Promise<PasswordlessCompleteResponse> {
    return passwordlessRequest(this.#transport, "completePasswordless", request, resolveClientId(this.#clientId, request.client_id), options);
  }

  async exchangeOAuthToken(request: PublicTokenRequest, options: IdentityRequestOptions = {}): Promise<TokenResponse> {
    const id = resolveClientId(this.#clientId, request.client_id);
    const form = new URLSearchParams({client_id: id, grant_type: request.grant_type});
    if (request.grant_type === "authorization_code") {
      if (!request.code || !request.redirect_uri) throw new TypeError("code and redirect_uri are required");
      validateCodeVerifier(request.code_verifier);
      form.set("code", request.code);
      form.set("redirect_uri", request.redirect_uri);
      form.set("code_verifier", request.code_verifier);
    } else if (request.grant_type === "refresh_token") {
      if (!request.refresh_token) throw new TypeError("refresh_token is required");
      form.set("refresh_token", request.refresh_token);
    } else {
      throw new TypeError("Public clients may only exchange authorization codes or refresh tokens");
    }
    const response = await this.#transport.request<TokenResponse>({
      operation: "exchangeOAuthToken", method: "POST", path: clientPath("/oauth/token", id),
      body: form, successStatuses: [200], retrySafe: false, omitErrorDetails: true,
    }, options);
    if (typeof response?.access_token !== "string" || !response.access_token || typeof response.token_type !== "string"
      || response.token_type.toLowerCase() !== "bearer" || !Number.isFinite(response.expires_in) || response.expires_in <= 0) {
      throw invalidIdentityResponse("OAuth token");
    }
    return response;
  }

  async revokeOAuthToken(request: PublicTokenHandleRequest, options: IdentityRequestOptions = {}): Promise<void> {
    const id = resolveClientId(this.#clientId, request.client_id);
    if (!request.token) throw new TypeError("token is required");
    const form = new URLSearchParams({client_id: id, token: request.token});
    if (request.token_type_hint) form.set("token_type_hint", request.token_type_hint);
    await this.#transport.request<void>({
      operation: "revokeOAuthToken", method: "POST", path: clientPath("/oauth/revoke", id),
      body: form, successStatuses: [200], retrySafe: false, omitErrorDetails: true,
    }, options);
  }

  authorizationUrl(request: AuthorizationRequest): string {
    if (!request.clientId.trim() || !request.scope.trim() || !request.state.trim()) {
      throw new TypeError("clientId, scope, and state are required");
    }
    try {
      new URL(request.redirectUri);
    } catch {
      throw new TypeError("redirectUri must be absolute");
    }
    if (!codeChallengePattern.test(request.codeChallenge)) {
      throw new TypeError("codeChallenge must be 43 to 128 base64url characters");
    }

    const target = this.#transport.resolve("/oauth/authorize");
    target.searchParams.set("response_type", "code");
    target.searchParams.set("client_id", request.clientId);
    target.searchParams.set("redirect_uri", request.redirectUri);
    target.searchParams.set("scope", request.scope);
    target.searchParams.set("state", request.state);
    target.searchParams.set("code_challenge", request.codeChallenge);
    target.searchParams.set("code_challenge_method", "S256");
    if (request.nonce) target.searchParams.set("nonce", request.nonce);
    return target.toString();
  }

  async getOpenIdConfiguration(options: IdentityRequestOptions = {}): Promise<OpenIdConfiguration> {
    const response = await this.#transport.request<OpenIdConfiguration>({
      operation: "getOpenIdConfiguration",
      method: "GET",
      path: "/.well-known/openid-configuration",
      successStatuses: [200],
      retrySafe: true,
    }, options);
    if (
      !response
      || !response.issuer
      || !response.authorization_endpoint
      || !response.token_endpoint
      || !response.jwks_uri
      || !response.response_types_supported?.length
      || !response.grant_types_supported?.length
      || !response.code_challenge_methods_supported?.length
    ) {
      throw invalidIdentityResponse("OpenID configuration");
    }
    return response;
  }

  async getOAuthJwks(options: IdentityRequestOptions = {}): Promise<Jwks> {
    const response = await this.#transport.request<Jwks>({
      operation: "getOAuthJwks",
      method: "GET",
      path: "/.well-known/jwks.json",
      successStatuses: [200],
      retrySafe: true,
    }, options);
    if (!response?.keys?.length) throw invalidIdentityResponse("JWKS");
    return response;
  }

  async listOAuthScopes(options: IdentityRequestOptions = {}): Promise<ScopeCatalog> {
    const response = await this.#transport.request<ScopeCatalog>({
      operation: "listOAuthScopes",
      method: "GET",
      path: "/.well-known/scopes",
      successStatuses: [200],
      retrySafe: true,
    }, options);
    if (!response || !Array.isArray(response.scopes)) throw invalidIdentityResponse("scope catalog");
    return response;
  }

  async getUserInfo(tokenProvider: TokenProvider, options: IdentityRequestOptions = {}): Promise<UserInfo> {
    if (!tokenProvider) throw new TypeError("A user access token provider is required");
    let refreshed = false;

    while (true) {
      const token = await tokenProvider.getToken();
      if (!token.accessToken) {
        throw new AetherError({status: 0, code: "invalid_access_token", message: "Token provider returned an empty user access token"});
      }

      try {
        const response = await this.#transport.request<UserInfo>({
          operation: "getUserInfo",
          method: "GET",
          path: this.#clientId ? clientPath("/oauth/userinfo", this.#clientId) : "/oauth/userinfo",
          headers: {authorization: `Bearer ${token.accessToken}`},
          successStatuses: [200],
          retrySafe: true,
          omitErrorDetails: true,
        }, options);
        if (!response?.sub) throw invalidIdentityResponse("userinfo");
        return response;
      } catch (error) {
        if (
          error instanceof AetherError
          && error.status === 401
          && !refreshed
          && typeof tokenProvider.invalidate === "function"
        ) {
          tokenProvider.invalidate();
          refreshed = true;
          continue;
        }
        throw error;
      }
    }
  }
}

function invalidIdentityResponse(name: string): AetherError {
  return new AetherError({status: 0, code: "invalid_response", message: `Identity returned an invalid ${name} response`});
}
