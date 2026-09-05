# Aether SDK Core Preview

Public-beta package containing the browser-safe HTTP transport, cursor
pagination, retry policy, and typed errors.

Import `ClientCredentialsTokenProvider` from `@aetherplatform/core/server`.
The server entry point handles client secrets and is intentionally excluded
from the browser-safe root export.

Token acquisition is single-flight, cached with expiry skew, and bounded to one
transient retry by default. Invalid credentials and `quota_exceeded` fail
immediately. Access-token objects expose only the opaque token value and expiry;
Aether remains authoritative for the token's capabilities.
