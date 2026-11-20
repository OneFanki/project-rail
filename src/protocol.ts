/**
 * Message contract between the extension host and the webview.
 *
 * Both sides import these types, so a renamed field is a compile error rather
 * than a message that silently arrives undefined.
 */

export interface ProjectViewItem {
  path: string;
  /** Always the folder's own name; there is no stored label to drift from it. */
  name: string;
  /** One or two characters for the badge. */
  initials: string;
  /** CSS colour for the badge background. */
  color: string;
  /** False when the folder is gone; the card is dimmed and offers removal. */
  exists: boolean;
  /** True for the folder open in the current window. */
  current: boolean;
}

export interface ProjectGroupView {
  /**
   * Group name. The ungrouped bucket uses `""` and carries `isDefault: true`.
   * It is rendered like any other group so its projects cannot be mistaken for
   * members of the group above it.
   */
  name: string;
  projects: ProjectViewItem[];
  /** True for the implicit ungrouped bucket, which cannot be renamed or deleted. */
  isDefault: boolean;
}

export interface ProjectViewState {
  groups: ProjectGroupView[];
  /** Total project count, so the webview can tell "empty" from "no matches". */
  total: number;
  /** Mirrors the setting, so the webview can label the default action. */
  openInNewWindow: boolean;
}

export type OpenMode = "current" | "new";

export type WebviewToHost =
  | { type: "ready" }
  | { type: "add" }
  | { type: "addCurrent" }
  | { type: "open"; path: string; mode: OpenMode }
  | { type: "pickAndOpen"; mode: OpenMode }
  | { type: "remove"; path: string }
  | { type: "reveal"; path: string }
  | { type: "newGroup" }
  | { type: "renameGroup"; group: string }
  | { type: "deleteGroup"; group: string }
  /**
   * Moves a project into `group` directly. Dragging a card onto a group must not
   * ask which group is meant: the pointer already said it.
   */
  | { type: "moveToGroup"; path: string }
  | { type: "setGroup"; path: string; group: string }
  | { type: "toggleGroup"; group: string };

export type HostToWebview =
  | { type: "state"; state: ProjectViewState }
  | { type: "busy"; busy: boolean };
