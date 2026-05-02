# Changelog

## 0.1.0

### Minor Changes

- 47cae35: Add Other Branches AI sessions mode with shared session actions, branch-to-branch session moves that patch provider JSONL metadata, and a VS Code command for updating the CLI.

  Fix local dev/prod extension compatibility handling and avoid CLI version checks failing when the CLI is launched outside the repository.

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
