// Generated from the canonical Aether OpenAPI contract. Do not edit.
// Source: contracts/openapi/v1/storage.yaml

export type NamespaceId = string;

export type AssetId = string;

export type UploadId = string;

export type ObjectId = string;

export type LogicalKey = string;

export type Metadata = { [key: string]: unknown; };

export type ObjectStatus = "pending" | "uploading" | "available" | "quarantined" | "processing" | "deleted";

export type NamespacePolicy = { lifecycle?: LifecyclePolicy; quota?: QuotaPolicy; };

export type LifecyclePolicy = { expire_after_seconds?: number; keep_latest_versions?: number; deleted_retention_seconds?: number; };

export type QuotaPolicy = { max_bytes?: number; max_objects?: number; };

export type CreateNamespaceRequest = { name: string; policy?: NamespacePolicy; };

export type Namespace = { id: NamespaceId; organization_id: string; application_id: string; account_mode: "sandbox" | "live"; name: string; status: "active" | "disabled"; policy: NamespacePolicy; created_at: string; };

export type Usage = { namespace_id: NamespaceId; organization_id: string; application_id: string; account_mode: "sandbox" | "live"; stored_bytes: number; reserved_bytes: number; total_bytes: number; stored_objects: number; reserved_objects: number; total_objects: number; quota_max_bytes: number | null; quota_max_objects: number | null; updated_at: string; };

export type CreateAssetRequest = { namespace_id: NamespaceId; entity_type?: string | null; entity_id?: string | null; metadata?: Metadata; };

export type Asset = { id: AssetId; namespace_id: NamespaceId; organization_id: string; application_id: string; account_mode: "sandbox" | "live"; entity_type: string | null; entity_id: string | null; status: "active" | "disabled"; metadata: Metadata; created_at: string; };

export type DeleteAssetResult = { asset_id: AssetId; deleted_count: number; status: "deleted"; };

export type CreateUploadIntentRequest = { namespace_id: NamespaceId; asset_id?: AssetId | null; logical_key: LogicalKey; filename: string; content_type: string; expected_size: number; client_sha256?: string | null; visibility?: "private" | "public"; metadata?: Metadata; };

export type UploadIntent = { upload_id: UploadId; object_id: ObjectId; asset_id: AssetId | null; version_number: number; upload_strategy: "single" | "multipart"; upload_url: string | null; expires_at: string; required_headers: { [key: string]: string; }; multipart: MultipartInstructions | null; };

export type MultipartInstructions = { provider_upload_id: string; part_size: number; parts: Array<MultipartPart>; };

export type MultipartPart = { part_number: number; upload_url: string; };

export type CompleteUploadRequest = { sha256?: string | null; parts?: Array<CompletedPart> | null; };

export type CompletedPart = { part_number: number; etag: string; };

export type AbortUploadResult = { upload_id: UploadId; status: "aborted"; };

export type Object = { id: ObjectId; asset_id: AssetId | null; namespace_id: NamespaceId; organization_id: string; application_id: string; account_mode: "sandbox" | "live"; logical_key: LogicalKey; version_number: number; filename: string; content_type: string; detected_content_type: string | null; expected_size: number; actual_size: number | null; sha256: string | null; metadata: Metadata; visibility: "private" | "public"; status: ObjectStatus; created_at: string; available_at: string | null; deleted_at: string | null; };

export type DownloadIntent = { object_id: ObjectId; download_url: string; delivery: "cdn" | "signed_provider"; expires_at: string | null; };

export type KeyedDownloadIntent = (DownloadIntent) & ({ filename: string; content_type: string; size: number | null; checksum: string | null; });

export type ObjectSearchResponse = { objects: Array<Object>; next_cursor: string | null; };

