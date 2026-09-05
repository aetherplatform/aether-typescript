# Aether TypeScript SDK Preview

This workspace contains the TypeScript SDK for the Aether managed platform.
The GitHub and npm organizations, public package boundary, publisher name, and
release policy are locked. Publication remains blocked until the hosted sandbox
release gate passes. Because npm trusted publishers can only be configured from
an existing package's settings, the first package creation uses the dedicated,
reviewer-gated bootstrap workflow with a short-lived granular npm token. The
token is deleted immediately after the six SDK packages exist; all subsequent
releases use npm trusted publishing. The approved public scope is
`@aetherplatform`; the first public beta contains Core, Identity, Events,
Notifications, Storage, and Webhooks at `0.1.0-beta.1` under the `next`
dist-tag.

The SDK contains only public wire contracts and customer-safe behavior. It does
not contain service-JWT signing, Aether runtime modules, NATS subjects,
deployment configuration, or product-specific models.

Use the public Aether endpoints:

```text
API base URL: https://api.<domain>
OIDC issuer:  https://auth.<domain>
```

Generated platform operations use `/v1/{platform}/...`. `/api/v1/...` is an
internal service-router detail and is not a supported customer endpoint.

```sh
npm install
npm run generate
npm test
npm run test:package
npm run test:sandbox
npm run release:plan
```

Node.js 20 or newer is required. CommonJS is not supported by this preview;
the package is ESM-only and is tested on Node.js 20 and 22. Browser-safe clients
use each package root. Client-secret and Node.js cryptographic helpers are
available only from explicit `/server` entry points. This policy must be
revisited before `1.0.0` together with the supported runtime and deprecation
policy.

The client-credentials provider caches tokens with expiry skew, coalesces
concurrent acquisition, and performs at most one transient retry by default.
It never retries invalid credentials or `quota_exceeded`. Requested
capabilities are sent through OAuth's `scope` parameter, but the returned token
object contains only the opaque token value and expiry; the SDK does not treat
requested scopes as proof of authorization.

`npm run test:hosted-sandbox` validates Identity discovery and mixed JWKS,
Events catalog reads, Notifications template reads, Webhooks subscription
reads, and the destructive-but-cleaned-up Storage object lifecycle. It requires
the five platform base URLs, four platform audiences, the token URL, one
confidential sandbox client, and a disposable Storage namespace. Exact variable
names are documented in the versioning policy.

The one-time `.github/workflows/bootstrap-release.yml` workflow remains disabled
unless `AETHER_SDK_BOOTSTRAP_RELEASE_ENABLED=true` and the protected
`sdk-sandbox` environment contains `NPM_BOOTSTRAP_TOKEN`. After the first
publish, configure `release.yml` as the trusted publisher for all six packages,
delete the bootstrap token, disable the bootstrap gate, and enable
`AETHER_SDK_RELEASE_ENABLED=true`. The permanent release workflow rejects npm
tokens and uses only GitHub OIDC.

All six packages are structurally publishable, but release automation remains
disabled until every hosted-sandbox check passes. OpenAPI `sandbox` and `live`
availability metadata describes the supported account modes; it is not proof
that a public environment is deployed. No availability, zero-downtime,
deprecation-window, or long-term compatibility commitment applies to the `0.x`
line. Security emergencies may require immediate credential, endpoint, or
preview-version retirement.

Versioning, changelog automation, release channels, package coordination, and
publication gates are defined in
[`VERSIONING.md`](VERSIONING.md).
