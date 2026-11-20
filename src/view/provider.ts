import * as vscode from "vscode";
import type { HostToWebview, OpenMode, WebviewToHost } from "../protocol";
import { buildState } from "./state";

/**
 * The sidebar as a webview.
 *
 * A webview is the only way to render the multi-line cards this extension is
 * about: the native tree view has a fixed single-line row and no way to put a
 * badge beside two lines of text. Everything risky about webviews (message
 * validation, CSP, string localisation) is handled in this one file so the rest
 * of the codebase stays plain.
 */
export class ProjectsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "projectRail.projects";

  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly deps: ProjectsViewDeps,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = this.render(view.webview);

    view.webview.onDidReceiveMessage((message: WebviewToHost) => {
      void this.handle(message);
    });

    // The view is torn down when the sidebar is hidden for long enough, so state
    // is pushed again on show rather than assumed to still be there.
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        void this.pushState();
      }
    });
  }

  /** Re-reads the store and sends the result to the webview. */
  async pushState(): Promise<void> {
    if (!this.view) {
      return;
    }

    const folders = vscode.workspace.workspaceFolders;
    const current = folders?.length === 1 ? folders[0].uri.fsPath : undefined;
    const state = await buildState(
      this.deps.store.list(),
      this.deps.store.groups(),
      current,
      this.deps.isOpenInNewWindow(),
    );

    const message: HostToWebview = { type: "state", state };
    void this.view.webview.postMessage(message);
  }

  private async handle(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.pushState();
        return;
      case "add":
        await this.deps.addFromFolder();
        break;
      case "addCurrent":
        await this.deps.addCurrentWorkspace();
        break;
      case "open":
        await this.deps.openProject(message.path, message.mode);
        break;
      case "pickAndOpen":
        await this.deps.pickThenOpen(message.mode);
        break;
      case "remove":
        await this.deps.removeProject(message.path);
        break;
      case "reveal":
        this.deps.revealProject(message.path);
        return;
      case "newGroup":
        await this.deps.createGroup();
        break;
      case "renameGroup":
        await this.deps.renameGroup(message.group);
        break;
      case "deleteGroup":
        await this.deps.deleteGroup(message.group);
        break;
      case "moveToGroup":
        await this.deps.moveProjectToGroup(message.path);
        break;
      case "setGroup":
        // Drag and drop: the destination is already known, so no prompt.
        await this.deps.setProjectGroup(message.path, message.group);
        break;
      case "toggleGroup":
        // Purely presentational: the collapse state lives in the webview, so the
        // host has nothing to do and nothing to persist.
        return;
      default: {
        // A message with an unexpected shape means the host and the bundled
        // webview are out of sync; ignore it rather than acting on a guess.
        const unknown: never = message;
        void unknown;
      }
    }

    await this.pushState();
  }

  private render(webview: vscode.Webview): string {
    const nonce = createNonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join("; ");

    // The webview runs in a browser context and cannot call `vscode.l10n.t`, so
    // every string it shows is resolved here and handed over as data.
    const strings: UiStrings = {
      searchPlaceholder: vscode.l10n.t("Search projects"),
      add: vscode.l10n.t("Add"),
      addFolder: vscode.l10n.t("Add an existing folder..."),
      addCurrent: vscode.l10n.t("Save this folder as a project"),
      pickAndOpenCurrent: vscode.l10n.t("Open a folder as a project..."),
      pickAndOpenNew: vscode.l10n.t("Open a folder in a new window..."),
      newGroup: vscode.l10n.t("New group..."),
      openCurrent: vscode.l10n.t("Open in current window"),
      openNew: vscode.l10n.t("Open in new window"),
      moveToGroup: vscode.l10n.t("Move to group..."),
      reveal: vscode.l10n.t("Reveal in file explorer"),
      remove: vscode.l10n.t("Remove from list"),
      renameGroup: vscode.l10n.t("Rename group..."),
      deleteGroup: vscode.l10n.t("Delete group"),
      moreActions: vscode.l10n.t("More actions"),
      moreActionsFor: vscode.l10n.t("More actions for {0}", "\u0000"),
      projectsLabel: vscode.l10n.t("Projects"),
      dragHint: vscode.l10n.t("Drag a project here to add it to this group"),
      tagOpen: vscode.l10n.t("OPEN"),
      tagMissing: vscode.l10n.t("MISSING"),
      groupUngrouped: vscode.l10n.t("Ungrouped"),
      groupEmpty: vscode.l10n.t("Empty"),
      emptyNoProjects: vscode.l10n.t("No projects yet. Use Add to pin a folder."),
      emptyNoMatch: vscode.l10n.t("No project matches this search."),
    };

    return `<!doctype html>
<html lang="${vscode.env.language}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style nonce="${nonce}">${STYLES}</style>
</head>
<body>
  <div class="top">
    <input id="search" type="search" aria-label="${escapeAttr(strings.searchPlaceholder)}" autocomplete="off" spellcheck="false">
    <button id="add-menu" class="primary" aria-haspopup="true" aria-expanded="false">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>
      <span></span>
    </button>
  </div>
  <div id="list" role="list" aria-label="${escapeAttr(strings.projectsLabel)}"></div>
  <p id="empty" class="empty" hidden></p>
  <div id="menu" class="menu" role="menu" hidden></div>
<script nonce="${nonce}">const STRINGS = ${safeJson(strings)};${SCRIPT}</script>
</body>
</html>`;
  }
}

