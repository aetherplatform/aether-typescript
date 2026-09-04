import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

import {ClientCredentialsTokenProvider} from "../packages/core/dist/server.js";
import {
  StorageClient,
  downloadDirect,
  uploadObject,
  waitForObjectAvailable,
} from "../packages/storage/dist/index.js";

const tokenUrl = required("AETHER_SDK_SANDBOX_TOKEN_URL");
const storageUrl = required("AETHER_SDK_SANDBOX_STORAGE_URL");
const clientId = required("AETHER_SDK_SANDBOX_CLIENT_ID");
const clientSecret = required("AETHER_SDK_SANDBOX_CLIENT_SECRET");
const namespaceId = required("AETHER_SDK_SANDBOX_NAMESPACE_ID");
const runId = randomUUID();
const payload = new TextEncoder().encode(`Aether hosted SDK sandbox proof ${runId}`);
const sha256 = createHash("sha256").update(payload).digest("hex");
const tokenProvider = new ClientCredentialsTokenProvider({
  tokenUrl,
  clientId,
  clientSecret,
  audience: "aether-storage",
  scope: [
    "storage:objects/*:create",
    "storage:objects/*:delete",
    "storage:objects/*:read",
    "storage:objects/*:share",
  ],
});
const storage = new StorageClient({baseUrl: storageUrl, tokenProvider, timeoutMs: 15_000});
let objectId;

try {
  const result = await uploadObject(
    storage,
    {
      namespace_id: namespaceId,
      logical_key: `sdk-proof/${runId}.txt`,
      filename: `${runId}.txt`,
      content_type: "text/plain",
      expected_size: payload.byteLength,
      client_sha256: sha256,
    },
    payload,
    {
      idempotencyKeys: {
        create: `sdk-proof-create-${runId}`,
        complete: `sdk-proof-complete-${runId}`,
        abort: `sdk-proof-abort-${runId}`,
      },
      sha256,
    },
  );
  objectId = result.intent.object_id;

  const available = await waitForObjectAvailable(storage, objectId, {
    pollIntervalMs: 1_000,
    timeoutMs: 120_000,
  });
  assert.equal(available.status, "available");
  assert.equal(available.sha256?.toLowerCase(), sha256);

  const intent = await storage.request("createObjectDownloadIntent", {path: {object_id: objectId}});
  const downloaded = new Uint8Array(await downloadDirect(intent.download_url));
  assert.deepEqual(downloaded, payload);
  console.log(`Hosted SDK sandbox proof passed for object ${objectId}.`);
} finally {
  if (objectId) {
    await storage.request("deleteObject", {
      path: {object_id: objectId},
      idempotencyKey: `sdk-proof-delete-${runId}`,
    });
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}
