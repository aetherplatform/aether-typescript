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

for package in core storage; do
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
import {operations as identityOperations} from "@aetherplatform/identity";
import {EventsClient} from "@aetherplatform/events";
import {NotificationsClient} from "@aetherplatform/notifications";
import {StorageClient} from "@aetherplatform/storage";
import {WebhooksClient} from "@aetherplatform/webhooks";
import {verifyWebhookSignature} from "@aetherplatform/webhooks/server";

if (typeof ClientCredentialsTokenProvider !== "function") throw new Error("missing token provider");
if (typeof identityOperations !== "object") throw new Error("missing Identity operations");
if (typeof EventsClient !== "function") throw new Error("missing Events client");
if (typeof NotificationsClient !== "function") throw new Error("missing Notifications client");
if (typeof StorageClient !== "function") throw new Error("missing Storage client");
if (typeof WebhooksClient !== "function") throw new Error("missing Webhooks client");
if (typeof verifyWebhookSignature !== "function") throw new Error("missing webhook verifier");
EOF

node smoke.mjs

if grep -R -E '/Users/|platforms/identity|SERVICE_JWT_PRIVATE_KEY|NATS_URL' node_modules/@aetherplatform --exclude='package.json'; then
  echo "private repository material leaked into SDK package" >&2
  exit 1
fi

echo "Source-free SDK package installation passed."
