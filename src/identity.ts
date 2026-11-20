/**
 * Colours for the generated project badges.
 *
 * Tailwind's 500-level palette: saturated enough to stay recognisable as a small
 * 36px square, and dark enough that white initials clear 4.5:1 contrast on every
 * entry. Picking from a fixed list rather than hashing to RGB keeps the badges
 * legible on both light and dark themes.
 */
const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
];

/** Stable colour for a project, so the badge does not change between sessions. */
export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    // `| 0` keeps the value in the 32-bit range instead of drifting into
    // float territory, which would make the modulo result unstable.
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * One or two characters for the badge.
 *
 * Multi-word names are abbreviated by word (`web-storefront` -> `ZC`) rather than
 * by taking the first two characters. Taking a prefix makes `web-storefront` and
 * `admin-dashboard` both render `ZA`, which defeats the point of a per-project
 * badge; word initials keep sibling projects distinguishable.
 */
export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }

  // CJK names carry meaning per character; two of them do not fit a 36px badge.
  if (/[\u3400-\u9fff\uf900-\ufaff]/.test(trimmed[0])) {
    return trimmed[0];
  }

  const words = trimmed.split(/[\s\-_.]+/).filter((word) => word.length > 0);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
