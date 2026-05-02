# branch-context

## 0.0.3

### Patch Changes

- 222beba: Improve shared CLI and VS Code extension behavior across the current branch.

  CLI now owns its terminal UI helpers, has cross-platform dev install scripts, reuses shared path constants, and keeps dev installs isolated from production installs.

  VS Code extension now has cleaner feature/module organization, opens branch file changes as diffs, isolates dev CLI version checks, stores pinned agent sessions in the agents file, marks active agent sessions correctly, and loads cached agent session state during startup.

## 0.0.2

### Patch Changes

- a87a721: Publish the CLI and VS Code extension.

## 0.0.1

### Patch Changes

- be96e38: Publish initial version.
