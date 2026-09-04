# Aether TypeScript SDK Preview

This workspace contains the TypeScript SDK for the Aether managed platform.
The GitHub and npm organizations, public package boundary, publisher name, and
release policy are locked. Publication remains blocked until the hosted sandbox
release gate passes and npm trusted publishing is connected. The approved
public scope is `@aetherplatform`; the first public beta contains Core and
Storage at `0.1.0-beta.1` under the `next` dist-tag.

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

`npm run test:hosted-sandbox` runs the destructive-but-cleaned-up Storage proof
against a configured hosted sandbox. It requires
`AETHER_SDK_SANDBOX_TOKEN_URL`, `AETHER_SDK_SANDBOX_STORAGE_URL`,
`AETHER_SDK_SANDBOX_CLIENT_ID`, `AETHER_SDK_SANDBOX_CLIENT_SECRET`, and
`AETHER_SDK_SANDBOX_NAMESPACE_ID`. The client must have object create, read,
share, and delete capabilities in that sandbox namespace.

Core and Storage are the only publishable packages in the first beta. Identity,
Events, Notifications, and Webhooks remain private previews until they pass the
same public-contract and hosted-sandbox gates. No availability, zero-downtime,
deprecation-window, or long-term compatibility commitment applies to the `0.x`
line. Security emergencies may require immediate credential, endpoint, or
preview-version retirement.

Versioning, changelog automation, release channels, package coordination, and
publication gates are defined in
[`VERSIONING.md`](VERSIONING.md).
