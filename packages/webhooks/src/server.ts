import {createHmac, timingSafeEqual} from "node:crypto";

export type WebhookSignatureErrorCode =
  | "missing_signature"
  | "missing_timestamp"
  | "invalid_signature_format"
  | "timestamp_expired"
  | "invalid_signature";

export class WebhookSignatureError extends Error {
  readonly code: WebhookSignatureErrorCode;

  constructor(code: WebhookSignatureErrorCode) {
    super(code);
    this.name = "WebhookSignatureError";
    this.code = code;
  }
}

export interface VerifyWebhookSignatureOptions {
  toleranceSeconds?: number;
  nowSeconds?: number;
}

export interface VerifiedWebhookSignature {
  timestamp: number;
}

export function verifyWebhookSignature(
  payload: string | Uint8Array,
  signatureHeader: string,
  secret: string | Uint8Array,
  options: VerifyWebhookSignatureOptions = {},
): VerifiedWebhookSignature {
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) {
    throw new RangeError("toleranceSeconds must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new RangeError("nowSeconds must be a non-negative safe integer");
  }
  const secretLength = typeof secret === "string" ? secret.length : secret.byteLength;
  if (secretLength === 0) {
    throw new TypeError("secret must not be empty");
  }

  const {timestamp, signatures} = parseSignatureHeader(signatureHeader);

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new WebhookSignatureError("timestamp_expired");
  }

  const expected = createHmac("sha256", secret)
    .update(String(timestamp))
    .update(".")
    .update(payload)
    .digest();

  const verified = signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(expected, received);
  });

  if (!verified) throw new WebhookSignatureError("invalid_signature");
  return {timestamp};
}

function parseSignatureHeader(signatureHeader: string): {timestamp: number; signatures: Array<string>} {
  if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
    throw new WebhookSignatureError("missing_signature");
  }

  const timestamps: Array<string> = [];
  const signatures: Array<string> = [];

  for (const component of signatureHeader.split(",")) {
    const parts = component.trim().split("=");
    if (parts.length !== 2 || parts[1] === "") {
      throw new WebhookSignatureError("invalid_signature_format");
    }

    if (parts[0] === "t") timestamps.push(parts[1]!);
    else if (parts[0] === "v1") signatures.push(parts[1]!);
    else throw new WebhookSignatureError("invalid_signature_format");
  }

  if (timestamps.length === 0) throw new WebhookSignatureError("missing_timestamp");
  if (timestamps.length !== 1) throw new WebhookSignatureError("invalid_signature_format");
  if (signatures.length === 0) throw new WebhookSignatureError("missing_signature");
  if (!/^(0|[1-9][0-9]*)$/.test(timestamps[0]!)) {
    throw new WebhookSignatureError("invalid_signature_format");
  }
  if (!signatures.every((signature) => /^[0-9a-f]{64}$/.test(signature))) {
    throw new WebhookSignatureError("invalid_signature_format");
  }

  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp)) {
    throw new WebhookSignatureError("invalid_signature_format");
  }

  return {timestamp, signatures};
}
