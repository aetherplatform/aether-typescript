import assert from "node:assert/strict";
import test from "node:test";

import {AetherError} from "../packages/core/dist/index.js";
import {IdentityClient} from "../packages/identity/dist/index.js";
import {ConfidentialIdentityClient} from "../packages/identity/dist/server.js";

test("Identity builds a mandatory PKCE authorization URL without principal_id", () => {
  const client = new IdentityClient({baseUrl: "https://auth.useather.test"});
  const target = new URL(client.authorizationUrl({
    clientId: "client_1",
    redirectUri: "https://app.example/callback",
    scope: "openid profile",
    state: "state_1",
    nonce: "nonce_1",
    codeChallenge: "a".repeat(43),
  }));

  assert.equal(target.pathname, "/oauth/authorize");
  assert.equal(target.searchParams.get("response_type"), "code");
  assert.equal(target.searchParams.get("code_challenge_method"), "S256");
  assert.equal(target.searchParams.get("nonce"), "nonce_1");
  assert.equal(target.searchParams.has("principal_id"), false);
});

test("Identity discovery retries transient failures and validates the response", async () => {
  let calls = 0;
  const retries = [];
  const client = new IdentityClient({
    baseUrl: "https://auth.useather.test",
    onRetry: (event) => retries.push(event),
    fetch: async (_url, request) => {
      calls += 1;
      assert.equal(new Headers(request.headers).has("authorization"), false);
      if (calls === 1) {
        return Response.json(
          {error: {code: "temporarily_unavailable", message: "retry"}},
          {status: 503, headers: {"retry-after": "0", "x-request-id": "req_retry"}},
        );
      }
      return Response.json({
        issuer: "https://auth.useather.test",
        authorization_endpoint: "https://auth.useather.test/oauth/authorize",
        token_endpoint: "https://auth.useather.test/oauth/token",
        jwks_uri: "https://auth.useather.test/.well-known/jwks.json",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        id_token_signing_alg_values_supported: ["EdDSA", "RS256"],
      });
    },
  });

  const discovery = await client.getOpenIdConfiguration({correlationId: "corr_1"});
  assert.equal(discovery.issuer, "https://auth.useather.test");
  assert.equal(calls, 2);
  assert.deepEqual(retries.map(({attempt, requestId}) => [attempt, requestId]), [[1, "req_retry"]]);

  const malformed = new IdentityClient({
    baseUrl: "https://auth.useather.test",
    fetch: async () => Response.json({issuer: "https://auth.useather.test"}),
  });
  await assert.rejects(malformed.getOpenIdConfiguration(), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.code, "invalid_response");
    return true;
  });
});

test("Identity userinfo refreshes once and never loops", async () => {
  let tokenIndex = 0;
  let invalidations = 0;
  let calls = 0;
  const provider = {
    getToken: async () => ({accessToken: tokenIndex === 0 ? "stale" : "fresh", expiresAt: Date.now() + 60_000}),
    invalidate: () => {
      invalidations += 1;
      tokenIndex = 1;
    },
  };
  const client = new IdentityClient({
    baseUrl: "https://auth.useather.test",
    fetch: async (_url, request) => {
      calls += 1;
      const authorization = new Headers(request.headers).get("authorization");
      if (authorization === "Bearer stale") return Response.json({}, {status: 401});
      return Response.json({sub: "pairwise_subject"});
    },
  });

  assert.equal((await client.getUserInfo(provider)).sub, "pairwise_subject");
  assert.equal(invalidations, 1);
  assert.equal(calls, 2);

  calls = 0;
  invalidations = 0;
  tokenIndex = 0;
  const rejecting = new IdentityClient({
    baseUrl: "https://auth.useather.test",
    fetch: async () => {
      calls += 1;
      return Response.json({}, {status: 401});
    },
  });
  await assert.rejects(rejecting.getUserInfo(provider), (error) => error instanceof AetherError && error.status === 401);
  assert.equal(invalidations, 1);
  assert.equal(calls, 2);
});

test("confidential Identity calls use Basic auth, form encoding, and no automatic retry", async () => {
  const requests = [];
  const client = new ConfidentialIdentityClient({
    baseUrl: "https://auth.useather.test",
    clientId: "client_1",
    clientSecret: "secret_1",
    fetch: async (url, request) => {
      requests.push({url: String(url), request, body: new URLSearchParams(String(request.body))});
      return Response.json({access_token: "access_1", token_type: "Bearer", expires_in: 600});
    },
  });

  await client.exchangeOAuthToken({
    grant_type: "client_credentials",
    audience: "aether-events",
    scope: "events:catalog/*:read",
  });

  assert.equal(requests.length, 1);
  assert.equal(new Headers(requests[0].request.headers).get("authorization"), `Basic ${Buffer.from("client_1:secret_1").toString("base64")}`);
  assert.equal(requests[0].body.get("grant_type"), "client_credentials");
  assert.equal(requests[0].body.get("audience"), "aether-events");
  assert.equal(requests[0].body.get("scope"), "events:catalog/*:read");

  let failures = 0;
  const rejected = new ConfidentialIdentityClient({
    baseUrl: "https://auth.useather.test",
    clientId: "client_1",
    clientSecret: "never-log-me",
    fetch: async () => {
      failures += 1;
      return Response.json({
        error: {
          code: "invalid_client",
          message: "never-log-me rejected",
          details: {secret: "never-log-me"},
        },
      }, {status: 401});
    },
  });
  await assert.rejects(
    rejected.exchangeOAuthToken({grant_type: "client_credentials", audience: "aether-events", scope: "events:catalog/*:read"}),
    (error) => {
      assert(error instanceof AetherError);
      assert.equal(error.message, "[REDACTED] rejected");
      assert.equal(error.details, undefined);
      return true;
    },
  );
  assert.equal(failures, 1);
});

test("confidential Identity validates grant-specific fields", async () => {
  const client = new ConfidentialIdentityClient({
    baseUrl: "https://auth.useather.test",
    clientId: "client_1",
    clientSecret: "secret_1",
    fetch: async () => {
      throw new Error("request must not be sent");
    },
  });

  await assert.rejects(
    client.exchangeOAuthToken({grant_type: "authorization_code", code: "code", redirect_uri: "https://app.example/callback"}),
    /code_verifier/,
  );
  await assert.rejects(client.exchangeOAuthToken({grant_type: "refresh_token"}), /refresh_token is required/);
  await assert.rejects(client.revokeOAuthToken({token: ""}), /token is required/);
});
