import {
  OperationClient,
  paginateCursor,
  type AetherClientConfig,
  type CursorPaginationOptions,
  type Fetch,
} from "@aetherplatform/core";
import {
  operations,
  type CompletedPart,
  type CreateUploadIntentRequest,
  type Object as StorageObject,
  type ObjectId,
  type ObjectStatus,
  type StorageOperations,
  type UploadIntent,
} from "./generated.js";

export * from "./generated.js";

export type SearchObjectsQuery = Omit<StorageOperations["searchObjects"]["query"], "cursor">;

export class StorageClient extends OperationClient<StorageOperations> {
  constructor(config: AetherClientConfig) {
    super(config, operations);
  }

  async *iterateObjects(
    query: SearchObjectsQuery,
    options: CursorPaginationOptions = {},
  ): AsyncGenerator<StorageObject, void, undefined> {
    yield* paginateCursor(
      async (cursor, signal) => {
        const response = await this.request("searchObjects", {
          query: {...query, ...(cursor ? {cursor} : {})},
          ...(signal ? {signal} : {}),
        });
        return {items: response.objects, nextCursor: response.next_cursor};
      },
      options,
    );
  }
}

export type StorageTransferOperation = "upload" | "multipart_part" | "download";
export type StorageTransferErrorCode =
  | "aborted"
  | "invalid_upload_intent"
  | "missing_etag"
  | "network_error"
  | "size_mismatch"
  | "transfer_failed";

export class StorageTransferError extends Error {
  readonly code: StorageTransferErrorCode;
  readonly operation: StorageTransferOperation;
  readonly status: number;
  readonly partNumber: number | undefined;

  constructor(input: {
    code: StorageTransferErrorCode;
    message: string;
    operation: StorageTransferOperation;
    status?: number;
    partNumber?: number;
  }) {
    super(input.message);
    this.name = "StorageTransferError";
    this.code = input.code;
    this.operation = input.operation;
    this.status = input.status ?? 0;
    this.partNumber = input.partNumber;
  }
}

export async function uploadDirect(
  uploadUrl: string,
  body: BodyInit,
  headers: Record<string, string> = {},
  fetchImplementation: Fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<void> {
  const response = await transferRequest(
    fetchImplementation,
    uploadUrl,
    {method: "PUT", headers, body, ...(signal ? {signal} : {})},
    "upload",
  );
  if (!response.ok) {
    throw new StorageTransferError({
      code: "transfer_failed",
      message: `Direct upload failed with HTTP ${response.status}`,
      operation: "upload",
      status: response.status,
    });
  }
}

export async function downloadDirect(
  downloadUrl: string,
  fetchImplementation: Fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await transferRequest(
    fetchImplementation,
    downloadUrl,
    {method: "GET", ...(signal ? {signal} : {})},
    "download",
  );
  if (!response.ok) {
    throw new StorageTransferError({
      code: "transfer_failed",
      message: `Direct download failed with HTTP ${response.status}`,
      operation: "download",
      status: response.status,
    });
  }
  return response.arrayBuffer();
}

export type MultipartUploadBody = ArrayBuffer | Blob | Uint8Array;

export interface MultipartUploadOptions {
  concurrency?: number;
  fetch?: Fetch;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function uploadMultipart(
  intent: UploadIntent,
  body: MultipartUploadBody,
  options: MultipartUploadOptions = {},
): Promise<Array<CompletedPart>> {
  const multipart = intent.multipart;
  if (intent.upload_strategy !== "multipart" || !multipart) {
    throw new StorageTransferError({
      code: "invalid_upload_intent",
      message: "Multipart upload requires multipart upload instructions",
      operation: "multipart_part",
    });
  }

  const concurrency = options.concurrency ?? 4;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive safe integer");
  }

  const size = uploadBodySize(body);
  const expectedPartCount = Math.ceil(size / multipart.part_size);
  const parts = [...multipart.parts].sort((left, right) => left.part_number - right.part_number);
  if (
    size === 0 ||
    multipart.part_size < 1 ||
    parts.length !== expectedPartCount ||
    parts.some((part, index) => part.part_number !== index + 1)
  ) {
    throw new StorageTransferError({
      code: "size_mismatch",
      message: "Upload body does not match the multipart instructions",
      operation: "multipart_part",
    });
  }

  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (!fetchImplementation) throw new TypeError("A fetch implementation is required");

  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, {once: true});

  const completed = new Array<CompletedPart>(parts.length);
  let nextIndex = 0;
  let firstError: unknown;

  const uploadNext = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= parts.length) return;

      const part = parts[index]!;
      const start = index * multipart.part_size;
      const end = Math.min(start + multipart.part_size, size);

      try {
        const response = await transferRequest(
          fetchImplementation,
          part.upload_url,
          {
            method: "PUT",
            headers: {...options.headers, ...intent.required_headers},
            body: sliceUploadBody(body, start, end),
            signal: controller.signal,
          },
          "multipart_part",
          part.part_number,
        );
        if (!response.ok) {
          throw new StorageTransferError({
            code: "transfer_failed",
            message: `Multipart part ${part.part_number} failed with HTTP ${response.status}`,
            operation: "multipart_part",
            status: response.status,
            partNumber: part.part_number,
          });
        }

        const etag = response.headers.get("etag")?.trim();
        if (!etag) {
          throw new StorageTransferError({
            code: "missing_etag",
            message: `Multipart part ${part.part_number} did not return an ETag`,
            operation: "multipart_part",
            status: response.status,
            partNumber: part.part_number,
          });
        }
        completed[index] = {part_number: part.part_number, etag};
      } catch (error) {
        if (firstError === undefined) firstError = error;
        controller.abort(error);
        return;
      }
    }
  };

  try {
    await Promise.all(Array.from({length: Math.min(concurrency, parts.length)}, uploadNext));
    if (firstError !== undefined) throw firstError;
    if (controller.signal.aborted) {
      throw new StorageTransferError({
        code: "aborted",
        message: "Storage transfer was aborted",
        operation: "multipart_part",
      });
    }
    return completed;
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}

