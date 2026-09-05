#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/aether-sdk-package.XXXXXX")"
trap 'rm -rf "${work_dir}"' EXIT
export npm_config_cache="${work_dir}/npm-cache"

cd "${SDK_ROOT}"
npm run test:release-boundary >/dev/null
npm run build >/dev/null

packages=(core identity events notifications storage webhooks)
tarballs=()

for package in "${packages[@]}"; do
  tarball="$(npm pack --workspace "@aetherplatform/${package}" --pack-destination "${work_dir}" --json | node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => console.log(JSON.parse(input)[0].filename));')"
  tarballs+=("${work_dir}/${tarball}")
done

for package in "${packages[@]}"; do
  tarball="$(find "${work_dir}" -maxdepth 1 -name "aetherplatform-${package}-*.tgz" -print -quit)"
  for required_file in package/LICENSE package/NOTICE package/README.md package/CHANGELOG.md package/package.json; do
    if ! tar -tzf "${tarball}" "${required_file}" >/dev/null 2>&1; then
      echo "${package} tarball is missing ${required_file}" >&2
      exit 1
    fi
  done
done

mkdir "${work_dir}/consumer"
cd "${work_dir}/consumer"
npm init -y >/dev/null
npm install --ignore-scripts "${tarballs[@]}" >/dev/null

cat > smoke.mjs <<'EOF'
import {ClientCredentialsTokenProvider} from "@aetherplatform/core/server";
import {IdentityClient} from "@aetherplatform/identity";
import {ConfidentialIdentityClient} from "@aetherplatform/identity/server";
import {EventsClient} from "@aetherplatform/events";
import {NotificationsClient} from "@aetherplatform/notifications";
import {StorageClient} from "@aetherplatform/storage";
import {WebhooksClient} from "@aetherplatform/webhooks";
import {verifyWebhookSignature} from "@aetherplatform/webhooks/server";

if (typeof ClientCredentialsTokenProvider !== "function") throw new Error("missing token provider");
if (typeof IdentityClient !== "function") throw new Error("missing Identity client");
if (typeof ConfidentialIdentityClient !== "function") throw new Error("missing confidential Identity client");
if (typeof EventsClient !== "function") throw new Error("missing Events client");
if (typeof NotificationsClient !== "function") throw new Error("missing Notifications client");
if (typeof StorageClient !== "function") throw new Error("missing Storage client");
if (typeof WebhooksClient !== "function") throw new Error("missing Webhooks client");
if (typeof verifyWebhookSignature !== "function") throw new Error("missing webhook verifier");
EOF

node smoke.mjs

cat > browser-safe.mjs <<'EOF'
import * as core from "@aetherplatform/core";
import * as identity from "@aetherplatform/identity";
import * as events from "@aetherplatform/events";
import * as notifications from "@aetherplatform/notifications";
import * as storage from "@aetherplatform/storage";
import * as webhooks from "@aetherplatform/webhooks";

if ("ClientCredentialsTokenProvider" in core) {
  throw new Error("browser-safe Core export contains client credentials");
}
if ("ConfidentialIdentityClient" in identity || "ClientCredentialsTokenProvider" in identity) {
  throw new Error("browser-safe Identity export contains confidential credentials");
}
if (typeof identity.IdentityClient !== "function" || typeof events.EventsClient !== "function") {
  throw new Error("browser-safe Identity or Events export is unavailable");
}
if (typeof notifications.NotificationsClient !== "function" || typeof webhooks.WebhooksClient !== "function") {
  throw new Error("browser-safe Notifications or Webhooks export is unavailable");
}
if ("verifyWebhookSignature" in webhooks) {
  throw new Error("browser-safe Webhooks export contains server cryptography");
}
if (typeof storage.StorageClient !== "function") {
  throw new Error("browser-safe Storage export is unavailable");
}
EOF

node browser-safe.mjs

cat > browser-safe.ts <<'EOF'
import {AetherError} from "@aetherplatform/core";
import {IdentityClient} from "@aetherplatform/identity";
import {EventsClient} from "@aetherplatform/events";
import {NotificationsClient} from "@aetherplatform/notifications";
import {StorageClient} from "@aetherplatform/storage";
import {WebhooksClient} from "@aetherplatform/webhooks";

export const browserSurface = {AetherError, IdentityClient, EventsClient, NotificationsClient, StorageClient, WebhooksClient};
EOF

"${SDK_ROOT}/node_modules/.bin/tsc" \
  --noEmit \
  --strict \
  --target ES2022 \
  --module ESNext \
  --moduleResolution Bundler \
  --lib ES2022,DOM \
  browser-safe.ts

for browser_root in \
  node_modules/@aetherplatform/core/dist/index.js \
  node_modules/@aetherplatform/identity/dist/index.js \
  node_modules/@aetherplatform/identity/dist/internal.js \
  node_modules/@aetherplatform/events/dist/index.js \
  node_modules/@aetherplatform/notifications/dist/index.js \
  node_modules/@aetherplatform/storage/dist/index.js \
  node_modules/@aetherplatform/webhooks/dist/index.js; do
  if grep -E 'node:|\bBuffer\b|ClientCredentialsTokenProvider|ConfidentialIdentityClient|clientSecret|verifyWebhookSignature' "${browser_root}"; then
    echo "server credential implementation leaked into browser-safe package root" >&2
    exit 1
  fi
done

if grep -R -E '/Users/|platforms/identity|SERVICE_JWT_PRIVATE_KEY|NATS_URL' node_modules/@aetherplatform --exclude='package.json'; then
  echo "private repository material leaked into SDK package" >&2
  exit 1
fi

echo "Source-free SDK package installation passed."
