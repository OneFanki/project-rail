# Changelog

## [0.0.1]

Initial release.

- Sidebar of pinned project folders, rendered as cards with a colour badge, the folder name, and the
  full path. The list lives in global state and is shared by every window.
- Add folders by picking them, by saving the folder already open, or by picking one and opening it
  straight away in the current window or a new one.
- Open a project in the current window or a new window, from the card, the context menu, or a
  middle-click.
- Groups: create, rename, delete, reorder by drag, collapse. Dragging a project onto a group header
  moves it there.
- Entries whose folder no longer exists are dimmed and can be removed from the list.
- Search filters by folder name and path.
