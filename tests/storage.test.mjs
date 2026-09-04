import assert from "node:assert/strict";
import test from "node:test";

import {
  ObjectAvailabilityError,
  StorageTransferError,
  UploadWorkflowError,
  uploadMultipart,
  uploadObject,
  waitForObjectAvailable,
} from "../packages/storage/dist/index.js";

test("multipart upload slices bytes, bounds concurrency, and returns ordered ETags", async () => {
  const uploaded = new Map();
  let active = 0;
  let maximumActive = 0;
  const intent = multipartIntent();

  const parts = await uploadMultipart(intent, new TextEncoder().encode("abcdefgh"), {
    concurrency: 2,
    fetch: async (url, request) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      uploaded.set(url, Buffer.from(await new Response(request.body).arrayBuffer()).toString());
      active -= 1;
      return new Response(null, {status: 200, headers: {etag: `\"etag-${url.at(-1)}\"`}});
    },
  });

  assert.equal(maximumActive, 2);
  assert.deepEqual([...uploaded.entries()].sort(), [
    ["https://provider.example/part/1", "abc"],
    ["https://provider.example/part/2", "def"],
    ["https://provider.example/part/3", "gh"],
  ]);
  assert.deepEqual(parts, [
    {part_number: 1, etag: '"etag-1"'},
    {part_number: 2, etag: '"etag-2"'},
    {part_number: 3, etag: '"etag-3"'},
  ]);
});

test("multipart upload rejects missing ETags and mismatched body sizes", async () => {
  await assert.rejects(
    uploadMultipart(multipartIntent(), new TextEncoder().encode("abcdefgh"), {
      fetch: async () => new Response(null, {status: 200}),
    }),
    (error) => {
      assert(error instanceof StorageTransferError);
      assert.equal(error.code, "missing_etag");
      return true;
    },
  );

  await assert.rejects(
    uploadMultipart(multipartIntent(), new TextEncoder().encode("too short".slice(0, 2)), {
      fetch: async () => new Response(null, {status: 200, headers: {etag: "etag"}}),
    }),
    (error) => {
      assert(error instanceof StorageTransferError);
      assert.equal(error.code, "size_mismatch");
      return true;
    },
  );
});

test("upload workflow completes a single upload and waits for availability", async () => {
  const calls = [];
  let polls = 0;
  const client = {
    request: async (operation, options) => {
      calls.push([operation, options]);
      if (operation === "createUploadIntent") return singleIntent();
      if (operation === "completeUpload") return objectRecord("quarantined");
      if (operation === "getObject") {
        polls += 1;
        return objectRecord(polls === 1 ? "processing" : "available");
      }
      throw new Error(`unexpected operation ${operation}`);
    },
  };

  const payload = new TextEncoder().encode("hello");
  const result = await uploadObject(
    client,
    uploadRequest(payload.byteLength),
    payload,
    {
      fetch: async (_url, request) => {
        assert.equal(Buffer.from(await new Response(request.body).arrayBuffer()).toString(), "hello");
        return new Response(null, {status: 200});
      },
      idempotencyKeys: {create: "create", complete: "complete", abort: "abort"},
      waitForAvailability: {pollIntervalMs: 0, timeoutMs: 100},
    },
  );

  assert.equal(result.object.status, "available");
  assert.equal(polls, 2);
  assert.deepEqual(calls.map(([operation]) => operation), [
    "createUploadIntent",
    "completeUpload",
    "getObject",
    "getObject",
  ]);
});

test("upload workflow best-effort aborts an incomplete upload", async () => {
  const calls = [];
  const client = {
    request: async (operation) => {
      calls.push(operation);
      if (operation === "createUploadIntent") return singleIntent();
      if (operation === "abortUpload") return {upload_id: "upload_1", status: "aborted"};
      throw new Error(`unexpected operation ${operation}`);
    },
  };

  await assert.rejects(
    uploadObject(client, uploadRequest(5), new TextEncoder().encode("hello"), {
      fetch: async () => new Response(null, {status: 503}),
      idempotencyKeys: {create: "create", complete: "complete", abort: "abort"},
    }),
    (error) => {
      assert(error instanceof UploadWorkflowError);
      assert.equal(error.stage, "transfer");
      assert.equal(error.uploadId, "upload_1");
      assert.equal(error.cleanupError, undefined);
      assert(error.cause instanceof StorageTransferError);
      return true;
    },
  );
  assert.deepEqual(calls, ["createUploadIntent", "abortUpload"]);
});

