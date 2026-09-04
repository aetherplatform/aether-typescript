# Aether Webhooks SDK Preview

Typed customer management operations. Provider ingress and internal replay or
repair infrastructure are not exposed.

Import `verifyWebhookSignature` from `@aetherplatform/webhooks/server`. It
verifies outbound Aether deliveries against the exact raw request body and
`X-Aether-Signature` header. It enforces the five-minute timestamp tolerance by
default, accepts either signature during secret rotation, and uses a
constant-time digest comparison. Verify before parsing or changing the request
body. The root package export remains browser-safe and contains management
operations only.
