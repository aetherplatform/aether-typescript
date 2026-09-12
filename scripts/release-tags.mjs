export function verifyReleaseTags(release, runNpm) {
  const readTags = () => JSON.parse(runNpm(["view", release.name, "dist-tags", "--json", "--prefer-online"]));
  let tags = readTags();

  if (tags[release.tag] !== release.version) {
    throw new Error(`${release.name}: ${release.tag} does not point to ${release.version}`);
  }

  // npm may assign latest when creating a package, even for a next release.
  // Only remove the tag if it points to this exact prerelease; preserve stable releases.
  if (release.tag === "next" && tags.latest === release.version) {
    runNpm(["dist-tag", "rm", release.name, "latest"]);
    tags = readTags();
  }

  if (tags[release.tag] !== release.version || tags.latest?.includes("-")) {
    throw new Error(`${release.name}: registry dist-tags violate the release policy`);
  }
}
