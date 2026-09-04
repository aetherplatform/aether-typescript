import assert from "node:assert/strict";
import test from "node:test";

import {operations as identity} from "../packages/identity/dist/generated.js";
import {operations as events} from "../packages/events/dist/generated.js";
import {operations as notifications} from "../packages/notifications/dist/generated.js";
import {operations as storage} from "../packages/storage/dist/generated.js";
import {operations as webhooks} from "../packages/webhooks/dist/generated.js";

test("generated clients expose exactly the approved public operations", () => {
  assert.equal(Object.keys(identity).length, 8);
  assert.equal(Object.keys(events).length, 3);
  assert.equal(Object.keys(notifications).length, 29);
  assert.equal(Object.keys(storage).length, 18);
  assert.equal(Object.keys(webhooks).length, 19);
});

test("private platform routes are absent from generated clients", () => {
  assert.equal("listConsumerGroups" in events, false);
  assert.equal("listInbox" in notifications, false);
  assert.equal("migrateProvider" in storage, false);
  assert.equal("ingestProviderWebhook" in webhooks, false);
  assert.equal("passwordLogin" in identity, false);
});

test("public generated metadata never advertises service tokens", () => {
  for (const catalog of [identity, events, notifications, storage, webhooks]) {
    for (const operation of Object.values(catalog)) {
      assert.equal(operation.tokenProfiles.includes("service_v1"), false);
    }
  }
});

test("generated retry metadata preserves runtime idempotency", () => {
  assert.equal(storage.createNamespace.idempotency, "required");
  assert.equal(notifications.sendNotification.idempotency, "unsupported");
  assert.equal(webhooks.publishWebhookEvent.idempotency, "request_field");
});
