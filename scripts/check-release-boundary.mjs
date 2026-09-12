import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageNames = ["core", "identity", "events", "notifications", "storage", "webhooks"];

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

if (!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+(?:\.\d+)?)?$/.test(releaseVersion)) {
  throw new Error(`unsupported public release version: ${releaseVersion}`);
}

for (const shortName of packageNames) {
  const manifest = await readJson(`packages/${shortName}/package.json`);
  const expectedName = `@aetherplatform/${shortName}`;

  if (manifest.name !== expectedName) throw new Error(`${shortName} must use ${expectedName}`);

  if (manifest.version !== releaseVersion) throw new Error(`${expectedName} must use ${releaseVersion}`);
  if (manifest.private === true) throw new Error(`${expectedName} must be publishable`);
  if (manifest.author !== "Aether") throw new Error(`${expectedName} author must be Aether`);
  if (manifest.license !== "Apache-2.0") throw new Error(`${expectedName} must use Apache-2.0`);
  if (manifest.publishConfig?.access !== "public") throw new Error(`${expectedName} must publish publicly`);
  if (manifest.publishConfig?.provenance !== true) throw new Error(`${expectedName} must publish provenance`);
  if (manifest.publishConfig?.tag !== releaseTag) {
    throw new Error(`${expectedName} ${releaseVersion} must publish under ${releaseTag}`);
  }
}

for (const shortName of packageNames.filter((name) => name !== "core")) {
  const manifest = await readJson(`packages/${shortName}/package.json`);
  if (manifest.dependencies?.["@aetherplatform/core"] !== releaseVersion) {
    throw new Error(`${shortName} must depend on the exact matching Core release`);
  }
}

const identityRoot = await readText("packages/identity/src/index.ts");
const identityServer = await readText("packages/identity/src/server.ts");
for (const symbol of ["IdentityClient", "authorizationUrl", "getOpenIdConfiguration", "getOAuthJwks", "listOAuthScopes", "getUserInfo"]) {
  if (!identityRoot.includes(symbol)) throw new Error(`Identity root is missing ${symbol}`);
}
for (const symbol of ["ConfidentialIdentityClient", "exchangeOAuthToken", "revokeOAuthToken", "introspectOAuthToken"]) {
  if (!identityServer.includes(symbol)) throw new Error(`Identity server entry is missing ${symbol}`);
}
if (/\/oauth\/login|\/oauth\/consent|\/internal\/v1\//.test(`${identityRoot}\n${identityServer}`)) {
  throw new Error("hosted browser or internal Identity routes leaked into the SDK");
}

const generated = {
  identity: await readText("packages/identity/src/generated.ts"),
  events: await readText("packages/events/src/generated.ts"),
  notifications: await readText("packages/notifications/src/generated.ts"),
  storage: await readText("packages/storage/src/generated.ts"),
  webhooks: await readText("packages/webhooks/src/generated.ts"),
};
for (const [name, expected] of Object.entries({identity: 8, events: 3, notifications: 29, storage: 18, webhooks: 19})) {
  const match = generated[name].match(/export interface \w+Operations \{([\s\S]*?)\n\}/);
  const count = match ? [...match[1].matchAll(/^  [A-Za-z_$][A-Za-z0-9_$]*: \{/gm)].length : 0;
  if (count !== expected) throw new Error(`${name} must expose exactly ${expected} public operations, found ${count}`);
}
if (/consumer-groups/.test(generated.events)) throw new Error("private Events routes leaked into the SDK");
if (/\/v1\/notifications\/(?:inbox|devices|preferences)/.test(generated.notifications)) {
  throw new Error("partner-private Notifications routes leaked into the SDK");
}
if (/provider-migrations/.test(generated.storage)) throw new Error("operator-private Storage routes leaked into the SDK");

const releaseWorkflow = await readText(".github/workflows/release.yml");
const bootstrapWorkflow = await readText(".github/workflows/bootstrap-release.yml");

for (const workflow of [releaseWorkflow, bootstrapWorkflow]) {
  if (!workflow.includes('node-version: "24"')) throw new Error("release workflows must use Node.js 24");
  if (!workflow.includes("npm install --global npm@11")) throw new Error("release workflows must use npm 11");
  if (!workflow.includes("environment: sdk-sandbox")) throw new Error("release workflows must use sdk-sandbox");
  if (workflow.includes("cache: npm")) throw new Error("release workflows must not cache dependencies");
  for (const variable of [
    "AETHER_SDK_SANDBOX_TOKEN_URL",
    "AETHER_SDK_SANDBOX_IDENTITY_URL",
    "AETHER_SDK_SANDBOX_EVENTS_URL",
    "AETHER_SDK_SANDBOX_EVENTS_AUDIENCE",
    "AETHER_SDK_SANDBOX_NOTIFICATIONS_URL",
    "AETHER_SDK_SANDBOX_NOTIFICATIONS_AUDIENCE",
    "AETHER_SDK_SANDBOX_STORAGE_URL",
    "AETHER_SDK_SANDBOX_STORAGE_AUDIENCE",
    "AETHER_SDK_SANDBOX_WEBHOOKS_URL",
    "AETHER_SDK_SANDBOX_WEBHOOKS_AUDIENCE",
    "AETHER_SDK_SANDBOX_NAMESPACE_ID",
    "AETHER_SDK_SANDBOX_CLIENT_ID",
    "AETHER_SDK_SANDBOX_CLIENT_SECRET",
  ]) {
    if (!workflow.includes(variable)) throw new Error(`release workflow is missing ${variable}`);
  }
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

console.log(`SDK release boundary passed: all six packages are publishable at ${releaseVersion} (${releaseTag}).`);
