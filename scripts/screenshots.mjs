// Renders the marketplace screenshots from the real webview markup, so the
// listing shows the actual UI rather than a mock-up that can drift from it.
//
// Output goes to docs/screenshots/, which is shipped inside the VSIX: the
// marketplace only renders README images that are HTTPS URLs or files packaged
// alongside the extension, and a relative path keeps the listing independent of
// any external image host.
//
// The sample data below is invented. Use neutral directories and made-up
// project names here — screenshots are published with the listing.
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1248/chrome-win64/chrome.exe");
const OUT = `${ROOT}/docs/screenshots`;

const provider = readFileSync(`${ROOT}/src/view/provider.ts`, "utf8");

function template(name) {
  const marker = `const ${name} = \``;
  const start = provider.indexOf(marker);
  if (start < 0) throw new Error(`missing ${name} in provider.ts`);
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
  searchPlaceholder: "搜索项目",
  add: "添加",
  addFolder: "添加已有文件夹...",
  addCurrent: "将当前文件夹保存为项目",
  pickAndOpenCurrent: "打开文件夹作为项目...",
  pickAndOpenNew: "在新建窗口打开文件夹...",
  newGroup: "新建分组...",
  openCurrent: "在当前窗口打开",
  openNew: "在新窗口打开",
  moveToGroup: "移动到分组...",
  reveal: "在文件资源管理器中显示",
  remove: "从列表移除",
  renameGroup: "重命名分组...",
  deleteGroup: "删除分组",
  moreActions: "更多操作",
  moreActionsFor: "更多操作：\u0000",
  projectsLabel: "项目",
  dragHint: "把项目拖到这里可加入该分组",
  tagOpen: "已打开",
  tagMissing: "路径丢失",
  groupUngrouped: "未分组",
  groupEmpty: "空分组",
  emptyNoProjects: "还没有项目。",
  emptyNoMatch: "没有匹配的项目。",
};

// Sample data for the screenshots. Generic drive root, neutral parent
// directories, invented project names: the point is to show the shape of the UI
// - groups, an open marker, a missing entry - not any particular setup.
const STATE = {
  groups: [
    {
      name: "工作",
      isDefault: false,
      projects: [
        { path: "D:\\Projects\\web-storefront", name: "web-storefront", initials: "WS", color: "#8b5cf6", exists: true, current: true },
        { path: "D:\\Projects\\admin-dashboard", name: "admin-dashboard", initials: "AD", color: "#a855f7", exists: true, current: false },
        { path: "D:\\Projects\\data-service", name: "data-service", initials: "DS", color: "#d97706", exists: true, current: false },
      ],
    },
    {
      name: "个人",
      isDefault: false,
      projects: [
        { path: "D:\\Sandbox\\notes-app", name: "notes-app", initials: "NA", color: "#3b82f6", exists: true, current: false },
        { path: "D:\\Sandbox\\photo-gallery", name: "photo-gallery", initials: "PG", color: "#0ea5e9", exists: true, current: false },
        { path: "D:\\Sandbox\\music-player", name: "music-player", initials: "MP", color: "#d946ef", exists: true, current: false },
      ],
    },
    {
      name: "",
      isDefault: true,
      projects: [
        { path: "D:\\Labs\\prototype-ui", name: "prototype-ui", initials: "PU", color: "#10b981", exists: true, current: false },
        { path: "D:\\Archive\\old-landing", name: "old-landing", initials: "OL", color: "#ef4444", exists: false, current: false },
      ],
    },
  ],
  total: 8,
  openInNewWindow: false,
};

const DARK = `
--vscode-foreground:#cccccc;--vscode-font-family:"Segoe UI",-apple-system,sans-serif;--vscode-font-size:13px;
--vscode-sideBar-background:#252526;--vscode-sideBarSectionHeader-border:#3c3c3c;
--vscode-input-foreground:#cccccc;--vscode-input-background:#3c3c3c;--vscode-input-border:#3c3c3c;
--vscode-input-placeholderForeground:#8b8b8b;--vscode-focusBorder:#007fd4;
--vscode-button-foreground:#ffffff;--vscode-button-background:#0e639c;--vscode-button-hoverBackground:#1177bb;
--vscode-list-hoverBackground:#2a2d2e;--vscode-list-inactiveSelectionBackground:#37373d;
--vscode-descriptionForeground:#8b8b8b;--vscode-badge-background:#4d4d4d;--vscode-badge-foreground:#ffffff;
--vscode-icon-foreground:#cccccc;--vscode-toolbar-hoverBackground:#5a5d5e;
--vscode-menu-background:#252526;--vscode-menu-border:#454545;--vscode-widget-shadow:rgba(0,0,0,.36);
--vscode-menu-foreground:#cccccc;--vscode-menu-selectionBackground:#094771;--vscode-menu-separatorBackground:#454545;
--vscode-errorForeground:#f48771;--vscode-panel-border:#3c3c3c;--vscode-disabledForeground:#6b6b6b;
--vscode-charts-green:#89d185;--vscode-editorWarning-foreground:#cca700;--vscode-list-dropBackground:#264f78;`;

function page(extra = "") {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>:root{${DARK}} body{width:340px;background:#252526}</style>
<style>${STYLES}</style></head><body>
<div class="top">
  <input id="search" type="search" autocomplete="off" spellcheck="false">
  <button id="add-menu" class="primary"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg><span></span></button>
</div>
<div id="list" role="list"></div>
<p id="empty" class="empty" hidden></p>
<div id="menu" class="menu" role="menu" hidden></div>
<script>const STRINGS = ${JSON.stringify(STRINGS).replace(/</g, "\\u003c")};
function acquireVsCodeApi(){return{postMessage:()=>{}}};${SCRIPT}</script>
<script>window.postMessage({type:"state",state:${JSON.stringify(STATE)}},"*");</script>
<script>${extra}</script></body></html>`;
}

mkdirSync(OUT, { recursive: true });

function shot(name, extra, height) {
  const file = `${ROOT}/.shot-${name}.html`;
  writeFileSync(file, page(extra));
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--default-background-color=00000000",
      "--window-size=340," + height,
      "--force-device-scale-factor=2",
      `--screenshot=${OUT}/${name}.png`,
      `file:///${file}`,
    ],
    { stdio: "ignore" },
  );
  unlinkSync(file);
  console.log("wrote docs/screenshots/" + name + ".png");
}

shot("sidebar", "", 560);
