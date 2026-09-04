# Changesets

Every pull request that changes customer-visible Core or Storage behavior adds a
changeset:

```sh
npm run changeset
```

Choose the affected package and describe the customer impact. Core and Storage
are a fixed release group during beta, so Changesets keeps their versions
synchronized. Documentation-only and internal-test changes may omit a changeset
when they do not alter package contents or supported behavior.

The release workflow creates a human-reviewed version pull request. Merging
that pull request publishes immutable packages through npm trusted publishing;
ordinary feature pull requests never publish directly. The Aether publish
guard derives `next` for prereleases and `latest` for non-prereleases, and it
publishes only Core and Storage. This avoids the Changesets first-publication
edge case that can otherwise place a new prerelease on `latest`.

Run `npm run release:plan` to inspect the exact package versions and npm tags
without contacting npm or publishing anything.
