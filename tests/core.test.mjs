import assert from "node:assert/strict";
import test from "node:test";

import {
  AetherError,
  CursorPaginationError,
  OperationClient,
  paginateCursor,
} from "../packages/core/dist/index.js";
import {ClientCredentialsTokenProvider} from "../packages/core/dist/server.js";

test("client credentials requests are single-flight and cached", async () => {
  let calls = 0;
  const provider = new ClientCredentialsTokenProvider({
    tokenUrl: "https://identity.example/oauth/token",
    clientId: "client_1",
    clientSecret: "secret_1",
    audience: "aether-storage",
    scope: ["storage:namespaces/*:read"],
    fetch: async (_url, request) => {
      calls += 1;
      assert.match(request.headers.authorization, /^Basic /);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({access_token: "access_1", token_type: "Bearer", expires_in: 600});
    },
  });

  const [first, second] = await Promise.all([provider.getToken(), provider.getToken()]);
  assert.equal(first.accessToken, "access_1");
  assert.equal(second.accessToken, "access_1");
  assert.equal(calls, 1);
  await provider.getToken();
  assert.equal(calls, 1);
});

test("token errors redact the configured client secret", async () => {
  const provider = new ClientCredentialsTokenProvider({
    tokenUrl: "https://identity.example/oauth/token",
    clientId: "client_1",
    clientSecret: "never-log-me",
    audience: "aether-storage",
    scope: ["storage:*"],
    fetch: async () => Response.json({error: {code: "invalid_client", message: "never-log-me rejected", details: {received: "never-log-me"}}}, {status: 401}),
  });

  await assert.rejects(provider.getToken(), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.message, "[REDACTED] rejected");
    assert.equal(error.details, undefined);
    return true;
  });
});

test("client credentials reject invalid configuration and malformed success responses", async () => {
  const baseConfig = {
    tokenUrl: "https://identity.example/oauth/token",
    clientId: "client_1",
    clientSecret: "secret_1",
    audience: "aether-storage",
    scope: ["storage:*"],
  };

  assert.throws(
    () => new ClientCredentialsTokenProvider({...baseConfig, timeoutMs: 0}),
    /timeoutMs must be a positive safe integer/,
  );
  assert.throws(
    () => new ClientCredentialsTokenProvider({...baseConfig, clockSkewSeconds: -1}),
    /clockSkewSeconds must be a non-negative finite number/,
  );

  for (const payload of [
    {access_token: "", token_type: "Bearer", expires_in: 600},
    {access_token: "access_1", token_type: "MAC", expires_in: 600},
    {access_token: "access_1", token_type: "Bearer", expires_in: 0},
  ]) {
    const provider = new ClientCredentialsTokenProvider({
      ...baseConfig,
      fetch: async () => Response.json(payload),
    });
    await assert.rejects(provider.getToken(), (error) => {
      assert(error instanceof AetherError);
      assert.equal(error.code, "invalid_token_response");
      return true;
    });
  }
});

