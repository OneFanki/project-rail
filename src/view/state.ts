import * as fs from "node:fs";
import { colorFor, initialsFor } from "../identity";
import { defaultNameFor, isSamePath } from "../pathUtils";
import type { ProjectGroupView, ProjectViewItem, ProjectViewState } from "../protocol";
import type { Project } from "../types";

/**
 * Turns the stored list into what the webview renders.
 *
 * Separate from the provider so the grouping, "current folder" and "folder still
 * exists" rules can be unit tested without a VS Code host.
 */
export async function buildState(
  projects: Project[],
  groups: string[],
  currentFolder: string | undefined,
  openInNewWindow: boolean,
): Promise<ProjectViewState> {
  const items = await Promise.all(projects.map((project) => toViewItem(project, currentFolder)));

  const byGroup = new Map<string, ProjectViewItem[]>();
  for (const item of items) {
    const key = projectGroupOf(projects, item.path);
    const bucket = byGroup.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byGroup.set(key, [item]);
    }
  }

  // Every created group is rendered even when it is empty: an empty group is a
  // drop target, and hiding it would leave no way to drag a project into a group
  // that was just created.
  const view: ProjectGroupView[] = groups.map((group) => ({
    name: group,
    projects: byGroup.get(group) ?? [],
    isDefault: false,
  }));

  // The ungrouped bucket is rendered last with its own header. Without a header
  // its cards sit directly under the previous group's last card, which reads as
  // if they belonged to that group.
  const ungrouped = byGroup.get("") ?? [];

  // A project can reference a group that no longer exists (older state file,
  // hand edit). Those entries match no rendered section, so they are collected
  // into the ungrouped bucket instead of vanishing.
  for (const item of items) {
    const placed = view.some((group) => group.projects.some((entry) => entry.path === item.path));
    const alreadyUngrouped = ungrouped.some((entry) => entry.path === item.path);
    if (!placed && !alreadyUngrouped) {
      ungrouped.push(item);
    }
  }

  if (ungrouped.length > 0 || groups.length === 0) {
    view.push({ name: "", projects: ungrouped, isDefault: true });
  }

  return { groups: view, total: items.length, openInNewWindow };
}

function projectGroupOf(projects: Project[], path: string): string {
  return projects.find((project) => project.path === path)?.group ?? "";
}

async function toViewItem(
  project: Project,
  currentFolder: string | undefined,
): Promise<ProjectViewItem> {
  const name = defaultNameFor(project.path);
  return {
    path: project.path,
    name,
    initials: initialsFor(name),
    color: colorFor(project.path),
    exists: await isDirectory(project.path),
    current: currentFolder !== undefined && isSamePath(currentFolder, project.path),
  };
}

// Imported statically rather than via `await import("node:fs")`: esbuild emits a
// real dynamic import into the CJS bundle, and the extension host's loader does
// not resolve those, so the call rejected at runtime.
async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(target)).isDirectory();
  } catch {
    return false;
  }
}
