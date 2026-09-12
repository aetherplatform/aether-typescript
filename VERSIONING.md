# Aether SDK Versioning and Release Policy

Status: locked for the initial TypeScript public beta

Public publisher: **Aether**

`Aether` is the public product and package-author display name. It does not
claim that a legal entity with that name has already been incorporated. The
verified human owners remain privately accountable through the GitHub and npm
organizations; package metadata does not need to publish a maintainer's
personal name. Legal notices can be updated when the operating company is
registered without renaming the npm scope or republishing old package versions.

Public contacts:

- Security: `security@useaether.co`
- SDK support: `support@useaether.co`
- Hosted sandbox: `api-sandbox.useaether.co`

## Public Package Boundary

The public TypeScript SDK uses the `@aetherplatform` npm scope and lives in the
public `aetherplatform/aether-typescript` repository.

The first public release contains:

- `@aetherplatform/core`
- `@aetherplatform/identity`
- `@aetherplatform/events`
- `@aetherplatform/notifications`
- `@aetherplatform/storage`
- `@aetherplatform/webhooks`

All six packages remain unpublished until their customer contracts and hosted
sandbox checks pass together. A package being marked publishable in source is
not evidence that its backing hosted API is currently available.

The SDK and approved public specifications use Apache License 2.0. Aether
backend services, deployment code, migrations, signing material, internal NATS
contracts, and operational evidence remain private and are not covered by the
SDK license.

The initial SDK is ESM-only and supports Node.js 20 and 22. Browser-safe APIs
use package root exports. Client-secret and Node.js-only cryptographic helpers
use explicit `/server` exports.

## Independent Version Dimensions

API and SDK versions solve different problems and do not advance together
automatically:

- Public HTTP contracts use path and token-profile versions such as `/v1`,
  `client_access v1`, and `user_access v1`.
- npm packages use Semantic Versioning.
- A new SDK release does not create a new API version.
- A backward-compatible API deployment does not require an SDK release unless
  generated types, helpers, documentation, or supported behavior change.

## Semantic Versioning

The TypeScript SDK follows Semantic Versioning and never republishes or mutates
an existing version.

### Before 1.0

- `0.1.0-beta.1` is the first public beta.
- Small fixes within beta.1 use `0.1.0-beta.1.1`, `0.1.0-beta.1.2`, and so on.
- Advancing to `0.1.0-beta.2` is a separate maintainer decision, not an
  automatic consequence of merging a fix.
- `0.1.0-rc.1` starts release-candidate validation.
- `0.1.0` is the first non-prerelease release on the initial-development
  (`0.x`) line.
- A materially expanded or intentionally incompatible preview starts a new
  minor line, for example `0.2.0-beta.1`.
- Every incompatible preview change must be called out prominently in the
  changelog even though SemVer permits breaking changes before `1.0.0`.
- Preview compatibility is best effort; there is no implied SLA or
  zero-downtime upgrade promise.
- `1.0.0` is the point where Aether declares the documented public SDK API
  stable and begins normal major/minor/patch compatibility commitments.

The expected first progression is:

```text
0.1.0-beta.1   first public beta
0.1.0-beta.1.1 first small fix within beta.1
0.1.0-beta.1.2 additional small fixes within beta.1
0.1.0-rc.1     release candidate
0.1.0          first non-prerelease 0.x release
1.0.0          stable public API commitment
```

### From 1.0

- Patch releases contain backward-compatible fixes only.
- Minor releases contain backward-compatible functionality.
- Major releases may contain breaking public API changes.
- Supported stable versions receive a documented deprecation period before
  removal, except when an urgent security response requires faster retirement.

## Prerelease Channels And npm Tags

| Stage | Version example | npm dist-tag | Purpose |
| --- | --- | --- | --- |
| Canary | `0.1.0-canary.20260904.abcdef0` | `canary` | Internal or explicitly invited validation only |
| Alpha | `0.1.0-alpha.1` | `next` | Incomplete public preview when needed |
| Beta | `0.1.0-beta.1` | `next` | Initial supported public evaluation |
| Initial release candidate | `0.1.0-rc.1` | `next` | Final validation of the first `0.x` release |
| Initial non-prerelease | `0.1.0` | `latest` | Production-usable initial-development release |
| Stable API | `1.0.0` | `latest` | Formal public compatibility commitment |

While a package has only preview versions, `next` and `latest` may both point
at its current approved preview. This accommodates npm retaining `latest` on
first publication and rejecting its deletion. The beta.1 fix release uses
`0.1.0-beta.1.1` on both tags. Once any non-prerelease version exists, `latest`
must point to a non-prerelease; later betas continue under `next` and preserve
stable `latest`. Verify both tags after publication. Automated tag readback
never attempts to delete npm's implicit tag. Security fixes are released
as new immutable versions; tags may move, package contents may not.

## Package Coordination

All six packages use synchronized versions during the initial beta. Every
platform package depends on the exact matching Core prerelease version so a
beta installation cannot resolve an untested Core combination.

After `1.0.0`, packages may adopt independent versions only when separate
release cadence creates clear customer value. Stable internal dependencies use
compatible SemVer ranges and are covered by the source-free consumer suite.

## Change Records

- Every customer-visible change requires a changelog entry.
- Conventional Commit categories describe intent; release impact is determined
  explicitly during review rather than inferred only from the commit title.
- Each release records added, changed, deprecated, removed, fixed, and security
  items where applicable.
