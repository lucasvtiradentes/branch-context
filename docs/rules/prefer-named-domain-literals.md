---
title: Prefer Named Domain Values
description: Replace raw domain literals in branching logic with enums, named constants, or named value sets.
---

# Prefer Named Domain Values

## Motivation

Raw literals in branching logic hide domain meaning. Values like `R`, `base_not_found`, `session_meta`, `github.com`, or `yes` are not just text; they can be protocol, status, lifecycle, host, scope, or input values.

Name these values once so comparisons, tests, fixtures, and downstream consumers stay aligned when the domain changes.

Use enums for closed stable domains. Use named constants for meaningful single values. Use named readonly arrays or sets for accepted aliases.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS="$(printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d "$dir" ] && printf '%s ' "$dir"; done)"
```

Find raw literal comparisons:

```sh
rg -n "(===|!==|==|!=) ['\"][^'\"]+['\"]|['\"][^'\"]+['\"] (===|!==|==|!=)" $CODE_PATHS -g '*.ts'
```

Find protocol-like field comparisons:

```sh
rg -n "\.(type|status|role|scope|state|kind|level|provider|reason|mode|source) (===|!==|==|!=) ['\"][^'\"]+['\"]" $CODE_PATHS -g '*.ts'
```

Count repeated compared literals:

```sh
rg -n "(===|!==|==|!=) ['\"][^'\"]+['\"]" $CODE_PATHS -g '*.ts' \
  | sed -E "s/^([^:]+):([0-9]+):.*(===|!==|==|!=) ['\"]([^'\"]+)['\"].*/\4  \1:\2/" \
  | sort
```

Find short status-code literals:

```sh
rg -n "['\"](A|M|D|R|C|U|\?|\!)['\"]" $CODE_PATHS -g '*.ts'
```

Find event or protocol literals after identifying the local vocabulary:

```sh
rg -n "['\"](session_meta|turn_context|event_msg|response_item|user_message|custom-title|assistant|user)['\"]" $CODE_PATHS -g '*.ts'
```

Find raw comparisons that duplicate existing enum values:

```sh
rg -n "'base_not_found'|'missing_base'|'no_current_branch'|'missing_context'|'template_not_found'" $CODE_PATHS -g '*.ts'
```

Find named constants that may need to move if reused across files:

```sh
rg -n "const [A-Z0-9_]+ = ['\"][^'\"]+['\"]|enum [A-Za-z0-9_]+" $CODE_PATHS -g '*.ts'
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

Convert one value family at a time.

1. Group findings by domain, not by literal value.
2. Check if an enum or named constant already exists.
3. Replace raw comparisons with existing enum members first.
4. Create a new enum for stable protocol, lifecycle, state, status, role, or reason values.
5. Create a top-of-file constant for a meaningful single value used only in one file.
6. Move the constant to a shared constants module only when another file needs the same value.
7. Create a named constant for public string options when enum conversion would break callers.
8. Create named readonly arrays or sets for input aliases such as prompt answers.
9. Derive value arrays from enum members with `Object.values(Enum)`.
10. Put legacy persisted values in a separate `Legacy*` enum.
11. Replace all occurrences of the named literal, including template strings and URL builders.
12. Update tests that assert domain behavior to use the named value.
13. Leave serialized fixtures and rendered-output assertions as literals when they intentionally verify external data.
14. Build shared packages before checking downstream packages.
15. Rerun the raw-literal scans.

## Patterns

Stable status codes:

```ts
export enum FileStatus {
  Added = 'A',
  Modified = 'M',
  Deleted = 'D',
  Renamed = 'R',
}

if (file.status === FileStatus.Renamed) {
  return file.oldPath;
}
```

Partially covered external status codes:

```ts
type ChangedFile = {
  status: FileStatus | string;
};
```

Use `Enum | string` when external input may include values the code does not handle yet.

Enum value arrays:

```ts
const fileStatusValues = Object.values(FileStatus);
```

Derive arrays from the enum. Do not maintain a parallel `as const` tuple with the same values.

External event protocol:

```ts
export enum SessionEventType {
  Started = 'session_started',
  Message = 'message',
}

if (event.type === SessionEventType.Message) {
  return event.payload;
}
```

Legacy persisted value:

```ts
export enum GroupBy {
  Flat = 'flat',
  Date = 'date',
}

enum LegacyGroupBy {
  Recent = 'recent',
}

type SavedGroupBy = GroupBy | LegacyGroupBy;

function normalizeGroupBy(value: SavedGroupBy): GroupBy {
  return value === LegacyGroupBy.Recent ? GroupBy.Date : value;
}
```

Keep the current enum clean and isolate read-only legacy values.

Existing enum value:

```ts
if (result.reason === ResultReason.NotFound) {
  return 'not found';
}
```

Public string option:

```ts
export const GLOBAL_SCOPE = 'global';
export type ConfigScope = typeof GLOBAL_SCOPE;

if (options.scope === GLOBAL_SCOPE) {
  args.push('--global');
}
```

Single-file supported value:

```ts
const GITHUB_HOST = 'github.com';

if (remote.host === GITHUB_HOST) {
  return `https://${GITHUB_HOST}/${remote.owner}/${remote.repo}`;
}
```

Use a top-of-file constant when the literal has meaning but is not a closed enum domain.

Replace the literal everywhere in that logic path, including template strings and generated URLs.

Reusable supported value:

```ts
export const DEFAULT_REGION = 'us-east-1';
```

Move the constant to a shared constants module only after multiple files need it.

Input aliases:

```ts
const YES_ANSWERS: readonly string[] = ['y', 'yes'];

if (YES_ANSWERS.includes(normalizedAnswer)) {
  return true;
}
```

Use a readonly array for small alias sets. Use a `Set` when the set grows, membership checks are frequent, or `.has()` reads better:

```ts
const CANCEL_INPUTS = new Set(['c', 'cancel']);

if (CANCEL_INPUTS.has(input)) {
  return null;
}
```

Enum lookup table:

```ts
const labels = {
  [GroupBy.Flat]: 'Flat',
  [GroupBy.Date]: 'Date',
} as const;
```

When each enum member maps to one value, prefer a lookup table over repeated branching.

## Edge Cases

Do not replace `typeof value === 'string'`, `'object'`, `'boolean'`, or other JavaScript runtime type names.

Do not replace display labels, shell flags, file extensions, URLs, or serialized fixture data unless they are also domain decisions in code.

Button labels and hostnames can be named constants when code branches on them. Do not turn them into enums unless they form a closed domain with multiple related values.

Do not convert a public string-literal option to a string enum without checking downstream compatibility. A named constant plus a literal type is usually safer.

Do not enum every possible external code if the codebase only cares about one branch. Start with the handled values and keep unknown values typed as `string` when necessary.

If a value is persisted in config, workspace state, or user data, use string enums or constants that preserve the serialized value exactly.

UI labels owned by one app should stay in that app. Input aliases, protocol values, and cross-package domain values should live near the core or domain owner.

Tests should use named values for domain assertions. Literal strings are fine when asserting rendered output or external serialization.
