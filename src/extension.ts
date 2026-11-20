import * as vscode from "vscode";
import {
  addCurrentAndOpen,
  addCurrentWorkspace,
  addFromFolder,
  createGroup,
  deleteGroup,
  moveProjectToGroup,
  openProject,
  pickThenOpen,
  removeProject,
  renameGroup,
  revealProject,
  setProjectGroup,
} from "./actions";
import { defaultNameFor } from "./pathUtils";
import type { OpenMode } from "./protocol";
import { ProjectStore } from "./store";
import { ProjectsViewProvider } from "./view/provider";

export function activate(context: vscode.ExtensionContext): void {
  const store = new ProjectStore(context);

  const provider = new ProjectsViewProvider(context.extensionUri, {
    store,
    isOpenInNewWindow,
    addFromFolder: () => addFromFolder(store),
    addCurrentWorkspace: () => addCurrentWorkspace(store),
    pickThenOpen: (mode) => pickThenOpen(store, mode),
    openProject: (path, mode) => openProject(store, path, mode),
    removeProject: (path) => removeProject(store, path),
    revealProject,
    createGroup: () => createGroup(store),
    renameGroup: (group) => renameGroup(store, group),
    deleteGroup: (group) => deleteGroup(store, group),
    moveProjectToGroup: (path) => moveProjectToGroup(store, path),
    setProjectGroup: (path, group) => setProjectGroup(store, path, group),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ProjectsViewProvider.viewType, provider, {
      // The list is cheap to rebuild, and keeping it alive while hidden would let
      // the "current project" marker go stale without anyone noticing.
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );

  const refresh = (): void => void provider.pushState();

  const register = <Args extends unknown[]>(
    id: string,
    handler: (...args: Args) => unknown,
  ): void => {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, handler as (...args: unknown[]) => unknown),
    );
  };

  // Everything below is also reachable from the command palette, so the webview
  // is a convenience surface rather than the only way in.
  register("projectRail.add", async () => {
    await addFromFolder(store);
    refresh();
  });

  register("projectRail.addCurrent", async () => {
    await addCurrentWorkspace(store);
    refresh();
  });

  register("projectRail.addCurrentAndOpen", async (mode?: OpenMode) => {
    await addCurrentAndOpen(store, mode ?? defaultMode());
    refresh();
  });

  register("projectRail.pickAndOpen", async (mode?: OpenMode) => {
    await pickThenOpen(store, mode ?? defaultMode());
    refresh();
  });

  register("projectRail.open", async (path?: string) => {
    const target = path ?? (await pickProject(store));
    if (target) {
      await openProject(store, target, defaultMode());
      refresh();
    }
  });

  register("projectRail.openCurrentWindow", async (path?: string) => {
    const target = path ?? (await pickProject(store));
    if (target) {
      await openProject(store, target, "current");
      refresh();
    }
  });

  register("projectRail.openNewWindow", async (path?: string) => {
    const target = path ?? (await pickProject(store));
    if (target) {
      await openProject(store, target, "new");
      refresh();
    }
  });

  register("projectRail.remove", async (path?: string) => {
    const target = path ?? (await pickProject(store));
    if (target) {
      await removeProject(store, target);
      refresh();
    }
  });

  register("projectRail.reveal", (path?: string) => {
    if (path) {
      revealProject(path);
    }
  });

  // Bound to the refresh icon in the view title. Registered separately from the
  // webview's message handling because the toolbar button lives outside it, so
  // nothing in the webview can trigger it.
  register("projectRail.refresh", refresh);

  register("projectRail.newGroup", async () => {
    await createGroup(store);
    refresh();
  });

  register("projectRail.renameGroup", async (group?: string) => {
    if (group) {
      await renameGroup(store, group);
      refresh();
    }
  });

  register("projectRail.deleteGroup", async (group?: string) => {
    if (group) {
      await deleteGroup(store, group);
      refresh();
    }
  });

  register("projectRail.moveToGroup", async (path?: string) => {
    const target = path ?? (await pickProject(store));
    if (target) {
      await moveProjectToGroup(store, target);
      refresh();
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("projectRail")) {
        refresh();
      }
    }),
  );

  // A folder opened while the panel was hidden still needs a correct "current"
  // marker the first time it is shown.
  refresh();
}

export function deactivate(): void {}

async function pickProject(store: ProjectStore): Promise<string | undefined> {
  const projects = store.list();
  if (projects.length === 0) {
    void vscode.window.showInformationMessage(vscode.l10n.t("No projects yet. Add one first."));
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: defaultNameFor(project.path),
      description: project.path,
      path: project.path,
    })),
    { placeHolder: vscode.l10n.t("Select a project") },
  );
  return picked?.path;
}

function defaultMode(): OpenMode {
  return isOpenInNewWindow() ? "new" : "current";
}

function isOpenInNewWindow(): boolean {
  return vscode.workspace.getConfiguration("projectRail").get<boolean>("openInNewWindow", false);
}