export interface StorageOperations {
  abortUpload: {
    request: never;
    response: AbortUploadResult;
    path: { upload_id: UploadId; };
    query: Record<string, never>;
  };
  completeUpload: {
    request: CompleteUploadRequest;
    response: Object;
    path: { upload_id: UploadId; };
    query: Record<string, never>;
  };
  createAsset: {
    request: CreateAssetRequest;
    response: Asset;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createNamespace: {
    request: CreateNamespaceRequest;
    response: Namespace;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createObjectDownloadIntent: {
    request: never;
    response: DownloadIntent;
    path: { object_id: ObjectId; };
    query: Record<string, never>;
  };
  createObjectDownloadIntentByKey: {
    request: never;
    response: KeyedDownloadIntent;
    path: Record<string, never>;
    query: { namespace: string; key: LogicalKey; };
  };
  createUploadIntent: {
    request: CreateUploadIntentRequest;
    response: UploadIntent;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  deleteAsset: {
    request: never;
    response: DeleteAssetResult;
    path: { asset_id: AssetId; };
    query: Record<string, never>;
  };
  deleteObject: {
    request: never;
    response: Object;
    path: { object_id: ObjectId; };
    query: Record<string, never>;
  };
  getAsset: {
    request: never;
    response: Asset;
    path: { asset_id: AssetId; };
    query: Record<string, never>;
  };
  getNamespace: {
    request: never;
    response: Namespace;
    path: { namespace_id: NamespaceId; };
    query: Record<string, never>;
  };
  getNamespaceUsage: {
    request: never;
    response: Usage;
    path: Record<string, never>;
    query: { namespace_id: NamespaceId; };
  };
  getObject: {
    request: never;
    response: Object;
    path: { object_id: ObjectId; };
    query: Record<string, never>;
  };
  listAssetVersions: {
    request: never;
    response: Array<Object>;
    path: { asset_id: AssetId; };
    query: Record<string, never>;
  };
  listNamespaces: {
    request: never;
    response: Array<Namespace>;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  resolveObject: {
    request: never;
    response: Object;
    path: Record<string, never>;
    query: { namespace_id: NamespaceId; key: LogicalKey; version?: number; };
  };
  restoreObject: {
    request: never;
    response: Object;
    path: { object_id: ObjectId; };
    query: Record<string, never>;
  };
  searchObjects: {
    request: never;
    response: ObjectSearchResponse;
    path: Record<string, never>;
    query: { namespace_id: NamespaceId; prefix?: string; asset_id?: AssetId; entity_type?: string; entity_id?: string; content_type?: string; status?: ObjectStatus; created_after?: string; created_before?: string; cursor?: string; limit?: number; };
  };
}

export const operations = {
  abortUpload: {
    method: "POST",
    path: "/v1/storage/uploads/{upload_id}/abort",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:delete",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  completeUpload: {
    method: "POST",
    path: "/v1/storage/uploads/{upload_id}/complete",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:create",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  createAsset: {
    method: "POST",
    path: "/v1/storage/assets",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:assets/*:create",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  createNamespace: {
    method: "POST",
    path: "/v1/storage/namespaces",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:namespaces/*:manage",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  createObjectDownloadIntent: {
    method: "GET",
    path: "/v1/storage/objects/{object_id}/download-intent",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/{object_id}:share",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  createObjectDownloadIntentByKey: {
    method: "GET",
    path: "/v1/storage/objects/download-intent",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:share",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  createUploadIntent: {
    method: "POST",
    path: "/v1/storage/upload-intents",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:create",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  deleteAsset: {
    method: "DELETE",
    path: "/v1/storage/assets/{asset_id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:assets/{asset_id}:delete",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  deleteObject: {
    method: "DELETE",
    path: "/v1/storage/objects/{object_id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/{object_id}:delete",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  getAsset: {
    method: "GET",
    path: "/v1/storage/assets/{asset_id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:assets/{asset_id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getNamespace: {
    method: "GET",
    path: "/v1/storage/namespaces/{namespace_id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:namespaces/{namespace_id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getNamespaceUsage: {
    method: "GET",
    path: "/v1/storage/usage",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:usage/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getObject: {
    method: "GET",
    path: "/v1/storage/objects/{object_id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/{object_id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listAssetVersions: {
    method: "GET",
    path: "/v1/storage/assets/{asset_id}/versions",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:assets/{asset_id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listNamespaces: {
    method: "GET",
    path: "/v1/storage/namespaces",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:namespaces/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  resolveObject: {
    method: "GET",
    path: "/v1/storage/objects",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  restoreObject: {
    method: "POST",
    path: "/v1/storage/objects/{object_id}/restore",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/{object_id}:update",
    availability: ["sandbox","live"],
    idempotency: "required",
    successStatuses: [200],
  },
  searchObjects: {
    method: "GET",
    path: "/v1/storage/objects/search",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "storage:objects/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
} as const;