export interface WaitForObjectOptions {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ObjectAvailabilityErrorCode = "availability_timeout" | "object_deleted";

export class ObjectAvailabilityError extends Error {
  readonly code: ObjectAvailabilityErrorCode;
  readonly objectId: ObjectId;
  readonly lastStatus: ObjectStatus;

  constructor(input: {
    code: ObjectAvailabilityErrorCode;
    message: string;
    objectId: ObjectId;
    lastStatus: ObjectStatus;
  }) {
    super(input.message);
    this.name = "ObjectAvailabilityError";
    this.code = input.code;
    this.objectId = input.objectId;
    this.lastStatus = input.lastStatus;
  }
}

export async function waitForObjectAvailable(
  client: StorageClient,
  objectId: ObjectId,
  options: WaitForObjectOptions = {},
): Promise<StorageObject> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    throw new RangeError("timeoutMs must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0) {
    throw new RangeError("pollIntervalMs must be a non-negative safe integer");
  }

  const deadline = Date.now() + timeoutMs;
  while (true) {
    options.signal?.throwIfAborted();
    const object = await client.request("getObject", {
      path: {object_id: objectId},
      ...(options.signal ? {signal: options.signal} : {}),
    });
    if (object.status === "available") return object;
    if (object.status === "deleted") {
      throw new ObjectAvailabilityError({
        code: "object_deleted",
        message: "The object was deleted before it became available",
        objectId,
        lastStatus: object.status,
      });
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ObjectAvailabilityError({
        code: "availability_timeout",
        message: "Timed out waiting for the object to become available",
        objectId,
        lastStatus: object.status,
      });
    }
    await abortableDelay(Math.min(pollIntervalMs, remaining), options.signal);
  }
}

export interface UploadObjectIdempotencyKeys {
  abort?: string;
  complete?: string;
  create?: string;
}

export interface UploadObjectOptions {
  fetch?: Fetch;
  idempotencyKeys?: UploadObjectIdempotencyKeys;
  multipartConcurrency?: number;
  sha256?: string;
  signal?: AbortSignal;
  waitForAvailability?: WaitForObjectOptions | boolean;
}

export type UploadWorkflowStage = "create_intent" | "transfer" | "complete";

export class UploadWorkflowError extends Error {
  readonly stage: UploadWorkflowStage;
  readonly uploadId: string | undefined;
  readonly objectId: ObjectId | undefined;
  readonly cleanupError: unknown;

  constructor(input: {
    stage: UploadWorkflowStage;
    cause: unknown;
    uploadId?: string;
    objectId?: ObjectId;
    cleanupError?: unknown;
  }) {
    super(`Storage upload failed during ${input.stage}`, {cause: input.cause});
    this.name = "UploadWorkflowError";
    this.stage = input.stage;
    this.uploadId = input.uploadId;
    this.objectId = input.objectId;
    this.cleanupError = input.cleanupError;
  }
}

export interface UploadObjectResult {
  intent: UploadIntent;
  object: StorageObject;
}

