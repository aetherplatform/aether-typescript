---
"@aetherplatform/identity": minor
---

Add public email/SMS passwordless authentication for browser, mobile HTTP and backend clients. Native challenge methods return explicit OAuth authorization or hosted/custom completion outcomes. Add secretless public-client token exchange, refresh and revocation, Web Crypto PKCE generation, and strict callback validation. Keep confidential credentials in the server entry point, disable automatic retries for authentication mutations, and discard sensitive upstream error details.

This change requires the corresponding Aether Identity runtime and approved beta-client policy. It does not imply hosted email/SMS delivery is enabled or verified. Publish through the existing fixed-package prerelease workflow under a new immutable beta version after the hosted release gate passes.
