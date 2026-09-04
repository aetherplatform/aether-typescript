import {ClientCredentialsTokenProvider} from "@aetherplatform/core/server";
import {StorageClient, downloadDirect, uploadObject} from "@aetherplatform/storage";

const identityUrl = required("AETHER_IDENTITY_URL");
const storageUrl = required("AETHER_STORAGE_URL");
const clientId = required("AETHER_CLIENT_ID");
const clientSecret = required("AETHER_CLIENT_SECRET");

const tokenProvider = new ClientCredentialsTokenProvider({
  tokenUrl: `${identityUrl}/oauth/token`,
  clientId,
  clientSecret,
  audience: "aether-storage",
  scope: [
    "storage:namespaces/*:manage",
    "storage:objects/*:create",
    "storage:objects/*:delete",
    "storage:objects/*:read",
    "storage:objects/*:share",
  ],
});
const storage = new StorageClient({baseUrl: storageUrl, tokenProvider});

const namespace = await storage.request("createNamespace", {
  idempotencyKey: crypto.randomUUID(),
  body: {name: `sdk-example-${Date.now()}`},
});
const payload = new TextEncoder().encode("hello from the Aether TypeScript SDK");
const {intent: upload} = await uploadObject(
  storage,
  {
    namespace_id: namespace.id,
    logical_key: "examples/hello.txt",
    filename: "hello.txt",
    content_type: "text/plain",
    expected_size: payload.byteLength,
  },
  payload,
  {waitForAvailability: true},
);
const download = await storage.request("createObjectDownloadIntent", {
  path: {object_id: upload.object_id},
});
const downloaded = await downloadDirect(download.download_url);

console.log(`Downloaded ${downloaded.byteLength} bytes from object ${download.object_id}`);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}
