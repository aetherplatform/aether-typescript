# `@aetherplatform/events`

Typed read-only access to the public Aether event catalog and governed schemas.

```ts
import {EventsClient} from "@aetherplatform/events";

const events = new EventsClient({baseUrl, tokenProvider});
const catalog = await events.request("listEventTypes");
const schema = await events.request("getEventSchema", {
  path: {type: "storage.object.created", version: 1},
});
```

The package exposes exactly three approved public operations. Raw NATS
credentials, event publication internals, and consumer-group administration
are deliberately excluded.
