---
"@aetherplatform/core": patch
---

Keep request timeouts and caller cancellation active until response bodies
finish reading. Return a typed `invalid_response` error for malformed JSON
while preserving empty and 204 responses. Retry webhook publishing only when
the serialized request contains a nonblank idempotency key, and reuse the same
serialized body across attempts.
