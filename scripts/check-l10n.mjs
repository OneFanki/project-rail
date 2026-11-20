// Checks that every localisation key used in the source has a translation.
//
// A missing key is silent at runtime: `l10n.t()` just returns the English source
// string, so the only way to catch it is to compare the source against the
// bundles. Run from the repository root.
import * as fs from "node:fs";
import * as path from "node:path";

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", ".git"].includes(entry.name)) walk(full);
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
})("src");

// Matches `l10n.t("...")` and the local alias `t("...")`, single or double
// quoted, capturing the literal only. Template literals and variables are
// skipped on purpose: a dynamic key could never be translated anyway.
const CALL = /(?:l10n\.t|(?<![\w.])t)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

const keys = new Map();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  CALL.lastIndex = 0;
  let match;
  while ((match = CALL.exec(source)) !== null) {
    const literal = match[1].slice(1, -1);
    const key = literal
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(path.basename(file));
  }
}

const load = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const bundle = load("l10n/bundle.l10n.json");
const zh = load("l10n/bundle.l10n.zh-cn.json");
const nls = load("package.nls.json");
const nlsZh = load("package.nls.zh-cn.json");

let failed = false;
const report = (title, items) => {
  if (items.length === 0) return;
  failed = true;
  console.log(`\n=== ${title} ===`);
  for (const item of items) console.log("  ", item);
};

report(
  "源码用了，但 l10n/bundle.l10n.json 没有（运行时显示英文）",
  [...keys.keys()].filter((k) => !(k in bundle)).map((k) => `${JSON.stringify(k)}  <- ${[...keys.get(k)].join(", ")}`),
);

report(
  "bundle.l10n.json 有，但中文包缺",
  Object.keys(bundle).filter((k) => !(k in zh)).map((k) => JSON.stringify(k)),
);

report(
  "package.nls.json 有，但中文包缺",
  Object.keys(nls).filter((k) => !(k in nlsZh)).map((k) => JSON.stringify(k)),
);

// Also flag the reverse: a package.json `%key%` that has no nls entry would
// render the literal placeholder in the UI.
const manifest = load("package.json");
const placeholders = new Set();
(function scan(value) {
  if (typeof value === "string") {
    const match = value.match(/^%([^%]+)%$/);
    if (match) placeholders.add(match[1]);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) scan(child);
  }
})(manifest.contributes);
report(
  "package.json 引用了不存在的 nls key",
  [...placeholders].filter((k) => !(k in nls)).map((k) => JSON.stringify(k)),
);

const unused = Object.keys(bundle).filter((k) => !keys.has(k));
if (unused.length > 0) {
  console.log("\n=== bundle 里有但源码没用上（可删） ===");
  for (const key of unused) console.log("  ", JSON.stringify(key));
}

console.log(`\n源码 key 数: ${keys.size}  bundle: ${Object.keys(bundle).length}  中文: ${Object.keys(zh).length}`);
if (failed) {
  console.error("\n存在缺失的翻译。");
  process.exit(1);
}
console.log("全部 key 都有翻译。");
