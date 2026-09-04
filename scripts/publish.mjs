import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const packageDirectories = ["core", "storage"];

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

if (releases[0].version !== releases[1].version) {
  throw new Error("Core and Storage versions must remain synchronized during beta");
}

for (const release of releases) {
  console.log(`${dryRun ? "Would publish" : "Publishing"} ${release.name}@${release.version} under ${release.tag}`);

  if (dryRun) continue;
  if (process.env.GITHUB_ACTIONS !== "true" && process.env.AETHER_ALLOW_LOCAL_PUBLISH !== "1") {
    throw new Error("Publishing is restricted to GitHub Actions trusted publishing");
  }

  const existing = runNpm(["view", `${release.name}@${release.version}`, "version", "--json"], {
    allowNotFound: true,
  });

  if (existing !== null) {
    console.log(`${release.name}@${release.version} is already immutable on npm; skipping`);
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
  console.log(`New tag: ${release.name}@${release.version}`);
}
