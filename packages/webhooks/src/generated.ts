// Generated from the canonical Aether OpenAPI contract. Do not edit.
// Source: contracts/openapi/v1/webhooks.yaml

export type JsonObject = ActionResult;

export type SubscriptionWrite = { url?: string; events?: Array<string>; enabled_events?: Array<string>; description?: string; status?: "active" | "disabled"; is_active?: boolean; api_version?: string; transport?: string; payload_version?: number; transform_spec?: ActionResult; retry_policy?: ActionResult; metadata?: ActionResult; };

export type Subscription = (SubscriptionWrite) & ({ id: string; account_mode?: "sandbox" | "live"; consecutive_failures?: number; last_success_at?: string | null; last_failure_at?: string | null; created_at: string; updated_at: string; });

export type SubscriptionEnvelope = { data: Subscription; };

export type SubscriptionSecretEnvelope = (SubscriptionEnvelope) & ({ secret: string; });

export type SubscriptionList = { data: Array<Subscription>; total: number; };

export type PublishEventRequest = { type: string; data: ActionResult; idempotency_key?: string; api_version?: string; };

export type PublishedEvent = { id: string; type: string; status: "dispatching"; created_at: string; };

export type Delivery = { id: string; subscription_id: string; event_id: string; attempt: number; url?: string; status_code?: number | null; duration_ms?: number | null; success: boolean; error_message?: string | null; attempted_at: string; };

export type DeliveryList = { data: Array<Delivery>; total: number; };

export type BulkReplayRequest = { subscription_id?: string; from?: string; to?: string; limit?: number; };

export type InboundEndpointWrite = { description?: string; status?: "active" | "disabled"; allowed_event_types?: Array<string>; };

export type InboundEndpoint = (InboundEndpointWrite) & ({ id: string; secret?: string; secret_rotated_at?: string | null; created_at: string; updated_at: string; });

export type InboundEndpointEnvelope = { data: InboundEndpoint; };

export type InboundEndpointList = { data: Array<InboundEndpoint>; };

export type HealthEnvelope = { data: { subscription_id: string; health: ActionResult | null; }; };

export type ActionResult = { [key: string]: unknown; };

export interface WebhooksOperations {
  bulkReplayWebhookDeliveries: {
    request: BulkReplayRequest;
    response: ActionResult;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createInboundEndpoint: {
    request: InboundEndpointWrite;
    response: InboundEndpointEnvelope;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createWebhookSubscription: {
    request: SubscriptionWrite;
    response: SubscriptionSecretEnvelope;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  deleteWebhookSubscription: {
    request: never;
    response: ActionResult;
    path: { id: string; };
    query: Record<string, never>;
  };
  getInboundEndpoint: {
    request: never;
    response: InboundEndpointEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  getWebhookSubscription: {
    request: never;
    response: SubscriptionEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  getWebhookSubscriptionHealth: {
    request: never;
    response: HealthEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  listInboundEndpoints: {
    request: never;
    response: InboundEndpointList;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  listWebhookDeliveries: {
    request: never;
    response: DeliveryList;
    path: { subscription_id: string; };
    query: { limit?: number; };
  };
  listWebhookSubscriptions: {
    request: never;
    response: SubscriptionList;
    path: Record<string, never>;
    query: { limit?: number; include?: "health"; };
  };
  patchWebhookSubscription: {
    request: SubscriptionWrite;
    response: SubscriptionEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  publishWebhookEvent: {
    request: PublishEventRequest;
    response: PublishedEvent;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  replaceWebhookSubscription: {
    request: SubscriptionWrite;
    response: SubscriptionEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  replayInboundEvent: {
    request: never;
    response: ActionResult;
    path: { id: string; };
    query: Record<string, never>;
  };
  replayWebhookDelivery: {
    request: never;
    response: ActionResult;
    path: { id: string; };
    query: Record<string, never>;
  };
  rotateInboundEndpointSecret: {
    request: never;
    response: InboundEndpointEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  rotateWebhookSubscriptionSecret: {
    request: never;
    response: SubscriptionSecretEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  setWebhookSubscriptionStatus: {
    request: { enabled?: boolean; is_active?: boolean; };
    response: SubscriptionEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
  updateInboundEndpoint: {
    request: InboundEndpointWrite;
    response: InboundEndpointEnvelope;
    path: { id: string; };
    query: Record<string, never>;
  };
}

export const operations = {
  bulkReplayWebhookDeliveries: {
    method: "POST",
    path: "/v1/webhooks/bulk-replay",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:deliveries/*:replay",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [202],
  },
  createInboundEndpoint: {
    method: "POST",
    path: "/v1/webhooks/inbound-endpoints",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-endpoints/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [201],
  },
  createWebhookSubscription: {
    method: "POST",
    path: "/v1/webhooks/subscriptions",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [201],
  },
  deleteWebhookSubscription: {
    method: "DELETE",
    path: "/v1/webhooks/subscriptions/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  getInboundEndpoint: {
    method: "GET",
    path: "/v1/webhooks/inbound-endpoints/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-endpoints/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getWebhookSubscription: {
    method: "GET",
    path: "/v1/webhooks/subscriptions/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getWebhookSubscriptionHealth: {
    method: "GET",
    path: "/v1/webhooks/subscriptions/{id}/health",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listInboundEndpoints: {
    method: "GET",
    path: "/v1/webhooks/inbound-endpoints",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-endpoints/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listWebhookDeliveries: {
    method: "GET",
    path: "/v1/webhooks/subscriptions/{subscription_id}/deliveries",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{subscription_id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listWebhookSubscriptions: {
    method: "GET",
    path: "/v1/webhooks/subscriptions",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  patchWebhookSubscription: {
    method: "PATCH",
    path: "/v1/webhooks/subscriptions/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  publishWebhookEvent: {
    method: "POST",
    path: "/v1/webhooks/events",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:events/*:publish",
    availability: ["sandbox","live"],
    idempotency: "request_field",
    successStatuses: [202],
  },
  replaceWebhookSubscription: {
    method: "PUT",
    path: "/v1/webhooks/subscriptions/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  replayInboundEvent: {
    method: "POST",
    path: "/v1/webhooks/inbound-events/{id}/replay",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-events/{id}:replay",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200,202],
  },
  replayWebhookDelivery: {
    method: "POST",
    path: "/v1/webhooks/deliveries/{id}/replay",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:deliveries/{id}:replay",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  rotateInboundEndpointSecret: {
    method: "POST",
    path: "/v1/webhooks/inbound-endpoints/{id}/rotate-secret",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-endpoints/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  rotateWebhookSubscriptionSecret: {
    method: "POST",
    path: "/v1/webhooks/subscriptions/{id}/rotate-secret",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  setWebhookSubscriptionStatus: {
    method: "PUT",
    path: "/v1/webhooks/subscriptions/{id}/status",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:subscriptions/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  updateInboundEndpoint: {
    method: "PATCH",
    path: "/v1/webhooks/inbound-endpoints/{id}",
    tokenProfiles: ["client_access_v1","api_key"],
    requiredCapability: "webhooks:inbound-endpoints/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
} as const;
