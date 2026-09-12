import assert from "node:assert/strict";
import test from "node:test";
import {AetherError} from "../packages/core/dist/index.js";

import {EventsClient, operations as eventsOperations} from "../packages/events/dist/index.js";
import {NotificationsClient, operations as notificationOperations} from "../packages/notifications/dist/index.js";
import {WebhooksClient, operations as webhookOperations} from "../packages/webhooks/dist/index.js";

const tokenProvider = {
  getToken: async () => ({accessToken: "sdk-token", expiresAt: Date.now() + 60_000}),
};

test("Webhooks retries only with a nonblank idempotency key in the serialized body", async () => {
  for (const body of [
    {type: "example", data: {}},
    {type: "example", data: {}, idempotency_key: undefined},
    {type: "example", data: {}, idempotency_key: ""},
    {type: "example", data: {}, idempotency_key: "  \t"},
    {type: "example", data: {}, idempotency_key: "key", toJSON() { return {type: this.type, data: this.data}; }},
    {type: "example", data: {}, idempotency_key: "event-123"},
  ]) {
    const bodies = [];
    const client = new WebhooksClient({baseUrl: "https://api.example", tokenProvider, fetch: async (_url, request) => {
      bodies.push(request.body);
      if (bodies.length === 1) return Response.json({error: {code: "temporarily_unavailable"}}, {status: 503, headers: {"retry-after": "0"}});
      return Response.json({accepted: true}, {status: 202});
    }});
    const key = JSON.parse(JSON.stringify(body)).idempotency_key;
    const safe = typeof key === "string" && key.trim().length > 0;
    if (safe) await client.request("publishWebhookEvent", {body});
    else await assert.rejects(client.request("publishWebhookEvent", {body}), AetherError);
    assert.equal(bodies.length, safe ? 2 : 1);
    assert(bodies.every((sent) => sent === JSON.stringify(body)));
  }
});

test("platform clients contain only approved public route families", () => {
  assert.equal(Object.keys(eventsOperations).length, 3);
  assert.equal(Object.keys(notificationOperations).length, 29);
  assert.equal(Object.keys(webhookOperations).length, 19);

  for (const operation of Object.values(eventsOperations)) {
    assert.match(operation.path, /^\/v1\/events\//);
    assert.doesNotMatch(operation.path, /consumer-groups/);
  }
  for (const operation of Object.values(notificationOperations)) {
    assert.match(operation.path, /^\/v1\/notifications\//);
    assert.doesNotMatch(operation.path, /\/(inbox|devices|preferences)(\/|$)/);
  }
  for (const operation of Object.values(webhookOperations)) {
    assert.match(operation.path, /^\/v1\/webhooks\//);
  }
});

test("Events encodes event names and numeric schema versions", async () => {
  let requested;
  const client = new EventsClient({
    baseUrl: "https://api.useather.test",
    tokenProvider,
    fetch: async (url) => {
      requested = String(url);
      return Response.json({data: {type: "storage.object.created", version: 2, schema: {}}});
    },
  });

  await client.request("getEventSchema", {path: {type: "storage.object.created", version: 2}});
  assert.equal(requested, "https://api.useather.test/v1/events/schemas/storage.object.created/2");
});

test("Notifications and Webhooks use their public gateway prefixes", async () => {
  const requested = [];
  const fetch = async (url) => {
    requested.push(String(url));
    return Response.json({data: [], total: 0});
  };
  const notifications = new NotificationsClient({baseUrl: "https://api.useather.test", tokenProvider, fetch});
  const webhooks = new WebhooksClient({baseUrl: "https://api.useather.test", tokenProvider, fetch});

  await notifications.request("listNotificationTemplates");
  await webhooks.request("listWebhookSubscriptions");

  assert.match(requested[0], /^https:\/\/api\.useather\.test\/v1\/notifications\//);
  assert.match(requested[1], /^https:\/\/api\.useather\.test\/v1\/webhooks\//);
});