interface UiStrings {
  searchPlaceholder: string;
  add: string;
  addFolder: string;
  addCurrent: string;
  pickAndOpenCurrent: string;
  pickAndOpenNew: string;
  newGroup: string;
  openCurrent: string;
  openNew: string;
  moveToGroup: string;
  reveal: string;
  remove: string;
  renameGroup: string;
  deleteGroup: string;
  moreActions: string;
  moreActionsFor: string;
  projectsLabel: string;
  dragHint: string;
  tagOpen: string;
  tagMissing: string;
  groupUngrouped: string;
  groupEmpty: string;
  emptyNoProjects: string;
  emptyNoMatch: string;
}

export interface ProjectsViewDeps {
  store: { list(): { path: string; group: string }[]; groups(): string[] };
  isOpenInNewWindow(): boolean;
  addFromFolder(): Promise<void>;
  addCurrentWorkspace(): Promise<void>;
  pickThenOpen(mode: OpenMode): Promise<void>;
  openProject(path: string, mode: OpenMode): Promise<void>;
  removeProject(path: string): Promise<void>;
  revealProject(path: string): void;
  createGroup(): Promise<void>;
  renameGroup(group: string): Promise<void>;
  deleteGroup(group: string): Promise<void>;
  moveProjectToGroup(path: string): Promise<void>;
  setProjectGroup(path: string, group: string): Promise<void>;
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * Embeds a JSON payload in a <script> tag.
 *
 * `<` is escaped so a translated string containing `</script>` cannot close the
 * tag early. Everything else is safe inside a JSON string literal.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const STYLES = `
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  overflow-x: hidden;
}

button { font-family: inherit; font-size: inherit; }

.top {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  gap: 6px;
  padding: 8px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
}

#search {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
  outline: none;
}

#search:focus { border-color: var(--vscode-focusBorder); }
#search::placeholder { color: var(--vscode-input-placeholderForeground); }

.primary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.primary:hover { background: var(--vscode-button-hoverBackground); }
.primary svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; }

#list { padding: 6px; }

.group { margin-bottom: 2px; }

.group-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.group-head:hover { background: var(--vscode-list-hoverBackground); }
.group-head .chevron { flex: 0 0 auto; transition: transform 0.12s ease; }
.group-head.collapsed .chevron { transform: rotate(-90deg); }
.group-head .count { margin-left: auto; font-weight: 500; opacity: 0.8; }
.group-head .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* The implicit bucket is labelled but not interactive: it cannot be renamed or
   deleted, so it gets no hover affordance beyond the collapse behaviour. */
.group-head.default .name { font-style: italic; }

.group.drag-over .group-head,
.group-head.drag-over {
  background: var(--vscode-list-dropBackground, var(--vscode-list-hoverBackground));
  box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
}

.group-body { padding-left: 2px; }
.group.collapsed .group-body { display: none; }

/* An empty group still needs a visible body: it is the drop target that makes a
   freshly created group usable. */
.group-empty {
  padding: 4px 7px 6px 14px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-style: italic;
  opacity: 0.75;
}

.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 7px;
  margin-bottom: 1px;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  outline: none;
}

.card:hover { background: var(--vscode-list-hoverBackground); }
.card:focus-visible { box-shadow: inset 0 0 0 1px var(--vscode-focusBorder); }
.card.current { background: var(--vscode-list-inactiveSelectionBackground); }
.card.missing { opacity: 0.6; }
.card.dragging { opacity: 0.4; }

.badge {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  line-height: 1;
}

.card.missing .badge { background: var(--vscode-disabledForeground) !important; }

.text { flex: 1 1 auto; min-width: 0; }

.name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tags carry no background of their own. A filled tag has to pick a foreground
   that works on the fill, and the theme only guarantees one pair of colours, so
   the safe shape is coloured text plus a matching hairline border. */
.tag {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid currentColor;
  font-size: 9px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.tag.open { color: var(--vscode-charts-green, var(--vscode-terminal-ansiGreen, #73c991)); }
.tag.warn { color: var(--vscode-editorWarning-foreground, #cca700); }

.path {
  margin-top: 2px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--vscode-icon-foreground);
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
  line-height: 1;
}

.card:hover .more { opacity: 1; }
.card:focus-within .more { opacity: 1; }
.more:hover { background: var(--vscode-toolbar-hoverBackground); }

.menu {
  position: fixed;
  z-index: 30;
  min-width: 200px;
  max-width: calc(100vw - 8px);
  padding: 4px;
  background: var(--vscode-menu-background, var(--vscode-sideBar-background));
  border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
  border-radius: 5px;
  box-shadow: 0 4px 12px var(--vscode-widget-shadow);
}

.menu button {
  display: block;
  width: 100%;
  padding: 5px 9px;
  color: var(--vscode-menu-foreground, var(--vscode-foreground));
  background: transparent;
  border: none;
  border-radius: 3px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu button:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-menu-selectionForeground, inherit); }
.menu button.danger { color: var(--vscode-errorForeground, #f48771); }
.menu hr { height: 0; margin: 4px 2px; border: 0; border-top: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-panel-border)); }
.menu .label { padding: 5px 9px 3px; color: var(--vscode-descriptionForeground); font-size: 10px; letter-spacing: 0.5px; }

.empty {
  margin: 24px 16px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  line-height: 1.6;
}
`;

// Runs inside the webview. Kept free of interpolation so a project name
// containing `</script>` or a template marker cannot break out of the tag.
const SCRIPT = `
const vscode = acquireVsCodeApi();

const list = document.getElementById("list");
const search = document.getElementById("search");
const empty = document.getElementById("empty");
const menu = document.getElementById("menu");
const addButton = document.getElementById("add-menu");
addButton.querySelector("span").textContent = STRINGS.add;
search.placeholder = STRINGS.searchPlaceholder;

let state = { groups: [], total: 0, openInNewWindow: false };
const collapsed = new Set();

// Whether the open menu was opened by the add button. Clicking that button again
// has to close the menu rather than reposition it.
let menuOwner = null;

addButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!menu.hidden && menuOwner === "add") {
    closeMenu();
    return;
  }
  const rect = addButton.getBoundingClientRect();
  showAddMenu(rect.right, rect.bottom + 2);
  menuOwner = "add";
});

search.addEventListener("input", render);

// Any click outside the menu closes it, including a click on empty sidebar space,
// on another card, or on the add button (handled above). Listening on the document
// in the capture phase means a handler that stops propagation elsewhere cannot
// keep a stale menu open.
document.addEventListener(
  "click",
  (event) => {
    if (menu.hidden) return;
    if (menu.contains(event.target)) return;
    if (addButton.contains(event.target)) return;
    closeMenu();
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!menu.hidden) {
      closeMenu();
      return;
    }
  }

  const cards = [...list.querySelectorAll(".card")];
  if (cards.length === 0) return;
  const index = cards.indexOf(document.activeElement);

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, cards.length - 1)
        : Math.max(index - 1, 0);
    cards[next]?.focus();
  } else if (event.key === "Enter" && index >= 0) {
    event.preventDefault();
    open(cards[index].dataset.path, "default");
  }
});

// A viewport resize (sidebar dragged wider, window resized) can leave a fixed
// menu mispositioned; closing is cheaper than recomputing the anchor.
window.addEventListener("resize", closeMenu);

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "state") {
    state = message.state;
    render();
  }
});

function open(path, mode) {
  if (mode === "default") {
    mode = state.openInNewWindow ? "new" : "current";
  }
  vscode.postMessage({ type: "open", path, mode });
}

function render() {
  const query = search.value.trim().toLowerCase();
  const matches = (project) =>
    query === "" ||
    project.name.toLowerCase().includes(query) ||
    project.path.toLowerCase().includes(query);

  list.textContent = "";

  let shown = 0;
  for (const group of state.groups) {
    const projects = group.projects.filter(matches);
    // A search hides groups with no matches, but an empty group is still shown
    // when not searching: it is a drop target.
    if (query !== "" && projects.length === 0) continue;
    shown += projects.length;

    const section = document.createElement("div");
    section.className = "group";
    const isCollapsed = collapsed.has(group.name) && query === "";
    if (isCollapsed) section.classList.add("collapsed");

    // Every group gets a header, including the ungrouped bucket: without one its
    // cards run straight on from the group above and read as members of it.
    section.appendChild(buildGroupHead(group, projects.length, isCollapsed));
    section.dataset.group = group.name;

    const body = document.createElement("div");
    body.className = "group-body";
    for (const project of projects) {
      body.appendChild(buildCard(project));
    }
    if (projects.length === 0 && query === "") {
      const hint = document.createElement("div");
      hint.className = "group-empty";
      hint.textContent = STRINGS.groupEmpty;
      body.appendChild(hint);
    }
    section.appendChild(body);
    list.appendChild(section);

    attachDropTarget(section, group.name);
  }

  if (shown === 0 && state.total > 0) {
    empty.hidden = false;
    empty.textContent = STRINGS.emptyNoMatch;
    return;
  }
  if (state.total === 0) {
    empty.hidden = false;
    empty.textContent = STRINGS.emptyNoProjects;
    return;
  }
  empty.hidden = true;
}

// The whole section is a drop target, not just the body: an empty group has an
// almost zero-height body, and a collapsed group has none at all.
function attachDropTarget(section, groupName) {
  let depth = 0;

  const setActive = (active) => {
    section.classList.toggle("drag-over", active);
  };

  section.addEventListener("dragenter", (event) => {
    event.preventDefault();
    depth += 1;
    setActive(true);
  });

  section.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  section.addEventListener("dragleave", () => {
    depth -= 1;
    if (depth <= 0) {
      depth = 0;
      setActive(false);
    }
  });

  section.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    depth = 0;
    setActive(false);
    const path = event.dataTransfer.getData("text/plain");
    if (path) {
      // The drop target names the destination, so the host does not prompt.
      vscode.postMessage({ type: "setGroup", path, group: groupName });
    }
  });
}

function buildGroupHead(group, count, isCollapsed) {
  const head = document.createElement("div");
  head.className = "group-head";
  if (isCollapsed) head.classList.add("collapsed");
  if (group.isDefault) head.classList.add("default");

  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("class", "chevron");
  chevron.setAttribute("viewBox", "0 0 16 16");
  chevron.setAttribute("width", "11");
  chevron.setAttribute("height", "11");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "M4 6l4 4 4-4");
  arrow.setAttribute("stroke", "currentColor");
  arrow.setAttribute("stroke-width", "1.6");
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke-linecap", "round");
  chevron.appendChild(arrow);

  const label = document.createElement("span");
  label.className = "name";
  label.textContent = group.isDefault ? STRINGS.groupUngrouped : group.name;

  const counter = document.createElement("span");
  counter.className = "count";
  counter.textContent = String(count);

  head.append(chevron, label, counter);

  head.addEventListener("click", () => {
    if (collapsed.has(group.name)) collapsed.delete(group.name);
    else collapsed.add(group.name);
    render();
  });

  head.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    // The ungrouped bucket is implicit; there is nothing to rename or delete.
    if (group.isDefault) return;
    showGroupMenu(group.name, event.clientX, event.clientY);
  });

  return head;
}

function buildCard(project) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.path = project.path;
  card.tabIndex = 0;
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", project.current ? "true" : "false");
  card.draggable = true;
  if (project.current) card.classList.add("current");
  if (!project.exists) card.classList.add("missing");
  card.title = project.path;

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.style.background = project.color;
  badge.textContent = project.initials;

  const text = document.createElement("div");
  text.className = "text";

  const name = document.createElement("div");
  name.className = "name";
  name.appendChild(document.createTextNode(project.name));
  if (project.current) name.appendChild(tag(STRINGS.tagOpen, "open"));
  if (!project.exists) name.appendChild(tag(STRINGS.tagMissing, "warn"));

  const path = document.createElement("div");
  path.className = "path";
  path.textContent = project.path;

  text.append(name, path);

  const more = document.createElement("button");
  more.className = "more";
  more.type = "button";
  more.textContent = "\\u22ef";
  more.title = STRINGS.moreActions;
  more.setAttribute("aria-label", STRINGS.moreActionsFor.replace("\\u0000", project.name));
  more.addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = more.getBoundingClientRect();
    showProjectMenu(project, rect.right, rect.bottom + 2);
    menuOwner = "card";
  });

  card.addEventListener("click", () => open(project.path, "default"));

  // Middle click opens a new window, matching the editor tab convention.
  card.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      open(project.path, "new");
    }
  });

  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showProjectMenu(project, event.clientX, event.clientY);
    menuOwner = "card";
  });

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", project.path);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
    closeMenu();
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));

  card.append(badge, text, more);
  return card;
}

function tag(label, extra) {
  const element = document.createElement("span");
  element.className = "tag " + extra;
  element.textContent = label;
  return element;
}

function menuItem(host, label, action, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", () => {
    closeMenu();
    action();
  });
  host.appendChild(button);
}

function separator(host) {
  host.appendChild(document.createElement("hr"));
}

function caption(host, text) {
  const element = document.createElement("div");
  element.className = "label";
  element.textContent = text;
  host.appendChild(element);
}

function showProjectMenu(project, x, y) {
  menu.textContent = "";

  if (!project.exists) {
    menuItem(menu, STRINGS.remove, () =>
      vscode.postMessage({ type: "remove", path: project.path }), "danger");
    revealMenu(x, y);
    return;
  }

  menuItem(menu, STRINGS.openCurrent, () => open(project.path, "current"));
  menuItem(menu, STRINGS.openNew, () => open(project.path, "new"));
  separator(menu);
  menuItem(menu, STRINGS.moveToGroup, () =>
    vscode.postMessage({ type: "moveToGroup", path: project.path }));
  menuItem(menu, STRINGS.reveal, () =>
    vscode.postMessage({ type: "reveal", path: project.path }));
  separator(menu);
  menuItem(menu, STRINGS.remove, () =>
    vscode.postMessage({ type: "remove", path: project.path }), "danger");

  revealMenu(x, y);
}

function showGroupMenu(group, x, y) {
  menu.textContent = "";
  caption(menu, group);
  menuItem(menu, STRINGS.renameGroup, () =>
    vscode.postMessage({ type: "renameGroup", group }));
  menuItem(menu, STRINGS.deleteGroup, () =>
    vscode.postMessage({ type: "deleteGroup", group }), "danger");
  revealMenu(x, y);
}

function showAddMenu(x, y) {
  menu.textContent = "";
  menuItem(menu, STRINGS.addFolder, () => vscode.postMessage({ type: "add" }));
  menuItem(menu, STRINGS.addCurrent, () => vscode.postMessage({ type: "addCurrent" }));
  separator(menu);
  menuItem(menu, STRINGS.pickAndOpenCurrent, () =>
    vscode.postMessage({ type: "pickAndOpen", mode: "current" }));
  menuItem(menu, STRINGS.pickAndOpenNew, () =>
    vscode.postMessage({ type: "pickAndOpen", mode: "new" }));
  separator(menu);
  menuItem(menu, STRINGS.newGroup, () => vscode.postMessage({ type: "newGroup" }));
  revealMenu(x, y);
}

function revealMenu(x, y) {
  menu.hidden = false;

  // x/y is the anchor point. A menu opened from a right-edge control (the add
  // button, the \\u22ef button on a wide card) grows leftwards from it; one opened
  // by a right-click at the cursor grows rightwards. Either way the result is
  // clamped into the viewport so it is never cut off.
  const box = menu.getBoundingClientRect();
  const left = x + box.width > window.innerWidth - 4 ? x - box.width : x;
  const top = Math.min(y, window.innerHeight - box.height - 4);

  menu.style.left = Math.max(4, Math.min(left, window.innerWidth - box.width - 4)) + "px";
  menu.style.top = Math.max(4, top) + "px";

  menu.querySelector("button")?.focus();
}

function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  menuOwner = null;
}

render();
vscode.postMessage({ type: "ready" });
`;
