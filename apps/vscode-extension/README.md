# Branch Context

Branch Context brings `bctx` branch notes into VS Code.

## Features

- Status bar entry for the active branch context.
- Activity Bar views for current, recent, archived, template, and config context data.
- Commands for sync, status, base branch updates, template application, and config opening.
- Visual highlighting for generated `<bctx:commits>` and `<bctx:files>` regions.
- CodeLens actions inside Branch Context `context.md` files.

## Requirements

- A git workspace.
- A Branch Context `.bctx/config.json` created by `bctx init`.

## Commands

- `Branch Context: Open Current Context`
- `Branch Context: Sync`
- `Branch Context: Status`
- `Branch Context: Set Base`
- `Branch Context: Apply Template`
- `Branch Context: Open Config`
- `Branch Context: Refresh Views`

## Development

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Open the repo in VS Code.
4. Press `F5` to launch an Extension Development Host.
