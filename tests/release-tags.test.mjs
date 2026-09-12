import assert from "node:assert/strict";
import test from "node:test";
import {verifyReleaseTags} from "../scripts/release-tags.mjs";

const beta = {name: "@aetherplatform/core", version: "0.1.0-beta.1", tag: "next"};

function registry(initial, {removeWorks = true} = {}) {
  const tags = {...initial};
  const mutations = [];
  const runNpm = (args) => {
    if (args[0] === "view") {
      assert.deepEqual(args, ["view", beta.name, "dist-tags", "--json", "--prefer-online"]);
      return JSON.stringify(tags);
    }
    assert.deepEqual(args, ["dist-tag", "rm", beta.name, "latest"]);
    mutations.push(args);
    if (removeWorks) delete tags.latest;
    return "";
  };
  return {tags, mutations, runNpm};
}

test("first beta removes npm's implicit latest tag and verifies next", () => {
  const state = registry({next: beta.version, latest: beta.version});
  verifyReleaseTags(beta, state.runNpm);
  assert.deepEqual(state.tags, {next: beta.version});
  assert.equal(state.mutations.length, 1);
});

test("a repeated release leaves a correct next-only package unchanged", () => {
  const state = registry({next: beta.version});
  verifyReleaseTags(beta, state.runNpm);
  assert.equal(state.mutations.length, 0);
});

test("a beta never removes an existing stable latest release", () => {
  const state = registry({next: beta.version, latest: "0.0.9"});
  verifyReleaseTags(beta, state.runNpm);
  assert.equal(state.tags.latest, "0.0.9");
  assert.equal(state.mutations.length, 0);
});

test("a missing or mismatched next tag fails before any mutation", () => {
  for (const tags of [{latest: beta.version}, {next: "0.1.0-beta.2", latest: beta.version}]) {
    const state = registry(tags);
    assert.throws(() => verifyReleaseTags(beta, state.runNpm), /next does not point/);
    assert.equal(state.mutations.length, 0);
  }
});

test("a successful command with an unchanged invalid tag still fails", () => {
  const state = registry({next: beta.version, latest: beta.version}, {removeWorks: false});
  assert.throws(() => verifyReleaseTags(beta, state.runNpm), /violate the release policy/);
});

test("an unexpected different prerelease on latest fails without removing it", () => {
  const state = registry({next: beta.version, latest: "0.2.0-beta.1"});
  assert.throws(() => verifyReleaseTags(beta, state.runNpm), /violate the release policy/);
  assert.equal(state.mutations.length, 0);
});

test("a stable release verifies latest without changing the next channel", () => {
  const state = registry({next: beta.version, latest: "0.1.0"});
  verifyReleaseTags({...beta, version: "0.1.0", tag: "latest"}, state.runNpm);
  assert.equal(state.tags.next, beta.version);
  assert.equal(state.mutations.length, 0);
});