test("upload workflow preserves completion and cleanup failures", async () => {
  const client = {
    request: async (operation) => {
      if (operation === "createUploadIntent") return singleIntent();
      if (operation === "completeUpload") throw new Error("completion unavailable");
      if (operation === "abortUpload") throw new Error("cleanup unavailable");
      throw new Error(`unexpected operation ${operation}`);
    },
  };

  await assert.rejects(
    uploadObject(client, uploadRequest(5), new TextEncoder().encode("hello"), {
      fetch: async () => new Response(null, {status: 200}),
      idempotencyKeys: {create: "create", complete: "complete", abort: "abort"},
    }),
    (error) => {
      assert(error instanceof UploadWorkflowError);
      assert.equal(error.stage, "complete");
      assert.equal(error.cause.message, "completion unavailable");
      assert.equal(error.cleanupError.message, "cleanup unavailable");
      return true;
    },
  );
});

test("availability polling reports deletion and timeout as typed errors", async () => {
  const deletedClient = {request: async () => objectRecord("deleted")};
  await assert.rejects(
    waitForObjectAvailable(deletedClient, "obj_1"),
    (error) => {
      assert(error instanceof ObjectAvailabilityError);
      assert.equal(error.code, "object_deleted");
      return true;
    },
  );

  const waitingClient = {request: async () => objectRecord("quarantined")};
  await assert.rejects(
    waitForObjectAvailable(waitingClient, "obj_1", {timeoutMs: 0}),
    (error) => {
      assert(error instanceof ObjectAvailabilityError);
      assert.equal(error.code, "availability_timeout");
      return true;
    },
  );
});

function multipartIntent() {
  return {
    upload_id: "upload_1",
    object_id: "obj_1",
    asset_id: null,
    version_number: 1,
    upload_strategy: "multipart",
    upload_url: null,
    expires_at: "2026-09-04T14:00:00Z",
    required_headers: {"x-required": "yes"},
    multipart: {
      provider_upload_id: "provider_1",
      part_size: 3,
      parts: [
        {part_number: 3, upload_url: "https://provider.example/part/3"},
        {part_number: 1, upload_url: "https://provider.example/part/1"},
        {part_number: 2, upload_url: "https://provider.example/part/2"},
      ],
    },
  };
}

function singleIntent() {
  return {
    upload_id: "upload_1",
    object_id: "obj_1",
    asset_id: null,
    version_number: 1,
    upload_strategy: "single",
    upload_url: "https://provider.example/upload",
    expires_at: "2026-09-04T14:00:00Z",
    required_headers: {"content-type": "text/plain"},
    multipart: null,
  };
}

function uploadRequest(expectedSize) {
  return {
    namespace_id: "ns_1",
    logical_key: "example.txt",
    filename: "example.txt",
    content_type: "text/plain",
    expected_size: expectedSize,
  };
}

function objectRecord(status) {
  return {
    id: "obj_1",
    asset_id: null,
    namespace_id: "ns_1",
    organization_id: "org_1",
    application_id: "app_1",
    account_mode: "sandbox",
    logical_key: "example.txt",
    version_number: 1,
    filename: "example.txt",
    content_type: "text/plain",
    detected_content_type: status === "available" ? "text/plain" : null,
    expected_size: 5,
    actual_size: status === "pending" ? null : 5,
    sha256: null,
    metadata: {},
    visibility: "private",
    status,
    created_at: "2026-09-04T14:00:00Z",
    available_at: status === "available" ? "2026-09-04T14:00:01Z" : null,
    deleted_at: status === "deleted" ? "2026-09-04T14:00:01Z" : null,
  };
}
