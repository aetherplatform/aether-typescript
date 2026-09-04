#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AETHER_ROOT="$(cd "${SDK_ROOT}/../.." && pwd)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/aether-sdk-generated.XXXXXX")"
trap 'rm -rf "${work_dir}"' EXIT

for platform in identity events notifications storage webhooks; do
  if [[ -f "${SDK_ROOT}/contracts/openapi/${platform}.json" ]]; then
    contract="${SDK_ROOT}/contracts/openapi/${platform}.json"
    generator="${SDK_ROOT}/scripts/generate_typescript_sdk.mjs"
  else
    ruby "${AETHER_ROOT}/scripts/openapi_contracts.rb" bundle "${platform}" "${work_dir}/${platform}.json" >/dev/null
    contract="${work_dir}/${platform}.json"
    generator="${AETHER_ROOT}/scripts/generate_typescript_sdk.mjs"
  fi
  node "${generator}" "${platform}" "${contract}" "${work_dir}/${platform}.generated.ts" >/dev/null
  diff -u \
    "${SDK_ROOT}/packages/${platform}/src/generated.ts" \
    "${work_dir}/${platform}.generated.ts"
done

echo "TypeScript SDK generated sources are current."
