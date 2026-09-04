// Generated from the canonical Aether OpenAPI contract. Do not edit.
// Source: contracts/openapi/v1/events.yaml

export type EventType = { id: string; name: string; producer: string; description: string; lifecycle: string; current_version: number; versions: Array<number>; };

export type EventTypeDetail = (EventType) & ({ consumer_groups: Array<{ name: string; durable_name: string; stream: string; filter: string; max_deliver: number; members: number; }>; });

export type EventSchema = { type: string; version: number; schema: { [key: string]: unknown; }; };

export interface EventsOperations {
  getEventSchema: {
    request: never;
    response: { data: EventSchema; };
    path: { type: string; version: number; };
    query: Record<string, never>;
  };
  getEventType: {
    request: never;
    response: { data: EventTypeDetail; };
    path: { type: string; };
    query: Record<string, never>;
  };
  listEventTypes: {
    request: never;
    response: { data: Array<EventType>; };
    path: Record<string, never>;
    query: Record<string, never>;
  };
}

export const operations = {
  getEventSchema: {
    method: "GET",
    path: "/v1/events/schemas/{type}/{version}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "events:schemas/{type}/{version}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getEventType: {
    method: "GET",
    path: "/v1/events/catalog/{type}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "events:catalog/{type}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listEventTypes: {
    method: "GET",
    path: "/v1/events/catalog",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "events:catalog/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
} as const;
