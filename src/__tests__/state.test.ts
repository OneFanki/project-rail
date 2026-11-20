import * as assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { Project } from "../types";
import { buildState } from "../view/state";

let root: string;
let projectDir: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "project-rail-"));
  projectDir = path.join(root, "web-storefront");
  await mkdir(projectDir, { recursive: true });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const project = (name: string, group = ""): Project => ({
  path: path.join(root, name),
  group,
});

describe("buildState", () => {
  it("marks the folder that is open in this window", async () => {
    const state = await buildState([project("web-storefront")], [], projectDir, false);
    assert.equal(state.groups[0].projects[0].current, true);
  });

  it("does not mark a different folder as current", async () => {
    const state = await buildState(
      [project("web-storefront")],
      [],
      path.join(root, "other"),
      false,
    );
    assert.equal(state.groups[0].projects[0].current, false);
  });

  it("marks nothing as current when no folder is open", async () => {
    const state = await buildState([project("web-storefront")], [], undefined, false);
    assert.equal(state.groups[0].projects[0].current, false);
  });

  it("labels a project with the folder's own name", async () => {
    const state = await buildState([project("web-storefront")], [], undefined, false);
    assert.equal(state.groups[0].projects[0].name, "web-storefront");
  });

  it("flags a folder that no longer exists", async () => {
    const state = await buildState([project("deleted")], [], undefined, false);
    assert.equal(state.groups[0].projects[0].exists, false);
    assert.equal(state.total, 1);
  });

  it("treats a file as missing, not as a project", async () => {
    const file = path.join(root, "not-a-folder.txt");
    await writeFile(file, "x");

    const state = await buildState([{ path: file, group: "" }], [], undefined, false);
    assert.equal(state.groups[0].projects[0].exists, false);
  });

  it("carries the setting through so the webview can label the action", async () => {
    const state = await buildState([], [], undefined, true);
    assert.equal(state.openInNewWindow, true);
  });

  it("puts grouped projects under their group, ungrouped last", async () => {
    const state = await buildState(
      [project("a", "work"), project("b"), project("c", "work")],
      ["work"],
      undefined,
      false,
    );

    assert.deepEqual(
      state.groups.map((group) => group.name),
      ["work", ""],
    );
    assert.deepEqual(
      state.groups[0].projects.map((item) => item.name),
      ["a", "c"],
    );
    assert.deepEqual(
      state.groups[1].projects.map((item) => item.name),
      ["b"],
    );
  });

  // A group that was just created has no members yet. Hiding it would leave
  // nothing to drag a project onto.
  it("keeps an empty group in the view", async () => {
    const state = await buildState([project("a")], ["空分组"], undefined, false);
    assert.deepEqual(
      state.groups.map((group) => group.name),
      ["空分组", ""],
    );
    assert.deepEqual(state.groups[0].projects, []);
    assert.equal(state.groups[0].isDefault, false);
  });

  it("marks the ungrouped bucket so the webview can label it", async () => {
    const state = await buildState(
      [project("a", "work"), project("b")],
      ["work"],
      undefined,
      false,
    );
    const ungrouped = state.groups.find((group) => group.name === "");
    assert.ok(ungrouped);
    assert.equal(ungrouped.isDefault, true);
    assert.deepEqual(
      ungrouped.projects.map((item) => item.name),
      ["b"],
    );
  });

  // Without an ungrouped bucket of its own, ungrouped cards would render directly
  // beneath the last group and read as members of it.
  it("does not lose a project whose group is not in the group list", async () => {
    const state = await buildState([project("a", "ghost")], [], undefined, false);
    const all = state.groups.flatMap((group) => group.projects.map((item) => item.name));
    assert.deepEqual(all, ["a"]);
  });

  it("does not duplicate a project that is already ungrouped", async () => {
    const state = await buildState([project("a"), project("b", "ghost")], [], undefined, false);
    const all = state.groups.flatMap((group) => group.projects.map((item) => item.name));
    assert.deepEqual(all.sort(), ["a", "b"]);
  });

  it("emits an ungrouped bucket when there are no groups at all", async () => {
    const state = await buildState([], [], undefined, false);
    // The empty state still needs a section, otherwise the webview has no drop
    // target for moving a project out of a group.
    assert.deepEqual(
      state.groups.map((group) => group.name),
      [""],
    );
    assert.equal(state.groups[0].isDefault, true);
  });
});
