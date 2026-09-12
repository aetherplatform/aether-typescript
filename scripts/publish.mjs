import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {verifyReleaseTags} from "./release-tags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const packageDirectories = ["core", "identity", "events", "notifications", "storage", "webhooks"];
const authMode = process.env.AETHER_NPM_AUTH_MODE;

function runNpm(args, {allowNotFound = false} = {}) {
  const result = spawnSync("npm", args, {cwd: root, encoding: "utf8"});

  if (result.status === 0) return result.stdout.trim();

  const output = `${result.stdout}\n${result.stderr}`;
  if (allowNotFound && /E404|404 Not Found|is not in this registry/i.test(output)) return null;

  process.stderr.write(output);
  throw new Error(`npm ${args.join(" ")} failed`);
}

function distTagFor(version) {
  return version.includes("-") ? "next" : "latest";
}

const releases = [];

for (const directory of packageDirectories) {
  const manifestPath = path.join(root, "packages", directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const tag = distTagFor(manifest.version);

  if (manifest.private === true) throw new Error(`${manifest.name} is unexpectedly private`);
  if (manifest.publishConfig?.access !== "public") throw new Error(`${manifest.name} is not configured for public access`);
  if (manifest.publishConfig?.provenance !== true) throw new Error(`${manifest.name} is not configured for provenance`);
  if (manifest.publishConfig?.tag !== tag) {
    throw new Error(`${manifest.name} publishConfig.tag must be ${tag} for ${manifest.version}`);
  }

  releases.push({directory, name: manifest.name, version: manifest.version, tag});
}

if (new Set(releases.map(({version}) => version)).size !== 1) {
  throw new Error("All Aether TypeScript SDK versions must remain synchronized during beta");
}

for (const release of releases) {
  console.log(`${dryRun ? "Would publish" : "Publishing"} ${release.name}@${release.version} under ${release.tag}`);

  if (dryRun) continue;
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Publishing is restricted to the protected GitHub Actions release workflows");
  }
  if (!new Set(["trusted-publishing", "bootstrap-token"]).has(authMode)) {
    throw new Error("AETHER_NPM_AUTH_MODE must identify an approved release workflow");
  }
  if (authMode === "trusted-publishing" && process.env.NODE_AUTH_TOKEN) {
    throw new Error("Trusted publishing must not receive a long-lived npm token");
  }
  if (
    authMode === "bootstrap-token" &&
    (process.env.AETHER_SDK_BOOTSTRAP_RELEASE_ENABLED !== "true" ||
      process.env.AETHER_SDK_RELEASE_ENABLED === "true" ||
      !process.env.NODE_AUTH_TOKEN)
  ) {
    throw new Error("The one-time bootstrap release requires its explicit gate and npm token");
  }

  if (authMode === "bootstrap-token") {
    const publishedVersions = runNpm(["view", release.name, "versions", "--json"], {allowNotFound: true});

    if (publishedVersions !== null) {
      const versions = [JSON.parse(publishedVersions)].flat();
      if (versions.includes(release.version)) {
        console.log(`${release.name}@${release.version} is already immutable on npm; skipping`);
        verifyReleaseTags(release, runNpm);
        continue;
      }

      throw new Error(`Bootstrap publishing cannot add a version to existing package ${release.name}`);
    }
  }

  const existing = runNpm(["view", `${release.name}@${release.version}`, "version", "--json"], {
    allowNotFound: true,
  });

  if (existing !== null) {
    console.log(`${release.name}@${release.version} is already immutable on npm; skipping`);
    verifyReleaseTags(release, runNpm);
    continue;
  }

  runNpm([
    "publish",
    "--workspace",
    release.name,
    "--access",
    "public",
    "--tag",
    release.tag,
    "--provenance",
  ]);
  verifyReleaseTags(release, runNpm);
  console.log(`New tag: ${release.name}@${release.version}`);
}
