import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {AetherError} from "../packages/core/dist/index.js";
import {IdentityClient, generatePkce, validateOAuthCallback} from "../packages/identity/dist/index.js";
import {ConfidentialIdentityClient} from "../packages/identity/dist/server.js";

const baseUrl = "https://auth.example";
const start = {identifier: "person@example.com", channel: "email", redirect_uri: "https://app.example/callback", scope: "openid offline_access", state: "callback-state", code_challenge: "a".repeat(43), code_challenge_method: "S256"};
const challenge = {transaction: "transaction-secret", challenge_id: "challenge-id", expires_in: 300, resend_after: 60, transaction_expires_in: 600};
const verify = {transaction: challenge.transaction, challenge_id: challenge.challenge_id, identifier: start.identifier, channel: start.channel, code: "123456", code_verifier: "v".repeat(43)};
const completion = {continuation: "continuation-secret", code_verifier: verify.code_verifier, decision: "approve", identifier: start.identifier, profile: {display_name: "Person"}, consent: {aether_terms_version: "1", aether_privacy_version: "1"}};
const authorized = {status: "authorized", code: "authorization-secret", state: start.state};
const custom = {status: "custom_completion_required", continuation: "continuation-secret", expires_in: 299, requirements: {registration: true, consent: true, scopes: ["openid"], aether_terms_version: "1", aether_privacy_version: "1"}};
const token = {access_token: "access-secret", token_type: "Bearer", expires_in: 3600, refresh_token: "refresh-secret"};

for (const confidential of [false, true]) {
  test(`${confidential ? "confidential" : "public"} passwordless respects the server resend interval`, async () => {
    for (const seconds of [1, 30, 60, 300, 0, -1, 301, 1.5, "30", null]) {
      const Client = confidential ? ConfidentialIdentityClient : IdentityClient;
      let calls = 0;
      const client = new Client({baseUrl, clientId: "client-1", ...(confidential ? {clientSecret: "secret"} : {}), fetch: async () => {
        calls += 1;
        return Response.json({...challenge, resend_after: seconds}, {status: 202});
      }});
      if (Number.isInteger(seconds) && seconds >= 1 && seconds <= 300) {
        assert.equal((await client.startPasswordless(start)).resend_after, seconds);
      } else {
        await assert.rejects(client.startPasswordless(start), (error) => error instanceof AetherError && error.code === "invalid_response");
      }
      assert.equal(calls, 1);
    }
  });
}

for (const confidential of [false, true]) {
  test(`${confidential ? "confidential" : "public"} passwordless journey uses the correct authentication and explicit outcomes`, async () => {
    const sent = [];
    const Client = confidential ? ConfidentialIdentityClient : IdentityClient;
    const client = new Client({baseUrl, clientId: "client-1", ...(confidential ? {clientSecret: "backend-secret"} : {}), fetch: async (url, request) => {
      const target = new URL(url);
      const body = JSON.parse(request.body);
      const headers = new Headers(request.headers);
      assert.equal(target.searchParams.get("client_id"), "client-1");
      assert.equal(body.client_id, "client-1");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(headers.get("authorization"), confidential ? `Basic ${Buffer.from("client-1:backend-secret").toString("base64")}` : null);
      assert.equal(request.credentials, "omit");
      assert.equal(request.redirect, "error");
      sent.push({target, body});
      if (target.pathname.endsWith("/start")) return Response.json(challenge, {status: 202});
      if (target.pathname.endsWith("/verify")) return Response.json(custom);
      return Response.json(authorized);
    }});
    assert.deepEqual(await client.startPasswordless(start), challenge);
    assert.deepEqual(await client.verifyPasswordless(verify), custom);
    assert.deepEqual(await client.completePasswordless(completion), authorized);
    assert.deepEqual(sent.map(({target}) => target.pathname), ["/v1/passwordless/start", "/v1/passwordless/verify", "/v1/passwordless/complete"]);
    assert.equal(sent.length, 3);
    assert.equal(sent.some(({body}) => "client_secret" in body), false);
  });
}

