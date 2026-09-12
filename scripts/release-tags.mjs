import {setTimeout as sleep} from "node:timers/promises";

export async function waitForReleaseTags(release, runNpm, {attempts = 25, delayMs = 5_000, wait = sleep} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      verifyReleaseTags(release, runNpm);
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`${release.name}: waiting for registry tag propagation (${attempt}/${attempts})`);
      await wait(delayMs);
    }
  }
}

export function verifyReleaseTags(release, runNpm) {
  const tags = JSON.parse(runNpm(["view", release.name, "dist-tags", "--json", "--prefer-online"]));
  if (tags[release.tag] !== release.version) {
    throw new Error(`${release.name}: ${release.tag} does not point to ${release.version}`);
  }

  // npm retains latest on a newly created package even when published under next.
  // A preview may occupy latest only while no non-prerelease version exists.
  if (release.tag === "next" && tags.latest?.includes("-")) {
    const versions = [JSON.parse(runNpm(["view", release.name, "versions", "--json", "--prefer-online"]))].flat();
    if (!versions.includes(tags.latest) || versions.some((version) => !version.includes("-"))) {
      throw new Error(`${release.name}: registry dist-tags violate the release policy`);
    }
  }
}
