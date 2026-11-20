// Renders the README the way the Marketplace renders it, with the metadata
// package.json supplies, so the listing can be reviewed before publishing.
//
// Dev aid only; not part of the published package.
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1248/chrome-win64/chrome.exe");

const manifest = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));
const nls = JSON.parse(readFileSync(`${ROOT}/package.nls.json`, "utf8"));

// vsce substitutes %key% from package.nls*.json at package time.
const resolve = (value) => {
  const match = /^%(.+)%$/.exec(value ?? "");
  return match ? (nls[match[1]] ?? value) : value;
};

const readme = readFileSync(`${ROOT}/README.md`, "utf8");
const icon = `data:image/png;base64,${readFileSync(`${ROOT}/media/icon.png`).toString("base64")}`;

/**
 * Minimal Markdown to HTML for the constructs this README uses: headings,
 * paragraphs, bullet lists, fenced code, tables, bold/italic/code, links.
 * Not a general parser — a one-off renderer so the preview needs no dependency.
 */
function markdown(src) {
  const lines = src.split("\n");
  const out = [];
  let i = 0;

  // Images first: the link rule below also matches `![alt](src)`, and would
  // leave a stray "!" in front of an <a> tag. The real marketplace rewrites
  // relative paths to GitHub raw URLs; here the file is read from disk so the
  // preview shows the same picture the listing will.
  const inline = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
        const file = src.startsWith("http") ? null : `${ROOT}/${src}`;
        const resolved = file && existsSync(file)
          ? `data:image/png;base64,${readFileSync(file).toString("base64")}`
          : src;
        return `<img class="readme-img" src="${resolved}" alt="${alt}">`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(
        `<pre class="code${lang ? ` lang-${lang}` : ""}"><code>${body
          .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;"))
          .join("\n")}</code></pre>`,
      );
      continue;
    }

    // Table
    if (line.startsWith("|") && lines[i + 1]?.includes("---")) {
      const cells = (row) =>
        row
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const body = [];
      while (i < lines.length && lines[i].startsWith("> ")) body.push(inline(lines[i++].slice(2)));
      out.push(`<blockquote>${body.join(" ")}</blockquote>`);
      continue;
    }

    // Heading
    const heading = /^(#{1,4}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // List
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && (/^[-*] /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^[-*] /.test(lines[i])) items.push(inline(lines[i].slice(2)));
        else items[items.length - 1] += ` ${inline(lines[i].trim())}`;
        i++;
      }
      out.push(`<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`);
      continue;
    }

    // Paragraph
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4} |[-*] |\|```)/.test(lines[i])) {
      para.push(inline(lines[i].trim()));
      i++;
    }
    out.push(`<p>${para.join(" ")}</p>`);
  }

  return out.join("\n");
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
/* Marketplace's own light theme. */
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #ffffff;
  color: #333333;
  font-family: "Segoe UI", -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
.page { max-width: 900px; margin: 0 auto; padding: 24px 28px 60px; }

.header { display: flex; gap: 20px; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
.icon { width: 128px; height: 128px; border-radius: 8px; flex: 0 0 auto; border: 1px solid #eee; }
.headtext { flex: 1; min-width: 0; padding-top: 4px; }
.title { font-size: 28px; font-weight: 600; color: #222; margin: 0; }
.publisher { color: #666; font-size: 13px; margin-top: 2px; }
.desc { color: #444; font-size: 15px; margin-top: 12px; line-height: 1.55; }

.meta { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 3px; background: #f0f0f0; color: #555; }
.install { margin-top: 14px; font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 7px 10px; border-radius: 4px; color: #333; display: inline-block; }

.section-title { font-size: 17px; font-weight: 600; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e5e5; }

.readme h1 { font-size: 22px; margin: 22px 0 10px; font-weight: 600; }
.readme h2 { font-size: 18px; margin: 24px 0 10px; font-weight: 600; }
.readme h3 { font-size: 15px; margin: 20px 0 8px; font-weight: 600; }
.readme p { margin: 10px 0; color: #333; }
.readme ul { margin: 10px 0; padding-left: 22px; }
.readme li { margin: 5px 0; }
.readme code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-family: Consolas, monospace; font-size: 12.5px; color: #c7254e; }
.readme pre.code { background: #f6f8fa; padding: 12px 14px; border-radius: 4px; overflow-x: auto; margin: 12px 0; }
.readme pre.code code { background: none; padding: 0; color: #24292e; font-size: 12.5px; }
.readme table { border-collapse: collapse; margin: 12px 0; font-size: 13px; width: 100%; }
.readme th, .readme td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
.readme th { background: #f6f8fa; font-weight: 600; }
.readme a { color: #0066bf; text-decoration: none; }
.readme strong { font-weight: 600; }
.readme img.readme-img { max-width: 100%; display: block; margin: 14px 0; border: 1px solid #e5e5e5; border-radius: 6px; }
.readme blockquote { margin: 14px 0; padding: 2px 14px; border-left: 3px solid #d0d7de; color: #57606a; }

.notice { margin-top: 18px; padding: 10px 14px; background: #fff8e1; border-left: 3px solid #f0b400; font-size: 12.5px; color: #6b5300; }
.footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #777; }
</style></head><body>
<div class="page">

  <div class="header">
    <img class="icon" src="${icon}">
    <div class="headtext">
      <h1 class="title">${resolve(manifest.displayName)}</h1>
      <div class="publisher">${manifest.publisher} &nbsp;|&nbsp; ${manifest.keywords
        .slice(0, 4)
        .join(", ")}</div>
      <div class="desc">${resolve(manifest.description)}</div>
      <div class="meta">
        ${manifest.categories.map((c) => `<span class="chip">${c}</span>`).join("")}
        <span class="chip">v${manifest.version}</span>
        <span class="chip">MIT</span>
        <span class="chip">${manifest.engines.vscode}</span>
      </div>
      <div class="install">ext install ${manifest.publisher}.${manifest.name}</div>
    </div>
  </div>

  <div class="notice">
    以下内容来自包内 README.md（vsce 会把它作为详情页正文）。相对图片路径在打包时会被
    vsce 改写为 GitHub raw 地址；预览里直接读本地文件，所以看到的就是商店页的样子。
  </div>

  <div class="readme">
    ${markdown(readme)}
  </div>

  <div class="footer">
    仓库 · ${manifest.repository.url}<br>
    问题反馈 · ${manifest.bugs.url}<br>
    许可证 · ${manifest.license}
  </div>

</div>
</body></html>`;

const file = `${ROOT}/.listing.html`;
writeFileSync(file, html);
execFileSync(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=960,2400",
    "--force-device-scale-factor=1",
    `--screenshot=${ROOT}/.listing.png`,
    `file:///${file}`,
  ],
  { stdio: "ignore" },
);
console.log("rendered .listing.png");
