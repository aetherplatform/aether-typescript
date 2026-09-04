import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageNames = ["core", "identity", "events", "notifications", "storage", "webhooks"];
const publicPackages = new Set(["core", "storage"]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const workspace = await readJson("package.json");

if (workspace.author !== "Aether") throw new Error("workspace author must be Aether");
if (workspace.license !== "Apache-2.0") throw new Error("workspace license must be Apache-2.0");

const core = await readJson("packages/core/package.json");
const releaseVersion = core.version;
const releaseTag = releaseVersion.includes("-") ? "next" : "latest";

if (!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(releaseVersion)) {
  throw new Error(`unsupported public release version: ${releaseVersion}`);
}

for (const shortName of packageNames) {
  const manifest = await readJson(`packages/${shortName}/package.json`);
  const expectedName = `@aetherplatform/${shortName}`;

  if (manifest.name !== expectedName) throw new Error(`${shortName} must use ${expectedName}`);

  if (publicPackages.has(shortName)) {
    if (manifest.version !== releaseVersion) throw new Error(`${expectedName} must use ${releaseVersion}`);
    if (manifest.private === true) throw new Error(`${expectedName} must be publishable`);
    if (manifest.author !== "Aether") throw new Error(`${expectedName} author must be Aether`);
    if (manifest.license !== "Apache-2.0") throw new Error(`${expectedName} must use Apache-2.0`);
    if (manifest.publishConfig?.access !== "public") throw new Error(`${expectedName} must publish publicly`);
    if (manifest.publishConfig?.provenance !== true) throw new Error(`${expectedName} must publish provenance`);
    if (manifest.publishConfig?.tag !== releaseTag) {
      throw new Error(`${expectedName} ${releaseVersion} must publish under ${releaseTag}`);
    }
  } else if (manifest.private !== true) {
    throw new Error(`${expectedName} must remain private for the initial release`);
  }
}

const storage = await readJson("packages/storage/package.json");
if (storage.dependencies?.["@aetherplatform/core"] !== releaseVersion) {
  throw new Error("Storage must depend on the exact matching Core release");
}

console.log(`SDK release boundary passed: only Core and Storage are public at ${releaseVersion} (${releaseTag}).`);
