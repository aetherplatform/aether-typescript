// Generated from the canonical Aether OpenAPI contract. Do not edit.
// Source: contracts/openapi/v1/identity.yaml

export type PasswordlessStartRequest = { client_id?: string; identifier: string; channel: "email" | "sms"; redirect_uri: string; scope?: string; state?: string; nonce?: string; code_challenge: string; code_challenge_method: "S256"; response_type?: "code"; };

export type PasswordlessStartResponse = { transaction: string; challenge_id: string; expires_in: 300; resend_after: number; transaction_expires_in: 600; };

export type PasswordlessVerifyRequest = { client_id?: string; transaction: string; challenge_id: string; identifier: string; channel: "email" | "sms"; code: string; code_verifier: string; };

export type PasswordlessCompleteRequest = { client_id?: string; continuation: string; code_verifier: string; decision: "approve" | "deny"; identifier?: string; profile?: { display_name?: string; }; consent?: { aether_terms_version: string; aether_privacy_version: string; }; };

export type PasswordlessVerifyResponse = PasswordlessAuthorized | PasswordlessHostedCompletionRequired | PasswordlessCustomCompletionRequired;

export type PasswordlessCompleteResponse = PasswordlessAuthorized | PasswordlessDenied;

export type PasswordlessAuthorized = { status: "authorized"; code: string; state: string | null; };

export type PasswordlessHostedCompletionRequired = { status: "hosted_completion_required"; continuation_url: string; expires_in: number; };

export type PasswordlessCustomCompletionRequired = { status: "custom_completion_required"; continuation: string; expires_in: number; requirements: PasswordlessCompletionRequirements; };

export type PasswordlessCompletionRequirements = { registration: boolean; consent: boolean; scopes: Array<string>; aether_terms_version: string | null; aether_privacy_version: string | null; };

export type PasswordlessDenied = { status: "denied"; error: "access_denied"; state: string | null; };

export type PasswordlessError = { error: { code: "INVALID_REQUEST" | "INVALID_PASSWORDLESS_REQUEST" | "INVALID_CLIENT" | "ORIGIN_NOT_ALLOWED" | "CUSTOM_COMPLETION_NOT_ALLOWED" | "RATE_LIMITED" | "TEMPORARILY_UNAVAILABLE" | "IDENTITY_ROLE_UNAVAILABLE"; }; };

export type TokenRequest = { grant_type: "authorization_code" | "refresh_token" | "client_credentials"; client_id?: string; client_secret?: string; code?: string; redirect_uri?: string; code_verifier?: string; refresh_token?: string; audience?: string; scope?: string; };

export type TokenResponse = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token?: string; id_token?: string; scope?: string; };

export type TokenHandleRequest = { client_id?: string; client_secret?: string; token: string; token_type_hint?: string; };

export type IntrospectionResponse = { active: boolean; client_id?: string; token_type?: string; token_use?: string; scope?: string; aud?: string; iss?: string; sub?: string; exp?: number; iat?: number; jti?: string; };

export type UserInfo = { sub: string; [key: string]: unknown; };

export type OpenIdConfiguration = { issuer: string; authorization_endpoint: string; token_endpoint: string; userinfo_endpoint?: string; revocation_endpoint?: string; introspection_endpoint?: string; jwks_uri: string; response_types_supported: Array<string>; grant_types_supported: Array<string>; code_challenge_methods_supported: Array<string>; token_endpoint_auth_methods_supported?: Array<"client_secret_basic" | "client_secret_post" | "none">; id_token_signing_alg_values_supported?: Array<"EdDSA" | "RS256">; [key: string]: unknown; };

export type Jwks = { keys: Array<{ kty: "OKP" | "RSA"; kid: string; alg: "EdDSA" | "RS256"; use: "sig"; [key: string]: unknown; }>; };

export interface IdentityOperations {
  authorize: {
    request: never;
    response: void;
    path: Record<string, never>;
    query: { response_type: "code"; client_id: string; redirect_uri: string; scope: string; state: string; nonce?: string; code_challenge: string; code_challenge_method: "S256"; };
  };
  completePasswordless: {
    request: PasswordlessCompleteRequest;
    response: PasswordlessCompleteResponse;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
  exchangeOAuthToken: {
    request: TokenRequest;
    response: TokenResponse;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
  getOAuthJwks: {
    request: never;
    response: Jwks;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  getOpenIdConfiguration: {
    request: never;
    response: OpenIdConfiguration;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  getUserInfo: {
    request: never;
    response: UserInfo;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
  introspectOAuthToken: {
    request: TokenHandleRequest;
    response: IntrospectionResponse;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  listOAuthScopes: {
    request: never;
    response: { scopes: Array<string>; };
    path: Record<string, never>;
    query: Record<string, never>;
  };
  revokeOAuthToken: {
    request: TokenHandleRequest;
    response: void;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
  startPasswordless: {
    request: PasswordlessStartRequest;
    response: PasswordlessStartResponse;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
  verifyPasswordless: {
    request: PasswordlessVerifyRequest;
    response: PasswordlessVerifyResponse;
    path: Record<string, never>;
    query: { client_id?: string; };
  };
}

export const operations = {
  authorize: {
    method: "GET",
    path: "/oauth/authorize",
    tokenProfiles: ["browser_session"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [302],
  },
  completePasswordless: {
    method: "POST",
    path: "/v1/passwordless/complete",
    tokenProfiles: ["confidential_client","public_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  exchangeOAuthToken: {
    method: "POST",
    path: "/oauth/token",
    tokenProfiles: ["confidential_client","public_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  getOAuthJwks: {
    method: "GET",
    path: "/.well-known/jwks.json",
    tokenProfiles: ["public"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getOpenIdConfiguration: {
    method: "GET",
    path: "/.well-known/openid-configuration",
    tokenProfiles: ["public"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getUserInfo: {
    method: "GET",
    path: "/oauth/userinfo",
    tokenProfiles: ["user_access_v1"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  introspectOAuthToken: {
    method: "POST",
    path: "/oauth/introspect",
    tokenProfiles: ["confidential_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  listOAuthScopes: {
    method: "GET",
    path: "/.well-known/scopes",
    tokenProfiles: ["public"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  revokeOAuthToken: {
    method: "POST",
    path: "/oauth/revoke",
    tokenProfiles: ["confidential_client","public_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  startPasswordless: {
    method: "POST",
    path: "/v1/passwordless/start",
    tokenProfiles: ["confidential_client","public_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [202],
  },
  verifyPasswordless: {
    method: "POST",
    path: "/v1/passwordless/verify",
    tokenProfiles: ["confidential_client","public_client"],
    requiredCapability: null,
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
} as const;
