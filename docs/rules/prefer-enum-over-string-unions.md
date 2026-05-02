---
title: Prefer Enum Over String Unions
description: Use enums for repeated string literal domains to reduce duplication and improve maintenance.
---

# Prefer Enum Over String Unions

## Motivation

Prefer enums when a string literal union represents a stable domain value used in more than one place.

Enums make call sites easier to maintain because the value is named once, exported once, and reused in comparisons, return values, fixtures, and tests. This avoids duplicated strings like `ready`, `failed`, or `missing_config` drifting across packages.

Keep plain string literals when the value is just display text, a file path, a shell argument, a JSON key, or a one-off local formatting value.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS="$(printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d "$dir" ] && printf '%s ' "$dir"; done)"
```

Find candidate unions:

```sh
rg -n "' \\| '" $CODE_PATHS -g '*.ts'
```

Find remaining multi-line type aliases:

```sh
rg -U -n "type [A-Za-z0-9_]+ =\\n(\\s+\\| '[^']+'\\n)+" $CODE_PATHS -g '*.ts'
```

Find direct comparisons that may still duplicate enum values:

```sh
rg -n "'ready'|'failed'|'missing_config'|'error'|'warning'" $CODE_PATHS -g '*.ts'
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

Run the commands that exist. Common examples:

```sh
pnpm typecheck || npm run typecheck
pnpm test || npm test
pnpm build || npm run build
```

## Process

Convert one domain at a time.

1. Replace the string union type with an exported enum.
2. Replace function returns with enum members.
3. Replace comparisons in CLI, extension, services, and tests.
4. Build the owning package before checking downstream packages.
5. Run `rg -n "' \\| '" $CODE_PATHS -g '*.ts'` again.

## Edge Cases

Do not convert `Pick<T, 'a' | 'b'>` key selections. They are type-level property keys, not value domains.

Do not convert display joins like `.join(' | ')`.

Put the enum where the domain belongs:

- Protocol or lifecycle values belong near the protocol/lifecycle implementation.
- Data model values belong beside the model type.
- CLI-only inputs can stay local to the command.
- UI-only states can stay local to the UI module.

Keep compatibility constants when public APIs already export them. Example: keep `DEFAULT_STATUS`, but make it reference `Status.Ready`.

After changing exported enums in a shared package, rebuild that package before typechecking downstream packages, because downstream packages may read generated declarations.

Tests should use enum members for domain assertions. Literal strings are fine only when asserting rendered output or serialized external data.
