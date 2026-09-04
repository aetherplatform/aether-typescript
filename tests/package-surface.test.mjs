import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import * as core from "../packages/core/dist/index.js";
import * as coreServer from "../packages/core/dist/server.js";
import * as webhooks from "../packages/webhooks/dist/index.js";
import * as webhooksServer from "../packages/webhooks/dist/server.js";

test("browser-safe roots exclude server credential and cryptographic helpers", async () => {
  assert.equal("ClientCredentialsTokenProvider" in core, false);
  assert.equal("verifyWebhookSignature" in webhooks, false);
  assert.equal(typeof coreServer.ClientCredentialsTokenProvider, "function");
  assert.equal(typeof webhooksServer.verifyWebhookSignature, "function");

  for (const path of [
    new URL("../packages/core/dist/index.js", import.meta.url),
    new URL("../packages/webhooks/dist/index.js", import.meta.url),
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /node:/);
    assert.doesNotMatch(source, /\bBuffer\b/);
  }
});

test("preview packages declare an explicit ESM-only root export", async () => {
  for (const packageName of ["core", "identity", "events", "notifications", "storage", "webhooks"]) {
    const manifest = JSON.parse(
      await readFile(new URL(`../packages/${packageName}/package.json`, import.meta.url), "utf8"),
    );
    assert.equal(manifest.type, "module");
    assert.equal(typeof manifest.exports["."].import, "string");
    assert.equal("require" in manifest.exports["."], false);
  }
});
