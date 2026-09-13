import {callbackTarget} from "./passwordless.js";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/** Caller owns verifier storage; never include the verifier in an authorization URL. */
export async function generatePkce(): Promise<PkcePair> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return {codeVerifier, codeChallenge: base64url(new Uint8Array(digest)), codeChallengeMethod: "S256"};
}

export type OAuthCallbackResult =
  | {status: "authorized"; code: string; state: string}
  | {status: "denied"; error: string; state: string};

/** Validate the registered callback and the state saved by this application before exchanging a code. */
export function validateOAuthCallback(
  callbackUrl: string,
  expected: {redirectUri: string; state: string},
): OAuthCallbackResult {
  if (typeof expected.state !== "string" || !expected.state.trim()) throw new TypeError("Expected callback state is required");
  const registered = callbackTarget(expected.redirectUri);
  let callback: URL;
  try { callback = new URL(callbackUrl); } catch { throw new TypeError("Invalid OAuth callback URL"); }
  if (callback.origin !== registered.origin || callback.pathname !== registered.pathname || callback.username || callback.password || callback.hash) {
    throw new TypeError("OAuth callback does not match the registered redirect URI");
  }
  const params = callback.searchParams;
  for (const key of params.keys()) {
    if (params.getAll(key).length !== 1) throw new TypeError("OAuth callback contains duplicate parameters");
  }
  const state = params.get("state");
  if (state !== expected.state) throw new TypeError("OAuth callback state does not match");
  const code = params.get("code");
  const error = params.get("error");
  if (params.has("code") === params.has("error") || (code !== null && !code.trim()) || (error !== null && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(error))) {
    throw new TypeError("OAuth callback must contain exactly one authorization code or error");
  }
  return code !== null ? {status: "authorized", code, state} : {status: "denied", error: error!, state};
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
