// Fails if a file that has no business in a published package ended up in the
// VSIX.
//
// .vscodeignore is a pattern list: a file no pattern matches simply ships. A
// package is published to the marketplace, so anything that never needed to be
// there is at best dead weight. This reads the archive instead of trusting the
// ignore file, because the check has to fail on what actually shipped.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const vsix = process.argv[2];

if (!vsix || !existsSync(vsix)) {
  console.error(`Usage: node scripts/check-vsix.mjs <file.vsix>  (got: ${vsix ?? "nothing"})`);
  process.exit(2);
}

// Entries are normalised to forward slashes before matching: some archivers on
// Windows write `extension\media\icon.png`, and patterns anchored on "/" then
// miss everything.
const FORBIDDEN = [
  // Local tooling, development aids and their output.
  /(^|\/)scripts\//,
  /(^|\/)\.p-[^/]*$/,
  /(^|\/)\.(preview|listing|candidates|shot-|t-|clean-terms)[^/]*$/,
  /(^|\/)node_modules\//,
  // Files that are never useful in an extension and often hold local state.
  /(^|\/)\.git[^/]*(\/|$)/,
  /(^|\/)\.env[^/]*$/,
  /(^|\/)\.vscode\//,
  /(^|\/)\.github\//,
];

const listing = execFileSync("unzip", ["-Z1", vsix], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((entry) => entry.replace(/\\/g, "/"));

const offenders = listing.filter((entry) => FORBIDDEN.some((re) => re.test(entry)));

console.log(`checked ${listing.length} entries in ${vsix}`);

if (offenders.length > 0) {
  console.error("\nFILES THAT SHOULD NOT SHIP:");
  for (const entry of offenders) console.error(`  ${entry}`);
  console.error("\nAdd a .vscodeignore rule and repackage.");
  process.exit(1);
}

// The listing body and the icon are what the marketplace shows; both are
// required, and both are easy to drop with an over-broad ignore rule.
const required = ["readme.md", "media/icon.png"];
const missing = required.filter((name) => !listing.some((e) => e.endsWith(name)));
if (missing.length > 0) {
  console.error(`\nMISSING REQUIRED FILES: ${missing.join(", ")}`);
  process.exit(1);
}

// A README with no screenshot means the listing page renders as a wall of text.
const readme = execFileSync("unzip", ["-p", vsix, "extension/readme.md"], { encoding: "utf8" });
const imageRefs = readme.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
console.log(`readme: ${readme.length} chars, ${imageRefs.length} image reference(s)`);
if (imageRefs.length === 0) {
  console.warn("warning: README has no images — the listing page will be text only");
}

console.log("package contents ok");
