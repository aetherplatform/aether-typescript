# Changelog

## 0.1.0-beta.1.1

### Patch Changes

- 3b6a409: Keep request timeouts and caller cancellation active until response bodies
  finish reading. Return a typed `invalid_response` error for malformed JSON
  while preserving empty and 204 responses. Retry webhook publishing only when
  the serialized request contains a nonblank idempotency key, and reuse the same
  serialized body across attempts.

## 0.1.0-beta.1

### Added

- Initial public beta of Aether Core.
- Browser-safe HTTP operations, typed errors, bounded retry behavior, request
  identifiers, and cursor pagination.
- Server-only client-credentials token provider with single-flight caching,
  secret redaction, bounded transient retries, and no client-side scope
  authority.
