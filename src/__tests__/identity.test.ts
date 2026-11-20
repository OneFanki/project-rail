import * as assert from "node:assert/strict";
import { describe, it } from "vitest";
import { colorFor, initialsFor } from "../identity";

describe("initialsFor", () => {
  it("uses the first character of CJK names", () => {
    assert.equal(initialsFor("项目切换"), "项");
  });

  it("uses word initials for hyphenated names", () => {
    assert.equal(initialsFor("web-storefront"), "WS");
  });

  it("keeps sibling projects distinguishable", () => {
    // A plain prefix would render both as "WE", which is the bug this guards.
    assert.notEqual(initialsFor("web-storefront"), initialsFor("web-portal"));
  });

  it("uses word initials for underscored and dotted names", () => {
    assert.equal(initialsFor("my_cool.app"), "MC");
  });

  it("falls back to two characters for single words", () => {
    assert.equal(initialsFor("photos"), "PH");
  });

  it("handles a name with no usable characters", () => {
    assert.equal(initialsFor("   "), "?");
  });
});

describe("colorFor", () => {
  it("is stable for the same seed", () => {
    assert.equal(colorFor("/code/a"), colorFor("/code/a"));
  });

  it("returns a hex colour", () => {
    assert.match(colorFor("/code/a"), /^#[0-9a-f]{6}$/);
  });

  it("spreads sibling paths across the palette", () => {
    const colours = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((name) => colorFor(`/code/${name}`)),
    );
    // Not a strict guarantee for any given set of names, but a hash that collapses
    // everything onto one colour would defeat the point of the badge.
    assert.ok(colours.size > 1);
  });
});
