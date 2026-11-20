// Renders media/icon.png (the marketplace icon) from media/icon.svg.
//
// Chromium fills the page with opaque white by default, which silently strips
// the alpha channel from the screenshot: the SVG can have transparent corners
// and the PNG still comes out as RGB with a solid background. Passing
// --default-background-color=00000000 is what keeps the corners transparent, so
// the PNG is RGBA and the rounded tile sits on whatever the list draws behind
// it. The script asserts that afterwards rather than trusting it.
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1248/chrome-win64/chrome.exe");
const SIZE = 128;

if (!existsSync(CHROME)) {
  console.error(`Chromium not found at ${CHROME}`);
  console.error("Install Playwright browsers (npx playwright install chromium) or edit CHROME.");
  process.exit(1);
}

const svg = readFileSync(`${ROOT}/media/icon.svg`, "utf8");
// The viewBox is 512; the page is 128. Setting the img to 128x128 scales it.
const html = `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:transparent}
img{display:block;width:${SIZE}px;height:${SIZE}px}
</style></head><body><img src="icon.svg"></body></html>`;

const page = `${ROOT}/media/.icon-render.html`;
writeFileSync(page, html);

try {
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${SIZE},${SIZE}`,
      `--screenshot=${ROOT}/media/icon.png`,
      `file:///${page}`,
    ],
    { stdio: "ignore" },
  );

  const png = readFileSync(`${ROOT}/media/icon.png`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  // IHDR colour type follows the bit depth byte: 6 is truecolour + alpha.
  const colorType = png[25];
  console.log(`media/icon.png written: ${width}x${height}, ${png.length} bytes, colour type ${colorType}`);
  if (width < SIZE || height < SIZE) {
    console.error(`Icon is smaller than the ${SIZE}x${SIZE} the marketplace requires.`);
    process.exit(1);
  }
  if (colorType !== 6) {
    console.error(
      `Icon has no alpha channel (colour type ${colorType}, expected 6). ` +
        "Chromium dropped transparency — check --default-background-color.",
    );
    process.exit(1);
  }
} finally {
  if (existsSync(page)) unlinkSync(page);
}