test("passwordless models authorization, hosted continuation and denial without following URLs", async () => {
  const hosted = {status: "hosted_completion_required", continuation_url: `${baseUrl}/oauth/passwordless/continue?handoff=handoff-secret`, expires_in: 300};
  const replies = [authorized, hosted, {status: "denied", error: "access_denied", state: start.state}];
  let calls = 0;
  const client = new IdentityClient({baseUrl, clientId: "client-1", fetch: async () => { calls += 1; return Response.json(replies.shift()); }});
  assert.deepEqual(await client.verifyPasswordless(verify), authorized);
  assert.deepEqual(await client.verifyPasswordless(verify), hosted);
  assert.equal((await client.completePasswordless({...completion, decision: "deny"})).status, "denied");
  assert.equal(calls, 3);
});

test("public OAuth exchange, rotation and revocation use only client ID", async () => {
  const bodies = [];
  const client = new IdentityClient({baseUrl, clientId: "client-1", fetch: async (url, request) => {
    const target = new URL(url);
    const body = new URLSearchParams(request.body);
    assert.equal(target.searchParams.get("client_id"), "client-1");
    assert.equal(body.get("client_id"), "client-1");
    assert.equal(body.has("client_secret"), false);
    assert.equal(new Headers(request.headers).has("authorization"), false);
    bodies.push(body);
    return target.pathname.endsWith("revoke") ? new Response(null, {status: 200}) : Response.json(token);
  }});
  assert.deepEqual(await client.exchangeOAuthToken({grant_type: "authorization_code", code: authorized.code, redirect_uri: start.redirect_uri, code_verifier: verify.code_verifier}), token);
  assert.deepEqual(await client.exchangeOAuthToken({grant_type: "refresh_token", refresh_token: token.refresh_token}), token);
  await client.revokeOAuthToken({token: token.refresh_token, token_type_hint: "refresh_token"});
  assert.deepEqual(bodies.map((body) => body.get("grant_type")), ["authorization_code", "refresh_token", null]);
  assert.equal(typeof client.introspectOAuthToken, "undefined");
  await assert.rejects(client.exchangeOAuthToken({grant_type: "client_credentials", audience: "aether-events", scope: "read"}), /Public clients/);
  assert.equal(bodies.length, 3);
});

const mutations = [
  ["start", (client) => client.startPasswordless(start)],
  ["verify", (client) => client.verifyPasswordless(verify)],
  ["complete", (client) => client.completePasswordless(completion)],
  ["exchange", (client) => client.exchangeOAuthToken({grant_type: "authorization_code", code: authorized.code, redirect_uri: start.redirect_uri, code_verifier: verify.code_verifier})],
  ["refresh", (client) => client.exchangeOAuthToken({grant_type: "refresh_token", refresh_token: token.refresh_token})],
];
for (const [name, invoke] of mutations) {
  test(`${name} never automatically retries rate limits, dependency failures or interrupted responses`, async () => {
    for (const failure of [429, 503, "network", "malformed"]) {
      let calls = 0;
      const retries = [];
      const client = new IdentityClient({baseUrl, clientId: "client-1", maxRetries: 5, onRetry: (event) => retries.push(event), fetch: async () => {
        calls += 1;
        if (failure === "network") throw new Error("secret must not escape");
        if (failure === "malformed") return new Response("not JSON secret", {status: 200});
        return Response.json({error: {code: failure === 429 ? "RATE_LIMITED" : "TEMPORARILY_UNAVAILABLE"}}, {status: failure, headers: {"retry-after": "60"}});
      }});
      await assert.rejects(invoke(client), (error) => {
        assert(error instanceof AetherError);
        if (failure === 429) assert.equal(error.retry.retryAfterSeconds, 60);
        assert.equal(error.message.includes("secret"), false);
        return true;
      });
      assert.equal(calls, 1);
      assert.deepEqual(retries, []);
    }
  });
}

test("authentication errors discard untrusted secrets in messages, codes, details and request IDs", async () => {
  const secret = "credentials-must-not-escape";
  const client = new ConfidentialIdentityClient({baseUrl, clientId: "client-1", clientSecret: secret, fetch: async () => Response.json({error: {code: secret, message: secret, request_id: secret, details: {token: secret}}}, {status: 400, headers: {"x-request-id": secret, "quota-reset": secret}})});
  await assert.rejects(client.startPasswordless(start), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.code, "request_failed");
    assert.equal(error.details, undefined);
    assert.equal(error.requestId, undefined);
    assert.equal(error.retry.quotaReset, undefined);
    assert.equal(JSON.stringify(error).includes(secret), false);
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});

