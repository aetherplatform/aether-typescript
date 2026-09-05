import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

import {ClientCredentialsTokenProvider} from "../packages/core/dist/server.js";
import {EventsClient} from "../packages/events/dist/index.js";
import {IdentityClient} from "../packages/identity/dist/index.js";
import {NotificationsClient} from "../packages/notifications/dist/index.js";
import {
  StorageClient,
  downloadDirect,
  uploadObject,
  waitForObjectAvailable,
} from "../packages/storage/dist/index.js";
import {WebhooksClient} from "../packages/webhooks/dist/index.js";

const tokenUrl = required("AETHER_SDK_SANDBOX_TOKEN_URL");
const identityUrl = required("AETHER_SDK_SANDBOX_IDENTITY_URL");
const eventsUrl = required("AETHER_SDK_SANDBOX_EVENTS_URL");
const notificationsUrl = required("AETHER_SDK_SANDBOX_NOTIFICATIONS_URL");
const storageUrl = required("AETHER_SDK_SANDBOX_STORAGE_URL");
const webhooksUrl = required("AETHER_SDK_SANDBOX_WEBHOOKS_URL");
const clientId = required("AETHER_SDK_SANDBOX_CLIENT_ID");
const clientSecret = required("AETHER_SDK_SANDBOX_CLIENT_SECRET");
const namespaceId = required("AETHER_SDK_SANDBOX_NAMESPACE_ID");
const runId = randomUUID();
const payload = new TextEncoder().encode(`Aether hosted SDK sandbox proof ${runId}`);
const sha256 = createHash("sha256").update(payload).digest("hex");

await checkIdentity();
await checkEvents();
await checkNotifications();
await checkWebhooks();
await checkStorage();
console.log("Hosted TypeScript SDK sandbox proof passed for all five Aether platforms.");

async function checkIdentity() {
  const identity = new IdentityClient({baseUrl: identityUrl});
  const discovery = await identity.getOpenIdConfiguration();
  assert.equal(discovery.id_token_signing_alg_values_supported?.[0], "EdDSA");
  assert.equal(discovery.id_token_signing_alg_values_supported?.includes("RS256"), true);
  assert.ok((await identity.getOAuthJwks()).keys.length > 0);
}

async function checkEvents() {
  const events = new EventsClient({
    baseUrl: eventsUrl,
    tokenProvider: provider(required("AETHER_SDK_SANDBOX_EVENTS_AUDIENCE"), ["events:catalog/*:read"]),
  });
  await events.request("listEventTypes");
}

async function checkNotifications() {
  const notifications = new NotificationsClient({
    baseUrl: notificationsUrl,
    tokenProvider: provider(required("AETHER_SDK_SANDBOX_NOTIFICATIONS_AUDIENCE"), ["notifications:templates/*:read"]),
  });
  await notifications.request("listNotificationTemplates");
}

async function checkWebhooks() {
  const webhooks = new WebhooksClient({
    baseUrl: webhooksUrl,
    tokenProvider: provider(required("AETHER_SDK_SANDBOX_WEBHOOKS_AUDIENCE"), ["webhooks:subscriptions/*:read"]),
  });
  await webhooks.request("listWebhookSubscriptions");
}

async function checkStorage() {
  const storage = new StorageClient({
    baseUrl: storageUrl,
    tokenProvider: provider(required("AETHER_SDK_SANDBOX_STORAGE_AUDIENCE"), [
      "storage:objects/*:create",
      "storage:objects/*:delete",
      "storage:objects/*:read",
      "storage:objects/*:share",
    ]),
    timeoutMs: 15_000,
  });
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
  } finally {
    if (objectId) {
      await storage.request("deleteObject", {
        path: {object_id: objectId},
        idempotencyKey: `sdk-proof-delete-${runId}`,
      });
    }
  }
}

function provider(audience, scope) {
  return new ClientCredentialsTokenProvider({tokenUrl, clientId, clientSecret, audience, scope});
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}
