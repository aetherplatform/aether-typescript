import assert from "node:assert/strict";
import test from "node:test";
import {verifyReleaseTags, waitForReleaseTags} from "../scripts/release-tags.mjs";

const beta = {name: "@aetherplatform/core", version: "0.1.0-beta.1.1", tag: "next"};

function registry(tags, versions = [beta.version]) {
  return (args) => {
    assert.equal(args[0], "view", "tag verification must not mutate registry tags");
    assert.deepEqual(args, ["view", beta.name, args[2], "--json", "--prefer-online"]);
    assert(["dist-tags", "versions"].includes(args[2]));
    return JSON.stringify(args[2] === "dist-tags" ? tags : versions);
  };
}

test("a preview-only package accepts npm's implicit latest tag", () => {
  verifyReleaseTags(beta, registry({next: beta.version, latest: beta.version}));
});

test("a next-only preview does not require a latest tag", () => {
  verifyReleaseTags(beta, registry({next: beta.version}));
});

test("a beta preserves a stable latest release", () => {
  verifyReleaseTags(beta, registry({next: beta.version, latest: "0.1.0"}, ["0.1.0", beta.version]));
});

test("a missing or mismatched next tag fails", () => {
  for (const tags of [{latest: beta.version}, {next: "0.1.0-beta.1", latest: beta.version}]) {
    assert.throws(() => verifyReleaseTags(beta, registry(tags)), /next does not point/);
  }
});

test("a prerelease cannot occupy latest after a stable version exists", () => {
  assert.throws(() => verifyReleaseTags(beta, registry({next: beta.version, latest: beta.version}, ["0.0.9", beta.version])), /violate the release policy/);
});

test("preview-only latest may lag publication, but must reference a published version", () => {
  const tags = {next: beta.version, latest: "0.1.0-beta.1"};
  verifyReleaseTags(beta, registry(tags, ["0.1.0-beta.1", beta.version]));
  assert.throws(() => verifyReleaseTags(beta, registry(tags)), /violate the release policy/);
});

test("a stable release verifies latest without changing next", () => {
  verifyReleaseTags({...beta, version: "0.1.0", tag: "latest"}, registry({next: beta.version, latest: "0.1.0"}));
});

test("publication waits for an eventually visible next tag without republishing", async () => {
  let reads = 0;
  const delays = [];
  await waitForReleaseTags(beta, (args) => {
    reads += 1;
    return registry({next: reads < 3 ? "0.1.0-beta.1" : beta.version})(args);
  }, {attempts: 3, delayMs: 5, wait: async (delay) => { delays.push(delay); }});
  assert.equal(reads, 3);
  assert.deepEqual(delays, [5, 5]);
});

test("publication still fails when registry tags do not converge within the limit", async () => {
  let waits = 0;
  await assert.rejects(waitForReleaseTags(beta, registry({next: "0.1.0-beta.1"}), {
    attempts: 3,
    wait: async () => { waits += 1; },
  }), /next does not point/);
  assert.equal(waits, 2);
});