- Breaking changes include migration instructions and the first version that
  rejects the previous behavior.
- API lifecycle and SDK lifecycle changes are documented separately.

## Version And Changelog Automation

Changesets automates the repository-side release record; npm and the website
are outputs of that process, not where the changelog is authored.

1. A customer-visible pull request adds a small file with `npm run changeset`.
2. After feature changes reach `main`, GitHub opens or updates a release pull
   request containing synchronized versions and changelogs for all six
   packages.
3. A maintainer reviews and merges that release pull request.
4. CI reruns Node 20/22, source-free package, local sandbox, and hosted sandbox
   gates.
5. GitHub Actions uses npm trusted publishing to publish immutable packages
   with provenance. Prereleases use `next`; non-prereleases use `latest`.
6. The same committed changelog can be rendered later on the documentation
   website without creating a second source of truth.

Changesets prepares synchronized changelogs and prerelease versions. Its
default counter would advance beta.1 to beta.2; release PR review must apply
the agreed beta.1 fix numbering before merge. The first fix release is
`0.1.0-beta.1.1`. A fix PR alone does not change published versions, and an
existing version is never republished.

## Release Gates

Every public npm release requires:

1. Generated contracts are current and contain only approved public routes.
2. Node.js 20 and 22 unit, package, and local sandbox suites pass.
3. The source-free consumer installs the exact package tarballs.
4. Browser-safe roots contain no Node.js or client-secret implementation.
5. The hosted sandbox proves Identity discovery and JWKS, Events catalog reads,
   Notifications template reads, Webhooks subscription reads, and the Storage
   upload, scan, download, and cleanup lifecycle against the candidate commit.
6. Package contents contain no private paths, credentials, service-auth keys,
   migrations, internal subjects, or deployment files.
7. The changelog and migration guidance match the release.
8. npm publication uses a protected GitHub environment, trusted publishing,
   provenance, and two-factor-protected maintainers.
9. The release is published under the correct dist-tag and verified from a
   clean external consumer after publication.

The release workflow remains skipped until the repository variable
`AETHER_SDK_RELEASE_ENABLED` is explicitly set to `true`. This switch is set
only after the hosted sandbox variables/secrets and npm trusted publisher are
configured, preventing an incomplete repository bootstrap from appearing as a
failed or partially attempted release.

The protected `sdk-sandbox` environment supplies:

```text
AETHER_SDK_SANDBOX_TOKEN_URL
AETHER_SDK_SANDBOX_IDENTITY_URL
AETHER_SDK_SANDBOX_EVENTS_URL
AETHER_SDK_SANDBOX_EVENTS_AUDIENCE
AETHER_SDK_SANDBOX_NOTIFICATIONS_URL
AETHER_SDK_SANDBOX_NOTIFICATIONS_AUDIENCE
AETHER_SDK_SANDBOX_STORAGE_URL
AETHER_SDK_SANDBOX_STORAGE_AUDIENCE
AETHER_SDK_SANDBOX_WEBHOOKS_URL
AETHER_SDK_SANDBOX_WEBHOOKS_AUDIENCE
AETHER_SDK_SANDBOX_NAMESPACE_ID
AETHER_SDK_SANDBOX_CLIENT_ID
AETHER_SDK_SANDBOX_CLIENT_SECRET
```

URLs and audiences are non-secret environment variables. The client ID and
client secret are environment secrets. The sandbox client receives only the
capabilities exercised by the proof.

### One-Time npm Package Bootstrap

npm exposes trusted-publisher settings only after a package exists. The initial
creation of all six `@aetherplatform` packages therefore uses
the manual `bootstrap-release.yml` workflow in the protected `sdk-sandbox`
environment. It requires all hosted-sandbox gates, GitHub provenance, the
explicit `AETHER_SDK_BOOTSTRAP_RELEASE_ENABLED=true` repository variable, and a
short-lived granular `NPM_BOOTSTRAP_TOKEN` environment secret.

After all six packages exist:

1. Configure GitHub Actions trusted publishing on each npm package for the
   `aetherplatform/aether-typescript` repository, `release.yml` workflow, and
   `sdk-sandbox` environment, allowing direct `npm publish`.
2. Delete `NPM_BOOTSTRAP_TOKEN` and set
   `AETHER_SDK_BOOTSTRAP_RELEASE_ENABLED=false`.
3. Set `AETHER_SDK_RELEASE_ENABLED=true` only after a hosted-sandbox rerun
   succeeds.
4. Verify subsequent publication succeeds through OIDC without
   `NODE_AUTH_TOKEN`.

The bootstrap token is never accepted by the permanent release workflow and is
not retained as a rollback credential.

## Deprecation And Emergency Changes

- Preview releases may change incompatibly, but the changelog must identify the
  impact and replacement.
- Stable deprecation periods and supported-major windows must be published
  before `1.0.0`.
- `npm deprecate` messages identify unsafe or unsupported package versions and
  point to the replacement version.
- A security emergency may shorten normal notice periods. The security notice
  must explain the required customer action without disclosing exploitable
  detail prematurely.

## Remaining Publication Inputs

The package strategy is locked, but publication still requires:

- ownership confirmation for the `aetherplatform` npm organization, one-time
  package bootstrap, and trusted-publishing configuration;
- creation of the `security@useaether.co` and `support@useaether.co` forwarding
  addresses;
- one configured hosted sandbox client and namespace;
- configured Identity, Events, Notifications, Storage, and Webhooks sandbox
  endpoints and platform audiences.
