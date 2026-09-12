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
