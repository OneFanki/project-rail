import * as path from "node:path";

/**
 * Two paths that point at the same folder should compare equal regardless of
 * separator style, trailing separator, or the case-insensitivity of the host
 * filesystem. Everything this extension does hinges on that: the "current"
 * marker, duplicate rejection, and the self-open guard.
 */
export function isSamePath(a: string, b: string): boolean {
  const normalize = (value: string): string => {
    const trimmed = value.replace(/[\\/]+$/, "");
    const resolved = path.normalize(trimmed);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(a) === normalize(b);
}

/** Folder name used as the project label, e.g. `C:\Code\web-storefront` -> `web-storefront`. */
export function defaultNameFor(folderPath: string): string {
  return path.basename(folderPath.replace(/[\\/]+$/, "")) || folderPath;
}
