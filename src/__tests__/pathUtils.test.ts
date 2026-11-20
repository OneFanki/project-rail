import * as assert from "node:assert/strict";
import * as path from "node:path";
import { describe, it } from "vitest";
import { defaultNameFor, isSamePath } from "../pathUtils";

describe("isSamePath", () => {
  it("matches identical paths", () => {
    assert.equal(isSamePath("/a/b/c", "/a/b/c"), true);
  });

  it("ignores a trailing separator", () => {
    assert.equal(isSamePath("/a/b/c/", "/a/b/c"), true);
  });

  it("ignores redundant segments", () => {
    assert.equal(isSamePath("/a/b/../b/c", "/a/b/c"), true);
  });

  it("separates different paths", () => {
    assert.equal(isSamePath("/a/b/c", "/a/b/d"), false);
  });

  it("compares case-insensitively on Windows only", () => {
    const same = isSamePath("C:\\Code\\App", "c:\\code\\app");
    assert.equal(same, process.platform === "win32");
  });

  it("treats slash styles as equivalent on Windows", () => {
    const same = isSamePath("C:\\Code\\App", "C:/Code/App");
    assert.equal(same, process.platform === "win32");
  });

  // A prefix is not a match: pinning /a/b must not claim /a/bc is the same folder.
  it("does not treat a name prefix as a match", () => {
    assert.equal(isSamePath("/a/b", "/a/bc"), false);
  });
});

describe("defaultNameFor", () => {
  it("uses the last segment", () => {
    assert.equal(defaultNameFor(path.join("a", "b", "web-storefront")), "web-storefront");
  });

  it("ignores a trailing separator", () => {
    assert.equal(defaultNameFor(`${path.join("a", "b")}${path.sep}`), "b");
  });
});
