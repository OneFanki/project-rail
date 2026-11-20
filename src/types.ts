/** A folder the user pinned to the sidebar. */
export interface Project {
  /** Absolute filesystem path. Doubles as the identity of the entry. */
  path: string;
  /** Group name, or "" for ungrouped. */
  group: string;
}

/**
 * The name shown for a project.
 *
 * Derived from the path rather than stored: the label is defined as the folder's
 * own name, so a stored copy could only ever drift from the folder it describes
 * (after a rename on disk, or a bad edit). Deriving makes that impossible.
 */
export function projectName(project: Project, basename: (target: string) => string): string {
  return basename(project.path) || project.path;
}
