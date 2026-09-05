# `@aetherplatform/identity`

OAuth 2.0 Authorization Code with PKCE and OpenID Connect helpers for Aether
Identity. The browser-safe package root contains no client-secret code.

```ts
import {IdentityClient} from "@aetherplatform/identity";

const identity = new IdentityClient({baseUrl: "https://sandbox.auth.useather.co"});
const authorize = identity.authorizationUrl({
  clientId: "your-client-id",
  redirectUri: "https://app.example.com/oauth/callback",
  scope: "openid profile email",
  state: crypto.randomUUID(),
  codeChallenge: "your-43-to-128-character-base64url-pkce-challenge",
});
```

The client also exposes validated OpenID Provider discovery, OAuth JWKS, scope
catalog, and userinfo operations. Userinfo accepts an explicit user-token
provider and performs at most one invalidation and fresh-token attempt after a
`401`.

Confidential OAuth operations are server-only:

```ts
import {ConfidentialIdentityClient} from "@aetherplatform/identity/server";

const identity = new ConfidentialIdentityClient({
  baseUrl: "https://sandbox.auth.useather.co",
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
internal principal ID and does not expose hosted browser forms, native
authentication routes, service-JWT signing, or Aether session internals.
