# branch-context

## 0.3.0

### Minor Changes

- 522bbca: Replace stored session titles with initial and last user messages across Claude Code, Codex, and Pi sessions.
- 553fb01: Add global storage and backup commands, infer local/global mode from machine config, simplify branch context config to derived storage paths, and store branch sessions as a top-level JSON array.

### Patch Changes

- 774a364: Restore interactive keyboard multi-select with viewport scrolling for prune branch and context selection.
- a50deb4: Publish CLI command modules alongside the entrypoint so installed packages can discover and run every command.

## 0.2.1

### Patch Changes

- 7d2d585: Move branch-owned `sessions.json` and `base_branch` state into `_branch/.config/` and migrate legacy files on access.

## 0.2.0

### Minor Changes

- a16d6b8: Add Pi session indexing with branch metadata recorded by the Branch Context Pi package.

### Patch Changes

- aae403b: Update init to choose gitignore mode based on the configured templates folder and locally exclude custom hook files when requested.
- a2c7505: Prevent detached HEAD from creating or displaying a branch context named HEAD.
- b65b20b: Rename branch AI session cache files to sessions.json and add a VS Code command to sync sessions across active and archived branch contexts.

## 0.1.0

### Minor Changes

- a6c2f40: Simplify context storage configuration with direct `branches_folder` and `templates_folder` paths, infer templates from branch prefixes, keep local config and branch contexts gitignored by default, and add a CLI command for changing the templates folder.

### Patch Changes

- ca68f22: Run CLI init through the shared core init service so it matches VS Code behavior and updates current-branch context metadata consistently.
- c8d47bf: Improve init, template, and hook handling across the CLI and VS Code extension.

## 0.0.6

### Patch Changes

- 5fb563d: Fix bundled CLI resource lookup and relax VS Code CLI compatibility checks so newer CLI versions do not trigger update prompts.

## 0.0.5

### Patch Changes

- 1ab7936: Copy core resources into the CLI dist during build so published installs include config, hook, template, and asset files required at runtime.

## 0.0.4

### Patch Changes

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
