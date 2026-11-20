// Checks that every command declared in package.json is actually registered in
// the source, and that every command registered is declared.
//
// `command 'x' not found` is invisible until someone clicks the button: the
// contribution point renders the UI regardless of whether the code behind it
// exists. Run from the repository root.
import * as fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const declared = new Set((manifest.contributes?.commands ?? []).map((entry) => entry.command));

// Every `register("projectRail.x"` and `registerCommand("projectRail.x"` call in
// the extension source.
const source = fs.readFileSync("src/extension.ts", "utf8");
const registered = new Set();
const CALL = /register\(\s*"(projectRail\.[A-Za-z]+)"/g;
let match;
while ((match = CALL.exec(source)) !== null) {
  registered.add(match[1]);
}

// Menu contributions name a command explicitly; only those fields are checked.
// View ids also start with `projectRail.` (e.g. `projectRail.projects`) and would
// otherwise look like dangling command references.
const referenced = new Set();
for (const entries of Object.values(manifest.contributes?.menus ?? {})) {
  for (const entry of entries) {
    if (typeof entry.command === "string") referenced.add(entry.command);
  }
}

const missing = [...declared].filter((id) => !registered.has(id));
const undeclared = [...registered].filter((id) => !declared.has(id));
const dangling = [...referenced].filter((id) => !declared.has(id));

let failed = false;
const report = (title, items, hint) => {
  if (items.length === 0) return;
  failed = true;
  console.log(`\n=== ${title} ===`);
  for (const item of items) console.log("  ", item);
  if (hint) console.log("  ", hint);
};

report(
  "package.json 声明了，但源码没有 register（点击会报 command not found）",
  missing.map((id) => JSON.stringify(id)),
  "在 src/extension.ts 里补 register(...)",
);

report(
  "源码注册了，但 package.json 没声明（命令面板里不可见）",
  undeclared.map((id) => JSON.stringify(id)),
);

report(
  "menus/when 引用了不存在的命令",
  dangling.map((id) => JSON.stringify(id)),
);

console.log(
  `\n声明 ${declared.size} 个  注册 ${registered.size} 个  引用 ${referenced.size} 个`,
);
if (failed) {
  console.error("\n命令定义不一致。");
  process.exit(1);
}
console.log("命令声明与注册一致。");
