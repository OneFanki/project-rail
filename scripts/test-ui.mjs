// Drives the rendered sidebar in headless Chromium to verify the interactions
// that cannot be checked from a screenshot: menu dismissal, drag and drop, and
// the empty-group drop target.
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1248/chrome-win64/chrome.exe");

const provider = readFileSync(`${ROOT}/src/view/provider.ts`, "utf8");

function template(name) {
  const marker = `const ${name} = \``;
  const start = provider.indexOf(marker);
  if (start < 0) throw new Error(`missing ${name}`);
  const from = start + marker.length;
  let i = from;
  while (i < provider.length) {
    if (provider[i] === "\\") {
      i += 2;
      continue;
    }
    if (provider[i] === "`") break;
    i++;
  }
  return provider.slice(from, i);
}

const STYLES = template("STYLES");
const SCRIPT = template("SCRIPT");

const STRINGS = {
  searchPlaceholder: "Search projects",
  add: "Add",
  addFolder: "Add an existing folder...",
  addCurrent: "Save this folder as a project",
  pickAndOpenCurrent: "Open a folder as a project...",
  pickAndOpenNew: "Open a folder in a new window...",
  newGroup: "New group...",
  openCurrent: "Open in current window",
  openNew: "Open in new window",
  moveToGroup: "Move to group...",
  reveal: "Reveal in file explorer",
  remove: "Remove from list",
  renameGroup: "Rename group...",
  deleteGroup: "Delete group",
  moreActions: "More actions",
  moreActionsFor: "More actions for \u0000",
  projectsLabel: "Projects",
  dragHint: "Drag a project here to add it to this group",
  tagOpen: "OPEN",
  tagMissing: "MISSING",
  groupUngrouped: "Ungrouped",
  groupEmpty: "Empty",
  emptyNoProjects: "No projects yet.",
  emptyNoMatch: "No match.",
};

const STATE = {
  groups: [
    {
      name: "Work",
      isDefault: false,
      projects: [
        { path: "C:\\a\\one", name: "one", initials: "ON", color: "#8b5cf6", exists: true, current: false },
        { path: "C:\\a\\two", name: "two", initials: "TW", color: "#a855f7", exists: true, current: false },
      ],
    },
    {
      name: "EmptyGroup",
      isDefault: false,
      projects: [],
    },
    {
      name: "",
      isDefault: true,
      projects: [
        { path: "C:\\a\\three", name: "three", initials: "TH", color: "#0ea5e9", exists: true, current: false },
      ],
    },
  ],
  total: 3,
  openInNewWindow: false,
};

const theme = `
--vscode-foreground:#cccccc;--vscode-font-family:-apple-system,"Segoe UI",sans-serif;--vscode-font-size:13px;
--vscode-sideBar-background:#252526;--vscode-sideBarSectionHeader-border:#3c3c3c;
--vscode-input-foreground:#cccccc;--vscode-input-background:#3c3c3c;--vscode-input-border:#3c3c3c;
--vscode-input-placeholderForeground:#8b8b8b;--vscode-focusBorder:#007fd4;
--vscode-button-foreground:#fff;--vscode-button-background:#0e639c;--vscode-button-hoverBackground:#1177bb;
--vscode-list-hoverBackground:#2a2d2e;--vscode-list-inactiveSelectionBackground:#37373d;
--vscode-descriptionForeground:#8b8b8b;--vscode-badge-background:#4d4d4d;--vscode-badge-foreground:#fff;
--vscode-icon-foreground:#cccccc;--vscode-toolbar-hoverBackground:#5a5d5e;
--vscode-menu-background:#252526;--vscode-menu-border:#454545;--vscode-widget-shadow:rgba(0,0,0,.36);
--vscode-menu-foreground:#cccccc;--vscode-menu-selectionBackground:#094771;--vscode-menu-separatorBackground:#454545;
--vscode-errorForeground:#f48771;--vscode-panel-border:#3c3c3c;--vscode-disabledForeground:#6b6b6b;
--vscode-charts-green:#89d185;--vscode-editorWarning-foreground:#cca700;--vscode-list-dropBackground:#264f78;`;

// The harness records every postMessage the webview sends so drag/drop can be
// asserted on the protocol, not just on CSS classes.
const HARNESS = `
window.__messages = [];
const __origPost = window.__postMessage;
`;

