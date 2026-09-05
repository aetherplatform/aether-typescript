# Changelog

All notable customer-visible changes to the Aether TypeScript SDK are recorded
here. Package-level changelogs remain authoritative for package-specific
versions.

The format follows Keep a Changelog concepts and Semantic Versioning.

## 0.1.0-beta.1

### Added

- Initial public beta boundary for `@aetherplatform/core`,
  `@aetherplatform/identity`, `@aetherplatform/events`,
  `@aetherplatform/notifications`, `@aetherplatform/storage`, and
  `@aetherplatform/webhooks`.
- Client-credentials token management, typed errors, bounded retries, request
  identifiers, cursor pagination, and browser/server export separation.
- Direct single-part and multipart Storage uploads, completion and abort
  handling, availability polling, download helpers, and source-free package
  verification.
- OAuth/OIDC discovery, PKCE, pairwise userinfo, and server-only confidential
  Identity operations.
- Allowlisted Events, Notifications, and Webhooks clients plus server-only
  webhook delivery-signature verification.
