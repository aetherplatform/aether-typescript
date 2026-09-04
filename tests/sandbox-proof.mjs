import assert from "node:assert/strict";
import {createServer} from "node:http";

import {ClientCredentialsTokenProvider} from "../packages/core/dist/server.js";
import {StorageClient, downloadDirect, uploadObject} from "../packages/storage/dist/index.js";

const payload = Buffer.from("aether sandbox proof");
let tokenCalls = 0;
let uploaded = Buffer.alloc(0);

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const json = (status, value) => {
    response.writeHead(status, {"content-type": "application/json", "x-request-id": "req_sandbox_proof"});
    response.end(JSON.stringify(value));
  };

  if (request.method === "POST" && url.pathname === "/oauth/token") {
    tokenCalls += 1;
    assert.equal(request.headers.authorization, `Basic ${Buffer.from("client_sandbox:secret_sandbox").toString("base64")}`);
    const body = new URLSearchParams((await readBody(request)).toString());
    assert.equal(body.get("grant_type"), "client_credentials");
    assert.equal(body.get("audience"), "aether-storage");
    return json(200, {access_token: "sandbox_access_token", token_type: "Bearer", expires_in: 600, scope: body.get("scope")});
  }

  if (url.pathname.startsWith("/v1/storage/")) {
    assert.equal(request.headers.authorization, "Bearer sandbox_access_token");
  }

  if (request.method === "POST" && url.pathname === "/v1/storage/namespaces") {
    assert.ok(request.headers["idempotency-key"]);
    return json(200, {
      id: "ns_sandbox",
      organization_id: "org_sandbox",
      application_id: "client_sandbox",
      account_mode: "sandbox",
      name: "sdk-proof",
      status: "active",
      policy: {},
      created_at: new Date().toISOString(),
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/storage/upload-intents") {
    assert.ok(request.headers["idempotency-key"]);
    return json(200, {
      upload_id: "upload_sandbox",
      object_id: "obj_sandbox",
      asset_id: null,
      version_number: 1,
      upload_strategy: "single",
      upload_url: `${origin}/provider/upload`,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      required_headers: {"content-type": "text/plain"},
      multipart: null,
    });
  }

  if (request.method === "PUT" && url.pathname === "/provider/upload") {
    assert.equal(request.headers["content-type"], "text/plain");
    uploaded = await readBody(request);
    response.writeHead(200);
    return response.end();
  }

  if (request.method === "POST" && url.pathname === "/v1/storage/uploads/upload_sandbox/complete") {
    assert.deepEqual(uploaded, payload);
    return json(200, objectRecord());
  }

  if (request.method === "GET" && url.pathname === "/v1/storage/objects/obj_sandbox/download-intent") {
    return json(200, {object_id: "obj_sandbox", download_url: `${origin}/provider/download`, delivery: "signed_provider", expires_at: new Date(Date.now() + 60_000).toISOString()});
  }

  if (request.method === "GET" && url.pathname === "/provider/download") {
    response.writeHead(200, {"content-type": "text/plain"});
    return response.end(uploaded);
  }

  return json(404, {error: {code: "not_found", message: "not found"}});
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("sandbox server did not bind");
const origin = `http://127.0.0.1:${address.port}`;

try {
  const tokenProvider = new ClientCredentialsTokenProvider({
    tokenUrl: `${origin}/oauth/token`,
    clientId: "client_sandbox",
    clientSecret: "secret_sandbox",
    audience: "aether-storage",
    scope: ["storage:namespaces/*:manage", "storage:objects/*:create", "storage:objects/*:read"],
  });
  const storage = new StorageClient({baseUrl: origin, tokenProvider});
  const namespace = await storage.request("createNamespace", {idempotencyKey: "idem_namespace", body: {name: "sdk-proof"}});
  const {intent: upload} = await uploadObject(
    storage,
    {namespace_id: namespace.id, logical_key: "proof.txt", filename: "proof.txt", content_type: "text/plain", expected_size: payload.byteLength},
    payload,
    {idempotencyKeys: {create: "idem_upload", complete: "idem_complete", abort: "idem_abort"}},
  );
  const intent = await storage.request("createObjectDownloadIntent", {path: {object_id: upload.object_id}});
  const downloaded = Buffer.from(await downloadDirect(intent.download_url));

  assert.deepEqual(downloaded, payload);
  assert.equal(tokenCalls, 1, "the cached token should serve all Storage requests");
  console.log("Local sandbox proof passed: token -> namespace -> direct upload -> complete -> direct download.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function objectRecord() {
  return {
    id: "obj_sandbox",
    asset_id: null,
    namespace_id: "ns_sandbox",
    organization_id: "org_sandbox",
    application_id: "client_sandbox",
    account_mode: "sandbox",
    logical_key: "proof.txt",
    version_number: 1,
    filename: "proof.txt",
    content_type: "text/plain",
    detected_content_type: "text/plain",
    expected_size: payload.byteLength,
    actual_size: payload.byteLength,
    sha256: null,
    metadata: {},
    visibility: "private",
    status: "available",
    created_at: new Date().toISOString(),
    available_at: new Date().toISOString(),
    deleted_at: null,
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}
