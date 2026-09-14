import {AetherError} from "@aetherplatform/core";
import type {
  PasswordlessStartRequest, PasswordlessStartResponse,
  PasswordlessVerifyRequest, PasswordlessVerifyResponse,
  PasswordlessCompleteRequest, PasswordlessCompleteResponse,
} from "./generated.js";
import {operations} from "./generated.js";
import {IdentityTransport, type IdentityRequestOptions} from "./internal.js";

interface Requests {
  startPasswordless: PasswordlessStartRequest;
  verifyPasswordless: PasswordlessVerifyRequest;
  completePasswordless: PasswordlessCompleteRequest;
}
interface Responses {
  startPasswordless: PasswordlessStartResponse;
  verifyPasswordless: PasswordlessVerifyResponse;
  completePasswordless: PasswordlessCompleteResponse;
}

const allowedKeys = {
  startPasswordless: ["client_id", "identifier", "channel", "redirect_uri", "scope", "state", "nonce", "code_challenge", "code_challenge_method", "response_type"],
  verifyPasswordless: ["client_id", "transaction", "challenge_id", "identifier", "channel", "code", "code_verifier"],
  completePasswordless: ["client_id", "continuation", "code_verifier", "decision", "identifier", "profile", "consent"],
} as const;

export function resolveClientId(configured: string | undefined, supplied?: string): string {
  if (configured && supplied && configured !== supplied) throw new TypeError("client_id must match the configured client");
  const id = configured ?? supplied;
  if (!nonempty(id)) throw new TypeError("clientId or client_id is required");
  return id;
}

export function clientPath(path: string, id: string): string {
  return `${path}?${new URLSearchParams({client_id: id})}`;
}

export async function passwordlessRequest<Operation extends keyof Requests>(
  transport: IdentityTransport,
  operation: Operation,
  request: Requests[Operation],
  id: string,
  options: IdentityRequestOptions,
  headers?: HeadersInit,
): Promise<Responses[Operation]> {
  validateRequest(operation, request);
  const metadata = operations[operation];
  const response = await transport.request<Responses[Operation]>({
    operation,
    method: "POST",
    path: clientPath(metadata.path, id),
    body: JSON.stringify({...request, client_id: id}),
    contentType: "application/json",
    ...(headers ? {headers} : {}),
    successStatuses: metadata.successStatuses,
    retrySafe: false,
    omitErrorDetails: true,
  }, options);
  if (!validResponse(operation, response, transport)) {
    throw new AetherError({status: 0, code: "invalid_response", message: "Identity returned an invalid passwordless response"});
  }
  return response;
}

function validateRequest(operation: keyof Requests, request: Requests[keyof Requests]): void {
  if (!record(request) || Object.keys(request).some((key) => !(allowedKeys[operation] as readonly string[]).includes(key))) {
    throw new TypeError("Passwordless request contains an unsupported field");
  }
  if (operation === "startPasswordless") {
    const body = request as PasswordlessStartRequest;
    if (!nonempty(body.identifier) || !["email", "sms"].includes(body.channel)) throw new TypeError("identifier and an email or sms channel are required");
    if (!/^[A-Za-z0-9_-]{43}$/.test(body.code_challenge) || body.code_challenge_method !== "S256") throw new TypeError("A valid S256 code_challenge is required");
    callbackTarget(body.redirect_uri);
    if (body.state !== undefined && (!nonempty(body.state) || body.state.length > 1024)) throw new TypeError("state must be nonempty and at most 1024 characters");
  } else {
    const body = request as PasswordlessVerifyRequest | PasswordlessCompleteRequest;
    validateCodeVerifier(body.code_verifier);
    if (operation === "verifyPasswordless") {
      const verify = body as PasswordlessVerifyRequest;
      if (!nonempty(verify.transaction) || !nonempty(verify.challenge_id) || !nonempty(verify.identifier) || !["email", "sms"].includes(verify.channel) || !/^[0-9]{6}$/.test(verify.code)) {
        throw new TypeError("transaction, challenge_id, identifier, channel and a six-digit code are required");
      }
    } else {
      const complete = body as PasswordlessCompleteRequest;
      if (!nonempty(complete.continuation) || !["approve", "deny"].includes(complete.decision)) throw new TypeError("continuation and an approve or deny decision are required");
    }
  }
}

function validResponse(operation: keyof Requests, response: unknown, transport: IdentityTransport): boolean {
  if (!record(response)) return false;
  if (operation === "startPasswordless") {
    return nonempty(response.transaction) && nonempty(response.challenge_id) && response.expires_in === 300
      && Number.isInteger(response.resend_after) && Number(response.resend_after) >= 1
      && Number(response.resend_after) <= 300 && response.transaction_expires_in === 600;
  }
  if (response.status === "authorized") return nonempty(response.code) && validState(response.state);
  if (operation === "completePasswordless") return response.status === "denied" && response.error === "access_denied" && validState(response.state);
  if (!Number.isInteger(response.expires_in) || Number(response.expires_in) <= 0 || Number(response.expires_in) > 300) return false;
  if (response.status === "hosted_completion_required") {
    try {
      const url = new URL(String(response.continuation_url));
      return url.origin === transport.resolve("/").origin && url.pathname === "/oauth/passwordless/continue"
        && !url.username && !url.password && !url.hash && nonempty(url.searchParams.get("handoff"))
        && url.searchParams.getAll("handoff").length === 1;
    } catch { return false; }
  }
  if (response.status === "custom_completion_required") {
    const required = response.requirements;
    return nonempty(response.continuation) && record(required) && typeof required.registration === "boolean"
      && typeof required.consent === "boolean" && Array.isArray(required.scopes) && required.scopes.every(nonempty)
      && (required.registration ? nonempty(required.aether_terms_version) && nonempty(required.aether_privacy_version)
        : validState(required.aether_terms_version) && validState(required.aether_privacy_version));
  }
  return false;
}

export function validateCodeVerifier(value: string): void {
  if (typeof value !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(value)) throw new TypeError("code_verifier must be 43 to 128 RFC 7636 characters");
}

export function callbackTarget(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new TypeError("redirectUri must be an absolute callback URL"); }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new TypeError("redirectUri must be HTTPS or an explicitly registered development loopback, without credentials, query or fragment");
  }
  return url;
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validState(value: unknown): boolean { return value === null || typeof value === "string"; }
