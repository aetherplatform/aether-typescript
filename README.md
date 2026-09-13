# Aether TypeScript SDK Preview

This workspace contains the TypeScript SDK for the Aether managed platform.
Core, Identity, Events, Notifications, Storage, and Webhooks are published under
the `@aetherplatform` scope at **`0.1.0-beta.1.2`**. As of 2026-09-13,
`next` points to this preview. Pin the exact version; npm tags do not imply
a stable release.
Use this corrected version for new integrations and pin the version during
evaluation:

```sh
npm install --save-exact @aetherplatform/events@0.1.0-beta.1.2
```

Install the platform packages you need; each depends on the matching Core
version. The public repository is
[`aetherplatform/aether-typescript`](https://github.com/aetherplatform/aether-typescript).
The initial bootstrap is complete. Subsequent releases use protected npm
trusted publishing and must pass the hosted sandbox gate for each candidate.

Passwordless support is included in `0.1.0-beta.1.2`. Controlled sandbox email
acceptance passed for public clients, confidential clients, and hosted browser
consent approval/denial, including a flow using both TypeScript and Go SDKs.
It requires an enabled registered client and configured delivery in the target
Identity environment. SMS methods are included, but real SMS provider delivery
remains unverified.

The SDK contains only public wire contracts and customer-safe behavior. It does
not contain service-JWT signing, Aether runtime modules, NATS subjects,
deployment configuration, or product-specific models.

Use the public endpoints supplied for your integration. The preview sandbox
uses:

```text
API base URL: https://api-sandbox.useaether.co
OIDC issuer:  https://auth-sandbox.useaether.co
```

Generated platform operations use `/v1/{platform}/...`. `/api/v1/...` is an
internal service-router detail and is not a supported customer endpoint.

For source development, run these commands from the repository root:

```sh
npm ci --ignore-scripts
npm run generate
npm test
npm run test:package
npm run test:sandbox
npm run release:plan
```

Node.js 20 or newer is required. CommonJS is not supported by this preview;
the package is ESM-only and CI covers Node.js 20, 22, and 24. Browser-safe clients
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

The one-time `.github/workflows/bootstrap-release.yml` workflow is disabled and
its temporary npm token has been removed. All six packages have `release.yml`
configured as their trusted publisher, and `AETHER_SDK_RELEASE_ENABLED=true`
enables the permanent workflow. It rejects npm tokens and uses only GitHub OIDC.
See the [protected verification run](https://github.com/aetherplatform/aether-typescript/actions/runs/34786793039)
for the completed release checks. npm exposes provenance for each published
package version.

Every future release still requires the hosted-sandbox checks. OpenAPI
`sandbox` and `live` availability metadata describes the supported account
modes; it is not proof
that a public environment is deployed. No availability, zero-downtime,
deprecation-window, or long-term compatibility commitment applies to the `0.x`
line. Security emergencies may require immediate credential, endpoint, or
preview-version retirement.

Versioning, changelog automation, release channels, package coordination, and
publication gates are defined in
[`VERSIONING.md`](VERSIONING.md).