test("invalid result variants and foreign hosted URLs are rejected without leaking payloads", async () => {
  for (const value of [null, [], {status: "authorized"}, {...custom, requirements: {registration: true}}, {status: "unknown", secret: "hidden"}, {status: "hosted_completion_required", continuation_url: "https://evil.example/oauth/passwordless/continue?handoff=secret", expires_in: 300}]) {
    const client = new IdentityClient({baseUrl, clientId: "client-1", fetch: async () => Response.json(value)});
    await assert.rejects(client.verifyPasswordless(verify), (error) => error instanceof AetherError && error.code === "invalid_response" && !error.message.includes("hidden"));
  }
});

test("client context, PKCE and unregistered request fields are checked before sending", async () => {
  let calls = 0;
  const client = new IdentityClient({baseUrl, clientId: "client-1", fetch: async () => { calls += 1; return Response.json(challenge, {status: 202}); }});
  assert.throws(() => client.startPasswordless({...start, client_id: "foreign"}), /must match/);
  await assert.rejects(client.startPasswordless({...start, organization_id: "foreign"}), /unsupported field/);
  await assert.rejects(client.startPasswordless({...start, code_challenge_method: "plain"}), /S256/);
  await assert.rejects(client.startPasswordless({...start, redirect_uri: "http://app.example/callback"}), /HTTPS/);
  await assert.rejects(client.verifyPasswordless({...verify, code_verifier: "short"}), /code_verifier/);
  assert.equal(calls, 0);
  await client.startPasswordless(start);
  assert.equal(calls, 1);
});

test("PKCE helper produces random S256 proof using browser Web Crypto", async () => {
  const first = await generatePkce();
  const second = await generatePkce();
  assert.match(first.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(first.codeChallengeMethod, "S256");
  assert.equal(first.codeChallenge, createHash("sha256").update(first.codeVerifier).digest("base64url"));
  assert.notEqual(first.codeVerifier, second.codeVerifier);
});

test("callback validation binds exact redirect and state, rejects duplicates and ambiguous outcomes", () => {
  const expected = {redirectUri: "https://app.example/callback", state: "random-state"};
  assert.deepEqual(validateOAuthCallback(`${expected.redirectUri}?code=one&state=random-state`, expected), {status: "authorized", code: "one", state: "random-state"});
  assert.deepEqual(validateOAuthCallback(`${expected.redirectUri}?error=access_denied&state=random-state`, expected), {status: "denied", error: "access_denied", state: "random-state"});
  for (const callback of [
    "https://evil.example/callback?code=x&state=random-state",
    "https://app.example/wrong?code=x&state=random-state",
    "https://app.example/callback?code=x&state=wrong",
    "https://app.example/callback?code=x",
    "https://app.example/callback?code=x&state=random-state&state=random-state",
    "https://app.example/callback?code=x&code=y&state=random-state",
    "https://app.example/callback?code=x&error=access_denied&state=random-state",
    "https://app.example/callback?code=&state=random-state",
    "https://app.example/callback?state=random-state",
    "https://app.example/callback?code=x&state=random-state#fragment",
    "https://user:password@app.example/callback?code=x&state=random-state",
  ]) assert.throws(() => validateOAuthCallback(callback, expected), TypeError);
  assert.throws(() => validateOAuthCallback(expected.redirectUri, {...expected, state: ""}), /state/);
});

test("Identity reads retryable HTML failures while keeping successful malformed responses invalid", async () => {
  let calls = 0;
  const retries = [];
  const client = new IdentityClient({baseUrl, onRetry: (event) => retries.push(event), fetch: async () => {
    calls += 1;
    if (calls === 1) return new Response("<html>outage</html>", {status: 503, headers: {"retry-after": "0"}});
    return Response.json({scopes: ["openid"]});
  }});
  assert.deepEqual(await client.listOAuthScopes(), {scopes: ["openid"]});
  assert.equal(calls, 2);
  assert.equal(retries.length, 1);
});