function page(extra) {
  const stringsJson = JSON.stringify(STRINGS);
  const stateJson = JSON.stringify(STATE);
  return `<!doctype html><html><head><meta charset="utf-8">
<style>:root{${theme}} body{width:360px}</style><style>${STYLES}</style></head><body>
<div class="top">
  <input id="search" type="search" autocomplete="off">
  <button id="add-menu" class="primary"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg><span></span></button>
</div>
<div id="list" role="list"></div>
<p id="empty" class="empty" hidden></p>
<div id="menu" class="menu" role="menu" hidden></div>
<script>const STRINGS = ${stringsJson};window.__messages=[];
function acquireVsCodeApi(){return{postMessage:(m)=>window.__messages.push(m)}};${SCRIPT}</script>
<script>window.postMessage({type:"state",state:${stateJson}},"*");</script>
<script>${extra}</script></body></html>`;
}

function run(name, extra, size = "360,600") {
  const file = `${ROOT}/.t-${name}.html`;
  writeFileSync(file, page(extra));
  const out = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=1500",
      `--window-size=${size}`,
      "--dump-dom",
      `file:///${file}`,
    ],
    { encoding: "utf8" },
  );
  return out;
}

/** Runs a scenario and returns the JSON its script wrote into <title>. */
function scenario(name, body) {
  const extra = `
setTimeout(() => {
  const results = {};
  try { ${body} } catch (e) { results.error = String(e && e.stack || e); }
  const t = document.createElement("title");
  t.textContent = JSON.stringify(results);
  document.head.appendChild(t);
}, 120);`;
  const dom = run(name, extra);
  const match = dom.match(/<title>([^<]*)<\/title>/);
  if (!match) return { error: "no title emitted" };
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

const results = {};

// 1. Add menu closes when clicking empty sidebar space.
results.closeOnOutsideClick = scenario(
  "outside",
  `
  document.getElementById("add-menu").click();
  results.opened = !document.getElementById("menu").hidden;
  document.body.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  results.closed = document.getElementById("menu").hidden;
`,
);

// 2. Clicking the add button a second time closes the menu.
results.toggleAddButton = scenario(
  "toggle",
  `
  const btn = document.getElementById("add-menu");
  btn.click();
  results.afterFirst = !document.getElementById("menu").hidden;
  btn.click();
  results.afterSecond = document.getElementById("menu").hidden;
`,
);

// 3. Clicking a card closes the menu opened from the add button.
results.closeOnCardClick = scenario(
  "cardclick",
  `
  document.getElementById("add-menu").click();
  const card = document.querySelector(".card");
  card.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  results.closed = document.getElementById("menu").hidden;
  results.sent = window.__messages.filter(m => m.type === "open").length;
`,
);

// 4. Every group renders a header, including the ungrouped bucket.
results.groupHeaders = scenario(
  "headers",
  `
  results.headers = [...document.querySelectorAll(".group-head .name")].map(e => e.textContent);
  results.emptyGroupShown = [...document.querySelectorAll(".group-head .name")]
    .some(e => e.textContent === "EmptyGroup");
  results.emptyHintShown = document.querySelectorAll(".group-empty").length;
`,
);

// 5. Dropping a card on the empty group's section sends setGroup with that name.
results.dropOnEmptyGroup = scenario(
  "drop",
  `
  const sections = [...document.querySelectorAll(".group")];
  const emptySection = sections.find(s => s.dataset.group === "EmptyGroup");
  const dt = new DataTransfer();
  dt.setData("text/plain", "C:\\\\a\\\\one");
  emptySection.dispatchEvent(new DragEvent("drop", {bubbles:true, cancelable:true, dataTransfer: dt}));
  results.sent = window.__messages.filter(m => m.type === "setGroup");
`,
);

// 6. A collapsed group still accepts a drop (the body is display:none).
results.dropOnCollapsedGroup = scenario(
  "collapsed",
  `
  const sections = [...document.querySelectorAll(".group")];
  const emptySection = sections.find(s => s.dataset.group === "EmptyGroup");
  // Collapse first.
  emptySection.querySelector(".group-head").click();
  // render() rebuilds the list, so re-query instead of reusing the old node.
  const after = [...document.querySelectorAll(".group")].find(s => s.dataset.group === "EmptyGroup");
  results.collapsed = after.classList.contains("collapsed");
  const dt = new DataTransfer();
  dt.setData("text/plain", "C:\\\\a\\\\two");
  after.dispatchEvent(new DragEvent("drop", {bubbles:true, cancelable:true, dataTransfer: dt}));
  results.sent = window.__messages.filter(m => m.type === "setGroup").length;
`,
);

console.log(JSON.stringify(results, null, 2));
