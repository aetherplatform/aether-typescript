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

- Security: `security@useaether.me`
- SDK support: `support@useaether.me`
- Hosted sandbox: `sandbox.api.useaether.me`

## Public Package Boundary

The public TypeScript SDK uses the `@aetherplatform` npm scope and lives in the
public `aetherplatform/aether-typescript` repository.

The first public release contains only:

- `@aetherplatform/core`
- `@aetherplatform/storage`

Identity, Events, Notifications, and Webhooks remain unpublished until their
customer contracts and examples pass the same release gates.

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
- Fixes and compatible improvements to the same beta line increment the
  prerelease number: `0.1.0-beta.2`, `0.1.0-beta.3`, and so on.
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
0.1.0-beta.2   fixes and compatible improvements
0.1.0-beta.3   additional fixes and compatible improvements
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

The `latest` tag must never point to a prerelease. Security fixes are released
as new immutable versions; tags may move, package contents may not.

## Package Coordination

Core and Storage use synchronized versions during the initial beta. Storage
depends on the exact matching Core prerelease version so a beta installation
cannot resolve an untested Core combination.

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
   request containing synchronized Core and Storage versions and changelogs.
3. A maintainer reviews and merges that release pull request.
4. CI reruns Node 20/22, source-free package, local sandbox, and hosted sandbox
   gates.
5. GitHub Actions uses npm trusted publishing to publish immutable packages
   with provenance. Prereleases use `next`; non-prereleases use `latest`.
6. The same committed changelog can be rendered later on the documentation
   website without creating a second source of truth.

The first beta already has its target version in the package manifests. Later
beta changes remain in Changesets prerelease mode, so a patch changes
`0.1.0-beta.1` to `0.1.0-beta.2` rather than prematurely producing `0.1.0`.

## Release Gates

Every public npm release requires:

1. Generated contracts are current and contain only approved public routes.
2. Node.js 20 and 22 unit, package, and local sandbox suites pass.
3. The source-free consumer installs the exact package tarballs.
4. Browser-safe roots contain no Node.js or client-secret implementation.
5. The hosted sandbox upload, scan, download, and cleanup proof passes against
   the candidate commit.
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

- creation and ownership confirmation for the `aetherplatform` GitHub and npm
  organizations and trusted-publishing configuration;
- creation of the `security@useaether.me` and `support@useaether.me` forwarding
  addresses;
- one configured hosted sandbox client, namespace, and deployment.
