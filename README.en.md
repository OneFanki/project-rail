# Project Rail

**A project manager for VS Code.** Every project you work on, in one list — grouped, searchable, and
one click away.

Repository and issue tracker: [github.com/OneFanki/project-rail](https://github.com/OneFanki/project-rail)

VS Code gives you a file tree, a recent-folders list, and a command palette that knows nothing about
the projects you actually work on. Project Rail adds the missing layer: an explicit, curated list of
projects that you control.

## What it does

- **One list for all your projects.** Not a history of what you happened to open, but a list you
  build deliberately.
- **Groups.** Separate work from side projects in collapsible sections.
- **Fast switching.** Open a project in the current window or a new one, your choice every time.
- **Cards, not rows.** Each project gets a colour badge derived from its path, its name, and its
  full path — enough to tell four similar-sounding repos apart at a glance.
- **Search.** Type to filter across names and paths.

A project is a folder on disk. That is the implementation; the feature is having your projects
organised and reachable.

## Usage

Click the Project Rail icon in the activity bar.

### Adding projects

| Action                                    | Where                                     |
| ----------------------------------------- | ----------------------------------------- |
| Add one or more folders                   | **Add** → _Add folder..._                 |
| Save the folder open in this window       | **Add** → _Save this folder as a project_ |
| Pick a folder and open it here            | **Add** → _Open folder as project..._     |
| Pick a folder and open it in a new window | **Add** → _Open folder in new window..._  |
| Create a group                            | **Add** → _New group..._                  |

### Working with projects

| Action                     | How                                                           |
| -------------------------- | ------------------------------------------------------------- |
| Open in the current window | Click the card, or right-click → _Open in current window_     |
| Open in a new window       | Right-click → _Open in new window_, or middle-click           |
| Move to a group            | Right-click → _Move to group..._, or drag onto a group header |
| Reveal the folder          | Right-click → _Reveal in file explorer_                       |
| Remove from the list       | Right-click → _Remove from list_ (the folder is not deleted)  |
| Collapse a group           | Click its header                                              |
| Rename or delete a group   | Right-click the group header                                  |

Clicking a card replaces the workspace of the current window. Set `projectRail.openInNewWindow` to
`true` if you would rather a plain click always opened a new window; the context menu offers both
actions regardless.

A project's name is always the folder's own name, so it cannot drift from what is on disk. Entries
whose folder has been moved or deleted are dimmed and marked **MISSING**; opening one offers to
remove it from the list.

## Settings

| Setting                       | Default | Description                                         |
| ----------------------------- | ------- | --------------------------------------------------- |
| `projectRail.openInNewWindow` | `false` | Open projects in a new window when clicking a card. |

## Localisation

The interface follows the display language of VS Code. English and Simplified Chinese ship with the
extension; other languages fall back to English.

## Requirements

VS Code 1.90 or newer. No runtime dependencies, no telemetry, no network access. The project list
lives in VS Code's global state and is shared by every window.

## Development

```bash
npm install
npm run watch        # bundle on change
npm run typecheck
npm test
npm run icon         # regenerate media/icon.png from media/icon.svg
npm run preview      # render the sidebar UI to PNG files
```

Press `F5` to launch an Extension Development Host.

`npm run preview` loads the webview markup in headless Chromium with fake project data and writes
`.p-*.png` files, so layout changes can be checked without clicking through VS Code. It is a
development aid only and is excluded from the published package.

## License

MIT

## Links

- Repository: [github.com/OneFanki/project-rail](https://github.com/OneFanki/project-rail)
- Issues: [github.com/OneFanki/project-rail/issues](https://github.com/OneFanki/project-rail/issues)
- Changelog: [CHANGELOG.md](https://github.com/OneFanki/project-rail/blob/main/CHANGELOG.md)
