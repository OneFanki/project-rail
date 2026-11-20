import * as fs from "node:fs";
import * as vscode from "vscode";
import { defaultNameFor, isSamePath } from "./pathUtils";
import type { OpenMode } from "./protocol";
import type { ProjectStore } from "./store";

const t = vscode.l10n.t;

/**
 * Adds folders picked by the user. Nothing is opened.
 */
export async function addFromFolder(store: ProjectStore): Promise<void> {
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: true,
    openLabel: t("Add Project"),
    title: t("Select folders to add"),
  });
  if (!folders || folders.length === 0) {
    return;
  }

  await addPaths(
    store,
    folders.map((uri) => uri.fsPath),
  );
}

/**
 * Saves the folder(s) already open in this window as projects.
 */
export async function addCurrentWorkspace(store: ProjectStore): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showInformationMessage(t("No folder is open in this window."));
    return;
  }

  await addPaths(
    store,
    folders.map((folder) => folder.uri.fsPath),
  );
}

/**
 * Adds the current folder, then opens it.
 *
 * In `current` mode the window is already there, so this only pins it: running
 * `vscode.openFolder` on the folder that is already open would restart the
 * extension host to end up in the same state. In `new` mode a second window is
 * genuinely wanted, so it is opened.
 */
export async function addCurrentAndOpen(store: ProjectStore, mode: OpenMode): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showInformationMessage(t("No folder is open in this window."));
    return;
  }

  const target = folders[0].uri.fsPath;
  await addPaths(store, [target]);

  if (mode === "new") {
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(target), {
      forceNewWindow: true,
    });
  }
}

/**
 * Picks a folder, pins it, and opens it in the requested window.
 */
export async function pickThenOpen(store: ProjectStore, mode: OpenMode): Promise<void> {
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: mode === "new" ? t("Open in New Window") : t("Open"),
    title: t("Select a folder to open as a project"),
  });
  if (!folders || folders.length === 0) {
    return;
  }

  const target = folders[0].fsPath;
  await addPaths(store, [target]);
  await openFolder(target, mode);
}

/**
 * Opens a pinned project.
 */
export async function openProject(
  store: ProjectStore,
  projectPath: string,
  mode: OpenMode,
): Promise<void> {
  const name = defaultNameFor(projectPath);

  if (!fs.existsSync(projectPath)) {
    const removeLabel = t("Remove from List");
    const answer = await vscode.window.showErrorMessage(
      t('"{0}" no longer exists at {1}', name, projectPath),
      removeLabel,
    );
    if (answer === removeLabel) {
      await store.remove(projectPath);
    }
    return;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (
    mode === "current" &&
    folders?.length === 1 &&
    isSamePath(folders[0].uri.fsPath, projectPath)
  ) {
    void vscode.window.showInformationMessage(t("{0} is already open.", name));
    return;
  }

  await openFolder(projectPath, mode);
}

/** Removes a pinned project. The folder itself is never touched. */
export async function removeProject(store: ProjectStore, projectPath: string): Promise<void> {
  const name = defaultNameFor(projectPath);
  const removeLabel = t("Remove");
  const answer = await vscode.window.showWarningMessage(
    t('Remove "{0}" from the list?', name),
    { modal: true, detail: t("The folder itself is not deleted.") },
    removeLabel,
  );
  if (answer === removeLabel) {
    await store.remove(projectPath);
  }
}

export function revealProject(projectPath: string): void {
  void vscode.env.openExternal(vscode.Uri.file(projectPath));
}

/**
 * Moves a project straight into `group`.
 *
 * Used by drag and drop, where the pointer already named the destination, so no
 * prompt is shown. The QuickPick variant below exists for the context menu, where
 * the user has not said where the project should go.
 */
export async function setProjectGroup(
  store: ProjectStore,
  projectPath: string,
  group: string,
): Promise<void> {
  await store.setGroup(projectPath, group);
}

/** Asks which group a project should move to, creating one on demand. */
export async function moveProjectToGroup(store: ProjectStore, projectPath: string): Promise<void> {
  const groups = store.groups();

  const NEW_GROUP = "$new";
  const picked = await vscode.window.showQuickPick(
    [
      { label: t("No group"), value: "" },
      ...groups.map((group) => ({ label: group, value: group })),
      { label: `$(add) ${t("New group...")}`, value: NEW_GROUP },
    ],
    { placeHolder: t("Move to group...") },
  );
  if (!picked) {
    return;
  }

  if (picked.value === NEW_GROUP) {
    const name = await vscode.window.showInputBox({
      prompt: t("Group name"),
      validateInput: (value) => {
        const trimmed = value.trim();
        if (trimmed === "") {
          return t("The group name cannot be empty.");
        }
        if (groups.includes(trimmed)) {
          return t("A group with that name already exists.");
        }
        return undefined;
      },
    });
    if (name === undefined) {
      return;
    }
    await store.createGroup(name);
    await store.setGroup(projectPath, name.trim());
    return;
  }

  await store.setGroup(projectPath, picked.value);
}

/** Prompts for a new group name. */
export async function createGroup(store: ProjectStore): Promise<void> {
  const groups = store.groups();
  const name = await vscode.window.showInputBox({
    prompt: t("New group name"),
    validateInput: (value) => {
      const trimmed = value.trim();
      if (trimmed === "") {
        return t("The group name cannot be empty.");
      }
      if (groups.includes(trimmed)) {
        return t("A group with that name already exists.");
      }
      return undefined;
    },
  });
  if (name !== undefined) {
    await store.createGroup(name);
  }
}

export async function renameGroup(store: ProjectStore, group: string): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: t('Rename group "{0}"', group),
    value: group,
    valueSelection: [0, group.length],
    validateInput: (value) =>
      value.trim() === "" ? t("The group name cannot be empty.") : undefined,
  });
  if (name !== undefined) {
    await store.renameGroup(group, name);
  }
}

export async function deleteGroup(store: ProjectStore, group: string): Promise<void> {
  const members = store.list().filter((project) => project.group === group).length;

  const detail =
    members === 0
      ? t("The group is empty.")
      : members === 1
        ? t("One project will be kept and moved out of the group.")
        : t("{0} projects will be kept and moved out of the group.", members);

  const deleteLabel = t("Delete Group");
  const answer = await vscode.window.showWarningMessage(
    t('Delete group "{0}"?', group),
    { modal: true, detail },
    deleteLabel,
  );
  if (answer === deleteLabel) {
    await store.deleteGroup(group);
  }
}

async function addPaths(store: ProjectStore, paths: string[]): Promise<void> {
  const added = await store.add(paths);
  const skipped = paths.filter((path) => !added.some((entry) => entry.path === path));
  if (skipped.length > 0) {
    void vscode.window.showInformationMessage(
      skipped.length === 1
        ? t("{0} is already in the list.", defaultNameFor(skipped[0]))
        : t("{0} folders were already in the list.", skipped.length),
    );
  }
}

async function openFolder(target: string, mode: OpenMode): Promise<void> {
  const uri = vscode.Uri.file(target);
  if (mode === "new") {
    await vscode.commands.executeCommand("vscode.openFolder", uri, { forceNewWindow: true });
  } else {
    // Replacing the workspace of this window shuts down this extension host.
    // That is what switching projects means.
    await vscode.commands.executeCommand("vscode.openFolder", uri, { forceReuseWindow: true });
  }
}
