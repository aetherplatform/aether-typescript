import { readFileSync, writeFileSync } from "node:fs";

const [platform, inputPath, outputPath] = process.argv.slice(2);
if (!platform || !inputPath || !outputPath) {
  console.error("usage: generate_typescript_sdk.mjs PLATFORM INPUT.json OUTPUT.ts");
  process.exit(2);
}

const document = JSON.parse(readFileSync(inputPath, "utf8"));
const schemas = document.components?.schemas ?? {};
const schemaNamesByValue = new Map(
  Object.entries(schemas).map(([name, schema]) => [JSON.stringify(schema), name]),
);
const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function propertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function schemaType(schema, currentName = null) {
  if (!schema || typeof schema !== "object") return "unknown";

  const matchingName = schemaNamesByValue.get(JSON.stringify(schema));
  if (matchingName && matchingName !== currentName) return matchingName;
  if (Object.hasOwn(schema, "const")) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ") || "never";
  }
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map((value) => schemaType(value, currentName)).join(" | ");
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map((value) => schemaType(value, currentName)).join(" | ");
  if (Array.isArray(schema.allOf)) return schema.allOf.map((value) => `(${schemaType(value, currentName)})`).join(" & ");
  if (Array.isArray(schema.type)) return schema.type.map((type) => schemaType({ ...schema, type }, currentName)).join(" | ");

  switch (schema.type) {
    case "null": return "null";
    case "boolean": return "boolean";
    case "integer":
    case "number": return "number";
    case "string": return "string";
    case "array": return `Array<${schemaType(schema.items, currentName)}>`;
    case "object": {
      const required = new Set(schema.required ?? []);
      const properties = Object.entries(schema.properties ?? {}).map(([name, value]) => {
        const optional = required.has(name) ? "" : "?";
        return `${propertyName(name)}${optional}: ${schemaType(value, currentName)};`;
      });
      if (schema.additionalProperties === true) properties.push("[key: string]: unknown;");
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        properties.push(`[key: string]: ${schemaType(schema.additionalProperties, currentName)};`);
      }
      return `{ ${properties.join(" ")} }`;
    }
    default:
      if (schema.properties) return schemaType({ ...schema, type: "object" }, currentName);
      return "unknown";
  }
}

function contentSchema(container) {
  const content = container?.content ?? {};
  return content["application/json"]?.schema ?? content["application/x-www-form-urlencoded"]?.schema;
}

function successResponse(operation) {
  return Object.entries(operation.responses ?? {})
    .filter(([status]) => /^[23]\d\d$/.test(status))
    .sort(([left], [right]) => Number(left) - Number(right))[0];
}

function parameterType(parameters, location) {
  const selected = parameters.filter((parameter) => parameter.in === location);
  if (selected.length === 0) return "Record<string, never>";
  return `{ ${selected.map((parameter) => `${propertyName(parameter.name)}${parameter.required ? "" : "?"}: ${schemaType(parameter.schema)};`).join(" ")} }`;
}

function idempotency(operation, method, parameters) {
  if (operation["x-aether-idempotency"]) return operation["x-aether-idempotency"];
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return "not_applicable";
  const key = parameters.find((parameter) => parameter.in === "header" && parameter.name.toLowerCase() === "idempotency-key");
  return key?.required ? "required" : "unsupported";
}

const operations = [];
for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  const pathParameters = pathItem.parameters ?? [];
  for (const [methodName, operation] of Object.entries(pathItem)) {
    if (!methods.has(methodName)) continue;
    const method = methodName.toUpperCase();
    const parameters = [...pathParameters, ...(operation.parameters ?? [])];
    const success = successResponse(operation);
    operations.push({
      method,
      path,
      operation,
      parameters,
      request: contentSchema(operation.requestBody),
      response: success ? contentSchema(success[1]) : undefined,
      successStatuses: Object.keys(operation.responses ?? {}).filter((status) => /^[23]\d\d$/.test(status)).map(Number),
      idempotency: idempotency(operation, method, parameters),
    });
  }
}
operations.sort((left, right) => left.operation.operationId.localeCompare(right.operation.operationId));

const interfaceName = `${platform[0].toUpperCase()}${platform.slice(1)}Operations`;
const lines = [
  "// Generated from the canonical Aether OpenAPI contract. Do not edit.",
  `// Source: contracts/openapi/v1/${platform}.yaml`,
  "",
];

for (const [name, schema] of Object.entries(schemas)) {
  lines.push(`export type ${name} = ${schemaType(schema, name)};`, "");
}

lines.push(`export interface ${interfaceName} {`);
for (const entry of operations) {
  lines.push(
    `  ${propertyName(entry.operation.operationId)}: {`,
    `    request: ${entry.request ? schemaType(entry.request) : "never"};`,
    `    response: ${entry.response ? schemaType(entry.response) : "void"};`,
    `    path: ${parameterType(entry.parameters, "path")};`,
    `    query: ${parameterType(entry.parameters, "query")};`,
    "  };",
  );
}
lines.push("}", "");

lines.push("export const operations = {");
for (const entry of operations) {
  lines.push(
    `  ${propertyName(entry.operation.operationId)}: {`,
    `    method: ${JSON.stringify(entry.method)},`,
    `    path: ${JSON.stringify(entry.path)},`,
    `    tokenProfiles: ${JSON.stringify(entry.operation["x-aether-token-profiles"] ?? [])},`,
    `    requiredCapability: ${JSON.stringify(entry.operation["x-aether-required-capability"] ?? null)},`,
    `    availability: ${JSON.stringify(entry.operation["x-aether-availability"] ?? [])},`,
    `    idempotency: ${JSON.stringify(entry.idempotency)},`,
    `    successStatuses: ${JSON.stringify(entry.successStatuses)},`,
    "  },",
  );
}
lines.push("} as const;");

writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`Generated ${platform}: ${Object.keys(schemas).length} schemas, ${operations.length} operations.`);
