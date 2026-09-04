# Aether SDK Core Preview

Private release-candidate package containing the browser-safe HTTP transport,
cursor pagination, retry policy, and typed errors.

Import `ClientCredentialsTokenProvider` from `@aetherplatform/core/server`.
The server entry point handles client secrets and is intentionally excluded
from the browser-safe root export.
