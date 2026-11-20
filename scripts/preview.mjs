// Renders the sidebar UI to PNG files so layout, theme and language changes can
// be checked without clicking through VS Code.
//
// STYLES/SCRIPT are read straight out of the provider source so the preview
// cannot drift from what ships. STRINGS is injected per language, mirroring how
// the host hands translated text to the webview.
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1248/chrome-win64/chrome.exe");

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

const LANGUAGES = {
  en: {
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
    emptyNoProjects: "No projects yet. Use Add to pin a folder.",
    emptyNoMatch: "No project matches this search.",
  },
  zh: {
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
    emptyNoProjects: "还没有项目，点「添加」认领一个文件夹。",
    emptyNoMatch: "没有匹配的项目。",
  },
};

const DARK = `
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
--vscode-charts-green:#89d185;--vscode-terminal-ansiGreen:#89d185;--vscode-editorWarning-foreground:#cca700;
--vscode-list-dropBackground:#264f78;`;

const LIGHT = `
--vscode-foreground:#3b3b3b;--vscode-font-family:-apple-system,"Segoe UI",sans-serif;--vscode-font-size:13px;
--vscode-sideBar-background:#f3f3f3;--vscode-sideBarSectionHeader-border:#e5e5e5;
--vscode-input-foreground:#3b3b3b;--vscode-input-background:#fff;--vscode-input-border:#cecece;
--vscode-input-placeholderForeground:#767676;--vscode-focusBorder:#0090f1;
--vscode-button-foreground:#fff;--vscode-button-background:#007acc;--vscode-button-hoverBackground:#0062a3;
--vscode-list-hoverBackground:#e8e8e8;--vscode-list-inactiveSelectionBackground:#e4e6f1;
--vscode-descriptionForeground:#717171;--vscode-badge-background:#c4c4c4;--vscode-badge-foreground:#333;
--vscode-icon-foreground:#424242;--vscode-toolbar-hoverBackground:#c8c8c8;
--vscode-menu-background:#fff;--vscode-menu-border:#c8c8c8;--vscode-widget-shadow:rgba(0,0,0,.16);
--vscode-menu-foreground:#3b3b3b;--vscode-menu-selectionBackground:#0060c0;--vscode-menu-separatorBackground:#d4d4d4;
--vscode-errorForeground:#a1260d;--vscode-panel-border:#e5e5e5;--vscode-disabledForeground:#a0a0a0;
--vscode-charts-green:#388a34;--vscode-terminal-ansiGreen:#388a34;--vscode-editorWarning-foreground:#bf8803;
--vscode-list-dropBackground:#cde4f7;`;

const STATE = {
  groups: [
    {
      name: "Work",
      isDefault: false,
      projects: [
        { path: "D:\\Projects\\web-storefront", name: "web-storefront", initials: "ZC", color: "#8b5cf6", exists: true, current: true },
        { path: "D:\\Projects\\admin-dashboard", name: "admin-dashboard", initials: "ZF", color: "#a855f7", exists: true, current: false },
        { path: "D:\\Projects\\data-service", name: "data-service", initials: "RD", color: "#f59e0b", exists: true, current: false },
        { path: "D:\\Archive\\old-landing", name: "old-landing", initials: "ZC", color: "#ec4899", exists: false, current: false },
      ],
    },
    {
      name: "Personal",
      isDefault: false,
      projects: [
        { path: "D:\\Sandbox\\notes-app", name: "notes-app", initials: "DO", color: "#3b82f6", exists: true, current: false },
        { path: "D:\\Sandbox\\photo-gallery", name: "photo-gallery", initials: "EN", color: "#0ea5e9", exists: true, current: false },
        { path: "D:\\Sandbox\\old-app", name: "old-app", initials: "RE", color: "#ef4444", exists: true, current: false },
      ],
    },
    {
      name: "空分组示例",
      isDefault: false,
      projects: [],
    },
    {
      name: "",
      isDefault: true,
      projects: [
        { path: "D:\\Labs\\prototype-ui", name: "prototype-ui", initials: "ZC", color: "#10b981", exists: true, current: false },
      ],
    },
  ],
  total: 8,
  openInNewWindow: false,
};

function page(theme, strings, extra = "") {
  const stringsJson = JSON.stringify(strings).replace(/</g, "\\u003c");
  const stateJson = JSON.stringify(STATE);
  return `<!doctype html><html><head><meta charset="utf-8">
<style>:root{${theme}} body{width:330px}</style>
<style>${STYLES}</style></head><body>
<div class="top">
  <input id="search" type="search" autocomplete="off" spellcheck="false">
  <button id="add-menu" class="primary"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg><span></span></button>
</div>
<div id="list" role="list"></div>
<p id="empty" class="empty" hidden></p>
<div id="menu" class="menu" role="menu" hidden></div>
<script>const STRINGS = ${stringsJson};
const __sent=[];function acquireVsCodeApi(){return{postMessage:(m)=>__sent.push(m)}};${SCRIPT}</script>
<script>window.postMessage({type:"state",state:${stateJson}},"*");</script>
<script>${extra}</script></body></html>`;
}

function shot(name, html, size) {
  const file = `${ROOT}/.p-${name}.html`;
  writeFileSync(file, html);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${size}`,
      "--force-device-scale-factor=2",
      `--screenshot=${ROOT}/.p-${name}.png`,
      `file:///${file}`,
    ],
    { stdio: "ignore" },
  );
  console.log("shot", name);
}

shot("dark", page(DARK, LANGUAGES.en), "330,620");
shot("light", page(LIGHT, LANGUAGES.en), "330,620");
shot("zh", page(DARK, LANGUAGES.zh), "330,620");
shot("light-zh", page(LIGHT, LANGUAGES.zh), "330,620");
shot(
  "addmenu-zh",
  page(DARK, LANGUAGES.zh, 'setTimeout(()=>{document.getElementById("add-menu").click();},60);'),
  "330,620",
);
shot(
  "cardmenu-zh",
  page(
    DARK,
    LANGUAGES.zh,
    'setTimeout(()=>{const c=document.querySelectorAll(".card")[1];const r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:r.left+120,clientY:r.bottom}));},60);',
  ),
  "330,620",
);
