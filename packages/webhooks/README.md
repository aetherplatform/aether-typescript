# `@aetherplatform/webhooks`

Typed customer operations for webhook subscriptions, deliveries, replay, and
inbound endpoints.

```ts
import {WebhooksClient} from "@aetherplatform/webhooks";

const webhooks = new WebhooksClient({baseUrl, tokenProvider});
const subscriptions = await webhooks.request("listWebhookSubscriptions");
```

Delivery signature verification is server-only:

```ts
import {verifyWebhookSignature} from "@aetherplatform/webhooks/server";

const verified = verifyWebhookSignature(rawBody, signatureHeader, secret);
```

Verification uses the exact raw body, enforces a five-minute timestamp
tolerance by default, accepts either valid signature during secret rotation,
and compares HMAC-SHA256 digests in constant time. Provider ingress and
internal repair infrastructure are excluded from the public package.
