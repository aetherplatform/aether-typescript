import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import test from "node:test";

import {AetherError, OperationClient} from "../packages/core/dist/index.js";

const operation = {method: "GET", path: "/example", tokenProfiles: [], requiredCapability: null, availability: [], idempotency: "not_applicable", successStatuses: [200, 204]};
const tokenProvider = {getToken: async () => ({accessToken: "token", expiresAt: Date.now() + 60_000})};

for (const mode of ["timeout", "caller abort"]) {
  test(`response body remains covered by ${mode} after headers arrive`, async (t) => {
    const caller = new AbortController();
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(200, {"content-type": "application/json"});
      response.flushHeaders();
      // Let the old implementation finish too, so a regression fails instead of hanging.
      const timer = setTimeout(() => response.end('{"ok":true}'), 500);
      response.on("close", () => clearTimeout(timer));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => { server.closeAllConnections(); server.close(); });
    const client = new OperationClient({
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      tokenProvider,
      timeoutMs: mode === "timeout" ? 100 : 2_000,
      maxRetries: mode === "timeout" ? 0 : 2,
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (mode === "caller abort") setTimeout(() => caller.abort(), 20);
        return response;
      },
    }, {read: operation});
    await assert.rejects(client.request("read", {signal: caller.signal}), (error) => {
      assert(error instanceof AetherError);
      assert.equal(error.code, mode === "timeout" ? "request_timeout" : "request_aborted");
      return true;
    });
    assert.equal(requests, 1);
  });
}

test("malformed success JSON is a typed error, while empty responses remain valid", async () => {
  for (const [text, status, expected] of [["{broken json", 200, "invalid_response"], ["", 200, undefined], [null, 204, undefined]]) {
    let calls = 0;
    const client = new OperationClient({baseUrl: "https://api.example", tokenProvider, fetch: async () => {
      calls += 1;
      return new Response(text, {status, headers: {"x-request-id": "req_json"}});
    }}, {read: operation});
    if (expected) {
      await assert.rejects(client.request("read"), (error) => error instanceof AetherError && error.code === expected && error.status === 200 && error.requestId === "req_json");
    } else {
      assert.equal(await client.request("read"), undefined);
    }
    assert.equal(calls, 1);
  }
});

test("a safe request can retry a connection failure while consuming its body", async () => {
  let calls = 0;
  const client = new OperationClient({baseUrl: "https://api.example", tokenProvider, fetch: async () => {
    calls += 1;
    if (calls === 1) return new Response(new ReadableStream({start(controller) { controller.error(new TypeError("connection reset")); }}));
    return Response.json({ok: true});
  }}, {read: operation});
  assert.deepEqual(await client.request("read"), {ok: true});
  assert.equal(calls, 2);
});
