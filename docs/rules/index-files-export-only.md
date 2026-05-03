---
title: Index Files Export Only
description: Keep index files as barrel modules that only re-export module APIs; move registration, setup, and runtime logic into named files.
---

# Index Files Export Only

## Motivation

`index.ts` files are navigation points. When they contain setup logic, command registration, runtime side effects, or hidden orchestration, imports become harder to reason about and module boundaries blur.

Use `index.ts` only to re-export the public API of the current folder when it aggregates multiple exports. Put implementation in named files such as `register.ts`, `initialize.ts`, `run.ts`, `provider.ts`, or `store.ts`.

If an `index.ts` only re-exports one symbol or one sibling file, delete the `index.ts` and import the named file directly.

## Commands

Identify source folders first. Keep only folders that exist in the target repository:

```sh
CODE_PATHS=()
for dir in src test tests app apps package packages script scripts lib libs; do
  [ -d "$dir" ] && CODE_PATHS+=("$dir")
done
```

List all index files:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print | sort
```

Show index file contents for review:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print | sort \
  | while read -r file; do printf '\n== %s ==\n' "$file"; sed -n '1,120p' "$file"; done
```

Find index files with implementation signals:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print0 \
  | xargs -0 rg -n "\b(import|function|class|const|let|var|if|for|while|try|await|new)\b"
```

Find non-export lines in index files. This requires ripgrep with PCRE2:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print0 \
  | xargs -0 rg --pcre2 -n "^(?!\s*(export\b|$|#!/usr/bin/env node))"
```

Find module directories where `index.ts` imports from siblings and then exports functions:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print0 \
  | xargs -0 rg -n "import .* from './|export (async )?function|export const|export class"
```

Find single-export index files that should usually be deleted:

```sh
find "${CODE_PATHS[@]}" -path '*/dist/*' -prune -o -path '*/out/*' -prune -o -path '*/node_modules/*' -prune -o -name 'index.ts' -type f -print \
  | while read -r file; do count="$(rg -n "^\s*export\b" "$file" | wc -l | tr -d ' ')"; [ "$count" = 1 ] && printf '%s\n' "$file"; done
```

Identify entrypoint exceptions from package metadata and scripts:

```sh
rg -n '"(main|module|bin)"|"[^"]* .*index\.(ts|js)"|src/index\.ts|dist/index\.js' . -g 'package.json' -g '*.json'
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

1. Treat `index.ts` files as public module API files.
2. Move implementation from `index.ts` into a named sibling file.
3. Delete `index.ts` when it would only re-export one symbol or one sibling file.
4. Re-export from `index.ts` only when it aggregates multiple sibling modules.
5. Keep directory imports working only when the barrel has real aggregation value.
6. Use intent names for extracted files:
   - `register.ts` for command registration
   - `initialize.ts` for feature or UI setup
   - `run.ts` for executable scripts
   - `provider.ts` for provider classes
   - `store.ts` for stateful stores
7. Do not put side effects in files exported by a barrel.
8. If an extracted executable is also imported by an aggregate barrel, guard runtime execution with a direct-run check.
9. Allow package or binary entrypoints to contain runtime logic only when package metadata points directly to that file, such as `src/index.ts` or `dist/index.js`.
10. Prefer moving entrypoint logic too when changing package metadata is low risk.
11. Rerun the index audit commands after changes.
12. Run focused typecheck and repository checks.

Before deleting a single-export `index.ts`, check whether the repository treats that folder as a public module path. Delete it when local imports can use the named file directly and package metadata does not expose the folder path. Keep it when package APIs, external consumers, generated declarations, or documented imports rely on the folder import.

For small repositories, no change is often the right outcome. Prefer moving obvious implementation out of index files, but do not break intentional folder-as-module APIs only to remove a thin barrel.

If no applicable index cleanup exists, do not commit by default. Create an empty validation commit only when the surrounding workflow explicitly requires a marker commit for every rule.

## Patterns

Command module with one export:

```ts
// register.ts
import type { CommandRegistry } from './types';
import { registerStatusCommand } from './status';
import { registerSyncCommand } from './sync';

export function registerCommands(registry: CommandRegistry): void {
  registerStatusCommand(registry);
  registerSyncCommand(registry);
}
```

```ts
// call site
import { registerCommands } from './commands/register';
```

Feature initializer with one export:

```ts
// initialize.ts
import type { AppContext } from './types';
import { registerCodeLens } from './codelens';
import { initializeDecorations } from './decorations';

export function initializeFeature(context: AppContext): void {
  initializeDecorations(context);
  registerCodeLens(context);
}
```

```ts
// call site
import { initializeFeature } from './features/example/initialize';
```

Executable script with safe barrel export:

```ts
// run.ts
import { pathToFileURL } from 'node:url';

export function runTask(): void {
  // script logic
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTask();
}
```

```ts
// package.json
{
  "scripts": {
    "task": "tsx scripts/example/run.ts"
  }
}
```

Pure aggregate barrel:

```ts
export { createItem } from './items';
export type { Item } from './types';
export { ItemProvider } from './provider';
```

Avoid:

```ts
// index.ts
export { registerCommands } from './register';
```

Single-export barrels add indirection without aggregation value. Import `./register` directly instead.

Also avoid:

```ts
import { registerStatusCommand } from './status';
import { registerSyncCommand } from './sync';

export function registerCommands(registry: CommandRegistry): void {
  registerStatusCommand(registry);
  registerSyncCommand(registry);
}
```

Use this only in a named implementation file, not in `index.ts`.
