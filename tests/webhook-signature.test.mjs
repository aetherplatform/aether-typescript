import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  WebhookSignatureError,
  verifyWebhookSignature,
} from "../packages/webhooks/dist/server.js";

const vectors = JSON.parse(await readVectors());

for (const vector of vectors.valid) {
  test(`webhook signature vector: ${vector.name}`, () => {
    assert.deepEqual(
      verifyWebhookSignature(vector.payload, vector.header, vector.secret, {
        nowSeconds: vector.now_seconds,
      }),
      {timestamp: vector.timestamp},
    );
  });
}

for (const vector of vectors.invalid) {
  test(`webhook signature vector: ${vector.name}`, () => {
    assert.throws(
      () =>
        verifyWebhookSignature(vector.payload, vector.header, vector.secret, {
          nowSeconds: vector.now_seconds,
        }),
      (error) => {
        assert(error instanceof WebhookSignatureError);
        assert.equal(error.code, vector.error);
        return true;
      },
    );
  });
}

test("webhook signature verification supports raw byte payloads", () => {
  const vector = vectors.valid[0];
  const payload = new TextEncoder().encode(vector.payload);

  assert.deepEqual(
    verifyWebhookSignature(payload, vector.header, vector.secret, {
      nowSeconds: vector.now_seconds,
    }),
    {timestamp: vector.timestamp},
  );
});

test("webhook signature verification rejects invalid verifier configuration", () => {
  const vector = vectors.valid[0];

  assert.throws(
    () => verifyWebhookSignature(vector.payload, vector.header, "", {nowSeconds: vector.now_seconds}),
    TypeError,
  );
  assert.throws(
    () => verifyWebhookSignature(vector.payload, vector.header, vector.secret, {toleranceSeconds: -1}),
    RangeError,
  );
});

async function readVectors() {
  const candidates = [
    new URL("../contracts/webhooks/signatures/v1/vectors.json", import.meta.url),
    new URL("../../../contracts/webhooks/signatures/v1/vectors.json", import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }

  throw new Error("webhook signature vectors were not found");
}
