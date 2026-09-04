#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AETHER_ROOT="$(cd "${SDK_ROOT}/../.." && pwd)"

if [[ -f "${SDK_ROOT}/contracts/openapi/storage.json" ]]; then
  for platform in identity events notifications storage webhooks; do
    node "${SDK_ROOT}/scripts/generate_typescript_sdk.mjs" \
      "${platform}" \
      "${SDK_ROOT}/contracts/openapi/${platform}.json" \
      "${SDK_ROOT}/packages/${platform}/src/generated.ts"
  done
else
  exec bash "${AETHER_ROOT}/scripts/generate_typescript_sdk.sh"
fi
