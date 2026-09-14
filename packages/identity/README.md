# `@aetherplatform/identity`

OAuth 2.0 Authorization Code with PKCE and OpenID Connect helpers for Aether
Identity. The browser-safe package root contains no client-secret code.

```ts
import {IdentityClient, generatePkce} from "@aetherplatform/identity";

const identity = new IdentityClient({baseUrl: "https://auth-sandbox.useaether.co"});
const pkce = await generatePkce();
const authorize = identity.authorizationUrl({
  clientId: "your-client-id",
  redirectUri: "https://app.example.com/oauth/callback",
  scope: "openid profile email",
  state: crypto.randomUUID(),
  codeChallenge: pkce.codeChallenge,
});
```

The client also exposes validated OpenID Provider discovery, OAuth JWKS, scope
catalog, and userinfo operations. Userinfo accepts an explicit user-token
provider and performs at most one invalidation and fresh-token attempt after a
`401`.

Confidential client authentication is available from the server entry point:

```ts
import {ConfidentialIdentityClient} from "@aetherplatform/identity/server";

const identity = new ConfidentialIdentityClient({
  baseUrl: "https://auth-sandbox.useaether.co",
  clientId: process.env.AETHER_CLIENT_ID!,
  clientSecret: process.env.AETHER_CLIENT_SECRET!,
});

const tokens = await identity.exchangeOAuthToken({
  grant_type: "authorization_code",
  code,
  redirect_uri: "https://app.example.com/oauth/callback",
  code_verifier: verifier,
});
```

Hosted login and consent remain browser-driven. The SDK never accepts an
internal principal ID and does not expose hosted browser forms, internal
authentication routes, service-JWT signing, or Aether session internals.

## Public passwordless beta

These APIs are included starting with `0.1.0-beta.1.2`. The earlier
`0.1.0-beta.1.1` package does not include passwordless methods.

The public client uses the configured Identity/auth base URL and an operator-enabled
client ID. It never needs a secret. Email/SMS delivery must be configured in that
environment; installing the SDK does not enable a hosted service.

```ts
import {IdentityClient, generatePkce, validateOAuthCallback} from "@aetherplatform/identity";

const publicIdentity = new IdentityClient({
  baseUrl: "https://auth.example.com",
  clientId: "approved-public-client-id",
});
const pkce = await generatePkce();
const state = crypto.randomUUID();
const redirectUri = "https://app.example.com/oauth/callback";

// Keep the proof and transaction in application-owned memory.
const pending = await publicIdentity.startPasswordless({
  identifier: "person@example.com",
  channel: "email",
  redirect_uri: redirectUri,
  scope: "openid email offline_access",
  state,
  code_challenge: pkce.codeChallenge,
  code_challenge_method: pkce.codeChallengeMethod,
});

// Invoke only after the user submits their code.
const result = await publicIdentity.verifyPasswordless({
  identifier: "person@example.com",
  channel: "email",
  transaction: pending.transaction,
  challenge_id: pending.challenge_id,
  code: submittedCode,
  code_verifier: pkce.codeVerifier,
});

switch (result.status) {
  case "authorized": {
    if (result.state !== state) throw new Error("Unexpected authorization state");
    const tokens = await publicIdentity.exchangeOAuthToken({
      grant_type: "authorization_code",
      code: result.code,
      redirect_uri: redirectUri,
      code_verifier: pkce.codeVerifier,
    });
    // Store tokens under the application's session policy.
    break;
  }
  case "hosted_completion_required":
    // Open result.continuation_url in a browser. Preserve the transaction's
    // memory in the owning application, for example with a completion popup.
    break;
  case "custom_completion_required":
    // Render result.requirements and collect explicit registration/consent.
    // Approved clients call completePasswordless with result.continuation,
    // code_verifier, and decision: "approve" or "deny".
    break;
}

// Validate a hosted callback before exchanging its authorization code:
const callback = validateOAuthCallback(callbackUrl, {redirectUri, state});
if (callback.status === "authorized") {
  // Exchange callback.code with the original redirectUri and pkce.codeVerifier.
}
```

Use `channel: "sms"` and a phone identifier when SMS is enabled. A hosted completion
URL is a browser handoff, not an SDK JSON endpoint, and does not establish a general
Aether SSO session. Custom completion is available only through registered policy.
The same three passwordless methods exist on `ConfidentialIdentityClient`, using
its backend credentials through HTTP Basic.

`startPasswordless` also performs an explicit resend. Respect the server's
`resend_after` (60 seconds by default, configurable from 1 to 300 seconds) and a
`429` error's `retry.retryAfterSeconds`; resending supersedes the pending challenge
and returns a new transaction. Codes expire after five minutes and transactions
after ten minutes. Sending, verifying, completing, code exchange and refresh never
retry automatically, even with `maxRetries` configured. An interrupted response may
have completed on the server, so recovery remains application-controlled.

Refresh with `exchangeOAuthToken({grant_type: "refresh_token", refresh_token})`.
Serialize refreshes per session and replace the stored refresh token with its
successor; reuse revokes the family. For logout, call
`revokeOAuthToken({token: refreshToken, token_type_hint: "refresh_token"})`, then clear
application-owned session state. Public clients cannot obtain machine grants or
introspect tokens.