test("operation client rejects invalid timeout and retry configuration", () => {
  const operation = {method: "GET", path: "/v1/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200]};
  const baseConfig = {
    baseUrl: "https://api.example.test",
    tokenProvider: {getToken: async () => ({accessToken: "trusted", expiresAt: Date.now() + 60_000})},
  };

  assert.throws(
    () => new OperationClient({...baseConfig, timeoutMs: 0}, {read: operation}),
    /timeoutMs must be a positive safe integer/,
  );
  assert.throws(
    () => new OperationClient({...baseConfig, maxRetries: -1}, {read: operation}),
    /maxRetries must be a non-negative safe integer/,
  );
});

test("rate limits retry but quota exhaustion does not", async () => {
  const tokenProvider = {getToken: async () => ({accessToken: "token", expiresAt: Date.now() + 60_000})};
  const operation = {
    method: "GET",
    path: "/api/v1/resources/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/{id}:read",
    availability: ["sandbox", "live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  };

  let rateCalls = 0;
  const rateClient = new OperationClient(
    {
      baseUrl: "https://storage.example",
      tokenProvider,
      fetch: async (url) => {
        rateCalls += 1;
        assert.equal(url, "https://storage.example/api/v1/resources/one");
        if (rateCalls === 1) return Response.json({error: {code: "rate_limited", message: "slow down"}}, {status: 429, headers: {"retry-after": "0"}});
        return Response.json({id: "one"});
      },
    },
    {getResource: operation},
  );
  assert.deepEqual(await rateClient.request("getResource", {path: {id: "one"}}), {id: "one"});
  assert.equal(rateCalls, 2);

  let quotaCalls = 0;
  const quotaClient = new OperationClient(
    {
      baseUrl: "https://storage.example",
      tokenProvider,
      fetch: async () => {
        quotaCalls += 1;
        return Response.json({error: {code: "quota_exceeded", message: "upgrade required"}}, {status: 429});
      },
    },
    {getResource: operation},
  );
  await assert.rejects(quotaClient.request("getResource", {path: {id: "one"}}), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.code, "quota_exceeded");
    return true;
  });
  assert.equal(quotaCalls, 1);
});

test("non-idempotent mutations are never retried", async () => {
  let calls = 0;
  const client = new OperationClient(
    {
      baseUrl: "https://notifications.example",
      tokenProvider: {getToken: async () => ({accessToken: "token", expiresAt: Date.now() + 60_000})},
      fetch: async () => {
        calls += 1;
        return Response.json({error: {code: "auth_service_unavailable", message: "try later"}}, {status: 503});
      },
    },
    {
      send: {
        method: "POST",
        path: "/api/v1/notifications",
        tokenProfiles: ["client_access_v1"],
        requiredCapability: "notifications:messages/*:send",
        availability: ["sandbox", "live"],
        idempotency: "unsupported",
        successStatuses: [202],
      },
    },
  );

  await assert.rejects(client.request("send", {body: {}}), AetherError);
  assert.equal(calls, 1);
});

test("operation client owns bearer and request identity headers", async () => {
  let received;
  const client = new OperationClient(
    {
      baseUrl: "https://api.example.test",
      tokenProvider: {getToken: async () => ({accessToken: "trusted", expiresAt: Date.now() + 60_000})},
      fetch: async (_url, request) => {
        received = new Headers(request.headers);
        return new Response("{}", {status: 200, headers: {"content-type": "application/json"}});
      },
    },
    {read: {method: "GET", path: "/v1/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200]}},
  );

  await client.request("read", {
    requestId: "req_trusted",
    headers: {Authorization: "Bearer attacker", "X-Request-ID": "req_attacker"},
  });

  assert.equal(received.get("authorization"), "Bearer trusted");
  assert.equal(received.get("x-request-id"), "req_trusted");
});

test("operation client does not start a pre-aborted request", async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const client = new OperationClient(
    {
      baseUrl: "https://api.example.test",
      tokenProvider: {getToken: async () => ({accessToken: "trusted", expiresAt: Date.now() + 60_000})},
      fetch: async () => {
        calls += 1;
        return new Response("{}", {status: 200});
      },
      maxRetries: 0,
    },
    {read: {method: "GET", path: "/v1/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200]}},
  );

  await assert.rejects(client.request("read", {signal: controller.signal}), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.code, "request_aborted");
    return true;
  });
  assert.equal(calls, 0);
});

test("idempotent requests retry network failures but never caller aborts", async () => {
  let networkCalls = 0;
  const operation = {method: "GET", path: "/v1/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200]};
  const networkClient = new OperationClient(
    {
      baseUrl: "https://api.example.test",
      tokenProvider: {getToken: async () => ({accessToken: "trusted", expiresAt: Date.now() + 60_000})},
      fetch: async () => {
        networkCalls += 1;
        if (networkCalls === 1) throw new TypeError("connection reset");
        return Response.json({ok: true});
      },
    },
    {read: operation},
  );
  assert.deepEqual(await networkClient.request("read"), {ok: true});
  assert.equal(networkCalls, 2);

  let abortedCalls = 0;
  const controller = new AbortController();
  const abortedClient = new OperationClient(
    {
      baseUrl: "https://api.example.test",
      tokenProvider: {getToken: async () => ({accessToken: "trusted", expiresAt: Date.now() + 60_000})},
      fetch: async (_url, request) => {
        abortedCalls += 1;
        await new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {once: true});
          controller.abort();
        });
      },
    },
    {read: operation},
  );
  await assert.rejects(abortedClient.request("read", {signal: controller.signal}), (error) => {
    assert(error instanceof AetherError);
    assert.equal(error.code, "request_aborted");
    return true;
  });
  assert.equal(abortedCalls, 1);
});

test("unauthorized requests refresh credentials at most once", async () => {
  let fetchCalls = 0;
  let invalidations = 0;
  const client = new OperationClient(
    {
      baseUrl: "https://api.example.test",
      tokenProvider: {
        getToken: async () => ({accessToken: `token_${invalidations}`, expiresAt: Date.now() + 60_000}),
        invalidate: () => { invalidations += 1; },
      },
      fetch: async () => {
        fetchCalls += 1;
        return Response.json({error: {code: "invalid_token", message: "unauthorized"}}, {status: 401});
      },
    },
    {read: {method: "GET", path: "/v1/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200]}},
  );

  await assert.rejects(client.request("read"), (error) => error instanceof AetherError && error.status === 401);
  assert.equal(invalidations, 1);
  assert.equal(fetchCalls, 2);
});

test("cursor pagination yields every item and forwards cursors", async () => {
  const cursors = [];
  const values = [];
  for await (const value of paginateCursor(async (cursor) => {
    cursors.push(cursor);
    if (!cursor) return {items: [1, 2], nextCursor: "page_2"};
    return {items: [3], nextCursor: null};
  })) {
    values.push(value);
  }

  assert.deepEqual(cursors, [undefined, "page_2"]);
  assert.deepEqual(values, [1, 2, 3]);
});

test("cursor pagination rejects repeated cursors and page-limit overflow", async () => {
  await assert.rejects(
    async () => {
      for await (const _value of paginateCursor(async () => ({items: [], nextCursor: "same"}))) {
        void _value;
      }
    },
    (error) => {
      assert(error instanceof CursorPaginationError);
      assert.equal(error.code, "repeated_cursor");
      return true;
    },
  );

  await assert.rejects(
    async () => {
      for await (const _value of paginateCursor(
        async (cursor) => ({items: [], nextCursor: cursor ? `${cursor}_next` : "page_2"}),
        {maxPages: 1},
      )) {
        void _value;
      }
    },
    (error) => {
      assert(error instanceof CursorPaginationError);
      assert.equal(error.code, "max_pages_exceeded");
      return true;
    },
  );
});
