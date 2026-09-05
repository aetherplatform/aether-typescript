import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {AetherError, OperationClient, paginateCursor} from "../packages/core/dist/index.js";
import {uploadMultipart} from "../packages/storage/dist/index.js";

const tokenProvider = {getToken: async () => ({accessToken: "token", expiresAt: Date.now() + 60_000})};

test("shared error vectors", async () => {
  const vectors = await loadVector("error-vectors.json");
  for (const vector of vectors.cases) {
    const client = new OperationClient(
      {
        baseUrl: "https://api.useather.test",
        tokenProvider,
        maxRetries: 0,
        fetch: async () => new Response(JSON.stringify(vector.body), {status: vector.status, headers: vector.headers}),
      },
      {read: operation("GET", "/resource", "not_applicable")},
    );
    await assert.rejects(client.request("read"), (error) => {
      assert(error instanceof AetherError);
      assert.equal(error.code, vector.expected.code, vector.name);
      assert.equal(error.message, vector.expected.message, vector.name);
      assert.equal(error.requestId ?? "", vector.expected.request_id, vector.name);
      assert.equal(error.retry.retryAfterSeconds ?? 0, vector.expected.retry_after_seconds ?? 0, vector.name);
      assert.equal(error.retry.rateLimitLimit ?? 0, vector.expected.rate_limit_limit ?? 0, vector.name);
      assert.equal(error.retry.rateLimitRemaining ?? 0, vector.expected.rate_limit_remaining ?? 0, vector.name);
      assert.equal(error.retry.rateLimitReset ?? 0, vector.expected.rate_limit_reset ?? 0, vector.name);
      assert.equal(error.retry.quotaReset ?? "", vector.expected.quota_reset ?? "", vector.name);
      return true;
    });
  }
});

test("shared retry vectors", async () => {
  const vectors = await loadVector("retry-vectors.json");
  for (const vector of vectors.cases) {
    let requests = 0;
    const options = vector.has_idempotency_key ? {idempotencyKey: "idem"} : {};
    if (vector.code === "request_aborted") {
      const controller = new AbortController();
      controller.abort();
      options.signal = controller.signal;
    }
    const client = new OperationClient(
      {
        baseUrl: "https://api.useather.test",
        tokenProvider,
        maxRetries: 1,
        fetch: async () => {
          requests += 1;
          if (vector.status === 0) {
            throw vector.code === "request_aborted" ? new DOMException("Aborted", "AbortError") : new TypeError("network");
          }
          return new Response(JSON.stringify({error: {code: vector.code}}), {status: vector.status});
        },
      },
      {operation: operation(vector.method, "/resource", vector.idempotency)},
    );
    await assert.rejects(client.request("operation", options));
    assert.equal(requests === 2, vector.retry, vector.name);
  }
});

test("shared pagination vectors", async () => {
  const vectors = await loadVector("pagination-vectors.json");
  for (const vector of vectors.cases) {
    let index = 0;
    const consume = async () => {
      for await (const _item of paginateCursor(
        async () => ({items: [index], nextCursor: vector.cursors[index++]}),
        {maxPages: vector.max_pages},
      )) {
      }
    };
    if (vector.expected === "complete") await consume();
    else await assert.rejects(consume(), (error) => error?.code === vector.expected, vector.name);
  }
});

test("shared transport vectors", async () => {
  const vectors = await loadVector("transport-vectors.json");
  for (const vector of vectors.cases) {
    let requestedUrl;
    const client = new OperationClient(
      {
        baseUrl: vector.base_url,
        tokenProvider,
        fetch: async (url) => {
          requestedUrl = String(url);
          return new Response("{}", {status: 200});
        },
      },
      {operation: operation("GET", vector.path, "not_applicable")},
    );
    if (vector.error) await assert.rejects(client.request("operation", {path: vector.path_values, query: vector.query}));
    else {
      await client.request("operation", {path: vector.path_values, query: vector.query});
      assert.equal(requestedUrl, vector.expected, vector.name);
    }
  }
});

test("shared Storage transfer vectors", async () => {
  const vectors = await loadVector("storage-transfer-vectors.json");
  for (const vector of vectors.cases) {
    const intent = {
      upload_id: "upl_1",
      object_id: "obj_1",
      asset_id: null,
      version_number: 1,
      upload_strategy: "multipart",
      upload_url: null,
      expires_at: "2026-09-05T12:00:00Z",
      required_headers: {},
      multipart: {
        provider_upload_id: "provider_1",
        part_size: vector.part_size,
        parts: vector.part_numbers.map((part_number) => ({part_number, upload_url: `https://provider.useather.test/${part_number}`})),
      },
    };
    const uploadedSizes = [];
    const run = () => uploadMultipart(intent, new Uint8Array(vector.size), {
      fetch: async (_url, request) => {
        uploadedSizes.push((await new Response(request.body).arrayBuffer()).byteLength);
        return new Response(null, {status: 200, headers: {etag: '"etag"'}});
      },
    });
    if (!vector.valid) await assert.rejects(run(), undefined, vector.name);
    else {
      await run();
      const expectedSizes = vector.ranges.map(([start, end]) => end - start);
      assert.deepEqual(uploadedSizes.sort((left, right) => right - left), expectedSizes.sort((left, right) => right - left), vector.name);
    }
  }
});

function operation(method, path, idempotency) {
  return {
    method,
    path,
    tokenProfiles: ["client_access_v1"],
    requiredCapability: null,
    availability: ["sandbox"],
    idempotency,
    successStatuses: [200],
  };
}

async function loadVector(name) {
  const candidates = [
    new URL(`../../../contracts/sdk/v1/${name}`, import.meta.url),
    new URL(`../contracts/sdk/v1/${name}`, import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Unable to locate shared SDK vector ${name}`);
}
