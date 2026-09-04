import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageNames = ["core", "identity", "events", "notifications", "storage", "webhooks"];
const publicPackages = new Set(["core", "storage"]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
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

const releaseWorkflow = await readText(".github/workflows/release.yml");
const bootstrapWorkflow = await readText(".github/workflows/bootstrap-release.yml");

for (const workflow of [releaseWorkflow, bootstrapWorkflow]) {
  if (!workflow.includes('node-version: "24"')) throw new Error("release workflows must use Node.js 24");
  if (!workflow.includes("npm install --global npm@11")) throw new Error("release workflows must use npm 11");
  if (!workflow.includes("environment: sdk-sandbox")) throw new Error("release workflows must use sdk-sandbox");
  if (workflow.includes("cache: npm")) throw new Error("release workflows must not cache dependencies");
}

if (!releaseWorkflow.includes("AETHER_NPM_AUTH_MODE: trusted-publishing")) {
  throw new Error("the permanent release workflow must use trusted publishing");
}
if (releaseWorkflow.includes("NPM_BOOTSTRAP_TOKEN")) {
  throw new Error("the permanent release workflow must not receive the bootstrap token");
}
if (!bootstrapWorkflow.includes("AETHER_NPM_AUTH_MODE: bootstrap-token")) {
  throw new Error("the bootstrap workflow must identify token bootstrap mode");
}
if (!bootstrapWorkflow.includes("workflow_dispatch:") || bootstrapWorkflow.includes("\n  push:")) {
  throw new Error("the bootstrap workflow must remain manual-only");
}
if (!bootstrapWorkflow.includes("AETHER_SDK_BOOTSTRAP_RELEASE_ENABLED")) {
  throw new Error("the bootstrap workflow must remain explicitly gated");
}
if (!bootstrapWorkflow.includes("NODE_AUTH_TOKEN: ${{ secrets.NPM_BOOTSTRAP_TOKEN }}")) {
  throw new Error("the bootstrap workflow must use only its dedicated npm secret");
}

console.log(`SDK release boundary passed: only Core and Storage are public at ${releaseVersion} (${releaseTag}).`);
