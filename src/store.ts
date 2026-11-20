import type * as vscode from "vscode";
import type { Project } from "./types";

const STORAGE_KEY = "projectRail.state";

/** What gets persisted. One key, so a project and the group it lives in cannot
 * be written separately and end up disagreeing. */
interface StoredState {
  projects: Project[];
  /** Group order as shown in the sidebar. */
  groups: string[];
}

const EMPTY: StoredState = { projects: [], groups: [] };

/**
 * The pinned-project list and its groups.
 *
 * Stored in `globalState` rather than `workspaceState`: the list describes the
 * user's machine, not the current workspace, so it has to survive switching
 * workspaces and be shared by every window.
 */
export class ProjectStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private read(): StoredState {
    const raw = this.context.globalState.get<unknown>(STORAGE_KEY);
    if (raw === undefined) {
      return { projects: [], groups: [] };
    }

    // 0.0.1 stored a bare Project[] with a user-editable `name`. The name is now
    // derived from the path, so only path and group carry over; everything lands
    // in the ungrouped bucket.
    if (Array.isArray(raw)) {
      const projects = raw
        .map((entry) => {
          const path = typeof entry?.path === "string" ? entry.path : "";
          return { path, group: "" };
        })
        .filter((entry) => entry.path !== "");
      return { projects, groups: [] };
    }

    const state = raw as Partial<StoredState>;
    return {
      projects: Array.isArray(state.projects) ? state.projects : [],
      groups: Array.isArray(state.groups) ? state.groups : [],
    };
  }

  private async write(state: StoredState): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, state);
  }

  list(): Project[] {
    return this.read().projects;
  }

  groups(): string[] {
    return this.read().groups;
  }

  project(path: string): Project | undefined {
    return this.read().projects.find((entry) => entry.path === path);
  }

  /**
   * Appends new paths to the front of the list, skipping ones already pinned.
   * Returns the entries actually added, so the caller can report the rest.
   */
  async add(paths: string[], group = ""): Promise<Project[]> {
    const state = this.read();
    const added: Project[] = [];

    for (const path of paths) {
      if (state.projects.some((entry) => entry.path === path)) {
        continue;
      }
      const project: Project = { path, group };
      state.projects.unshift(project);
      added.push(project);
    }

    if (added.length > 0) {
      await this.write(state);
    }
    return added;
  }

  async remove(path: string): Promise<void> {
    const state = this.read();
    const next = state.projects.filter((entry) => entry.path !== path);
    if (next.length !== state.projects.length) {
      await this.write({ ...state, projects: next });
    }
  }

  /** Moves a project into `group`, creating the group if it does not exist yet. */
  async setGroup(path: string, group: string): Promise<void> {
    const state = this.read();
    if (!state.projects.some((entry) => entry.path === path)) {
      return;
    }
    if (group !== "" && !state.groups.includes(group)) {
      state.groups.push(group);
    }
    const projects = state.projects.map((entry) =>
      entry.path === path ? { ...entry, group } : entry,
    );
    await this.write({ ...state, projects });
  }

  async createGroup(name: string): Promise<void> {
    const trimmed = name.trim();
    if (trimmed === "") {
      return;
    }
    const state = this.read();
    if (state.groups.includes(trimmed)) {
      return;
    }
    state.groups.push(trimmed);
    await this.write(state);
  }

  /**
   * Renames a group and re-points its members.
   *
   * Doing both in one write is what keeps the sidebar from briefly showing a
   * group whose members have gone missing.
   */
  async renameGroup(from: string, to: string): Promise<void> {
    const trimmed = to.trim();
    if (trimmed === "" || trimmed === from) {
      return;
    }

    const state = this.read();
    if (!state.groups.includes(from) || state.groups.includes(trimmed)) {
      return;
    }

    const groups = state.groups.map((name) => (name === from ? trimmed : name));
    const projects = state.projects.map((entry) =>
      entry.group === from ? { ...entry, group: trimmed } : entry,
    );
    await this.write({ groups, projects });
  }

  /** Removes a group. Its projects are kept and returned to the ungrouped list. */
  async deleteGroup(name: string): Promise<void> {
    const state = this.read();
    if (!state.groups.includes(name)) {
      return;
    }

    const groups = state.groups.filter((entry) => entry !== name);
    const projects = state.projects.map((entry) =>
      entry.group === name ? { ...entry, group: "" } : entry,
    );
    await this.write({ groups, projects });
  }
}

export { EMPTY as EMPTY_STATE };
