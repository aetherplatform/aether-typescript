# Changelog

## 0.1.0-beta.1.2

### Minor Changes

- c301fcc: Add public email/SMS passwordless authentication for browser, mobile HTTP and backend clients. Native challenge methods return explicit OAuth authorization or hosted/custom completion outcomes. Add secretless public-client token exchange, refresh and revocation, Web Crypto PKCE generation, and strict callback validation. Keep confidential credentials in the server entry point, disable automatic retries for authentication mutations, and discard sensitive upstream error details.

  This change requires the corresponding Aether Identity runtime and approved beta-client policy. It does not imply hosted email/SMS delivery is enabled or verified. Publish through the existing fixed-package prerelease workflow under a new immutable beta version after the hosted release gate passes.

### Patch Changes

- @aetherplatform/core@0.1.0-beta.1.2

## 0.1.0-beta.1.1

### Patch Changes

- Updated dependencies [3b6a409]
  - @aetherplatform/core@0.1.0-beta.1.1

## 0.1.0-beta.1

### Added

- OAuth 2.0 Authorization Code with mandatory PKCE URL construction.
- OpenID Connect discovery, mixed Ed25519/RSA JWKS, scope catalog, and userinfo helpers.
- Server-only confidential-client token exchange, revocation, and introspection.
- Bounded discovery retries, one-time userinfo token refresh, and secret redaction.
