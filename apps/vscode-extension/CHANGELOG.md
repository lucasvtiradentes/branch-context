# Changelog

## 0.4.0

### Minor Changes

- 8c9d918: Replace the current context and status bar UI with a Config view that shows mode, branch, base, template, CLI info, and issues, plus actions for sync, backup, config, branch checkout, template apply, and opening global storage.
- 522bbca: Replace stored session titles with initial and last user messages across Claude Code, Codex, and Pi sessions.

### Patch Changes

- df7132b: Refine the Config view with local/global mode in the view description, a global storage action, and toggles for sound and commit descriptions.

## 0.3.2

### Patch Changes

- 7d2d585: Move branch-owned `sessions.json` and `base_branch` state into `_branch/.config/` and migrate legacy files on access.

## 0.3.1

### Patch Changes

- d9b1c3b: Rename branch AI session cache files from agents.json to sessions.json.

## 0.3.0

### Minor Changes

- a6c2f40: Simplify context storage configuration with direct `branches_folder` and `templates_folder` paths, infer templates from branch prefixes, keep local config and branch contexts gitignored by default, and add a CLI command for changing the templates folder.
- 34dd8ff: Persist collapsed and expanded group state across Branch AI Sessions, Branch Git Changes, and Other Branches views.
- 0a9dce3: Add Branch AI Sessions rename support, with a simplified session metadata format that uses one description field for custom labels and pin state separately.
- 56905fc: Show Branch AI Sessions in workspaces without Branch Context initialized, keep active session detection scoped to the current workspace, and avoid duplicate refreshes after the extension writes agent session metadata.

## 0.2.1

### Patch Changes

- 5fb563d: Fix bundled CLI resource lookup and relax VS Code CLI compatibility checks so newer CLI versions do not trigger update prompts.
- 625c398: Default agent sessions and other branches group-by modes to flat.

## 0.2.0

### Minor Changes

- 6d1862e: Add an update extension action, improve CLI/extension mismatch prompts, and simplify the status bar tooltip.

## 0.1.0

### Minor Changes

- 47cae35: Add Other Branches AI sessions mode with shared session actions, branch-to-branch session moves that patch provider JSONL metadata, and a VS Code command for updating the CLI.

  Fix local dev/prod extension compatibility handling and avoid CLI version checks failing when the CLI is launched outside the repository.

## 0.0.3

### Patch Changes

- 222beba: Improve shared CLI and VS Code extension behavior across the current branch.

  CLI now owns its terminal UI helpers, has cross-platform dev install scripts, reuses global path constants, and keeps dev installs isolated from production installs.

  VS Code extension now has cleaner feature/module organization, opens branch file changes as diffs, isolates dev CLI version checks, stores pinned agent sessions in the agents file, marks active agent sessions correctly, and loads cached agent session state during startup.

## 0.0.2

### Patch Changes

- a87a721: Publish the CLI and VS Code extension.

## 0.0.1

### Patch Changes

- be96e38: Publish initial version.