export async function uploadObject(
  client: StorageClient,
  request: CreateUploadIntentRequest,
  body: MultipartUploadBody,
  options: UploadObjectOptions = {},
): Promise<UploadObjectResult> {
  if (uploadBodySize(body) !== request.expected_size) {
    throw new StorageTransferError({
      code: "size_mismatch",
      message: "Upload body size does not match expected_size",
      operation: "upload",
    });
  }

  const idempotencyKeys = {
    create: options.idempotencyKeys?.create ?? newIdempotencyKey("upload_create"),
    complete: options.idempotencyKeys?.complete ?? newIdempotencyKey("upload_complete"),
    abort: options.idempotencyKeys?.abort ?? newIdempotencyKey("upload_abort"),
  };
  let stage: UploadWorkflowStage = "create_intent";
  let intent: UploadIntent | undefined;
  let completedObject: StorageObject;

  try {
    intent = await client.request("createUploadIntent", {
      body: request,
      idempotencyKey: idempotencyKeys.create,
      ...(options.signal ? {signal: options.signal} : {}),
    });
    stage = "transfer";

    let completedParts: Array<CompletedPart> | undefined;
    if (intent.upload_strategy === "single") {
      if (!intent.upload_url || intent.multipart !== null) {
        throw new StorageTransferError({
          code: "invalid_upload_intent",
          message: "Single-part upload requires exactly one upload URL",
          operation: "upload",
        });
      }
      await uploadDirect(
        intent.upload_url,
        uploadBodyAsBodyInit(body),
        intent.required_headers,
        options.fetch ?? globalThis.fetch,
        options.signal,
      );
    } else {
      completedParts = await uploadMultipart(intent, body, {
        ...(options.fetch ? {fetch: options.fetch} : {}),
        ...(options.multipartConcurrency === undefined ? {} : {concurrency: options.multipartConcurrency}),
        ...(options.signal ? {signal: options.signal} : {}),
      });
    }

    stage = "complete";
    const sha256 = options.sha256 ?? request.client_sha256 ?? undefined;
    completedObject = await client.request("completeUpload", {
      path: {upload_id: intent.upload_id},
      idempotencyKey: idempotencyKeys.complete,
      body: {
        ...(sha256 ? {sha256} : {}),
        ...(completedParts ? {parts: completedParts} : {}),
      },
      ...(options.signal ? {signal: options.signal} : {}),
    });
  } catch (cause) {
    let cleanupError: unknown;
    if (intent) {
      try {
        await client.request("abortUpload", {
          path: {upload_id: intent.upload_id},
          idempotencyKey: idempotencyKeys.abort,
        });
      } catch (error) {
        cleanupError = error;
      }
    }
    throw new UploadWorkflowError({
      stage,
      cause,
      ...(intent ? {uploadId: intent.upload_id, objectId: intent.object_id} : {}),
      ...(cleanupError === undefined ? {} : {cleanupError}),
    });
  }

  if (options.waitForAvailability) {
    const waitOptions = options.waitForAvailability === true ? {} : options.waitForAvailability;
    completedObject = await waitForObjectAvailable(client, intent.object_id, {
      ...waitOptions,
      ...(options.signal && !waitOptions.signal ? {signal: options.signal} : {}),
    });
  }

  return {intent, object: completedObject};
}

async function transferRequest(
  fetchImplementation: Fetch,
  url: string,
  request: RequestInit,
  operation: StorageTransferOperation,
  partNumber?: number,
): Promise<Response> {
  if (!fetchImplementation) throw new TypeError("A fetch implementation is required");
  try {
    return await fetchImplementation(url, request);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new StorageTransferError({
      code: aborted ? "aborted" : "network_error",
      message: aborted ? "Storage transfer was aborted" : "Storage transfer failed",
      operation,
      ...(partNumber === undefined ? {} : {partNumber}),
    });
  }
}

function uploadBodySize(body: MultipartUploadBody): number {
  if (body instanceof Blob) return body.size;
  return body.byteLength;
}

function sliceUploadBody(body: MultipartUploadBody, start: number, end: number): BodyInit {
  if (body instanceof Blob) return body.slice(start, end);
  if (body instanceof ArrayBuffer) return body.slice(start, end);
  return Uint8Array.from(body.subarray(start, end)).buffer;
}

function uploadBodyAsBodyInit(body: MultipartUploadBody): BodyInit {
  if (body instanceof Uint8Array) return Uint8Array.from(body).buffer;
  return body;
}

function newIdempotencyKey(prefix: string): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new TypeError("crypto.randomUUID is required when idempotency keys are not supplied");
  }
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

async function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const complete = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timeout = setTimeout(complete, milliseconds);
    signal?.addEventListener("abort", abort, {once: true});
    if (signal?.aborted) abort();
  });
}
