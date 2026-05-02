---
title: Prefer Domain Helpers Over Inline Logic
description: Extract repeated predicates, parsing, formatting, and boundary checks into named helpers that express domain intent.
---

# Prefer Domain Helpers Over Inline Logic

## Motivation

Inline logic is cheap once and expensive when repeated. Repeated checks, string formatting, parsing, and boundary handling drift because each call site becomes its own implementation.

Prefer named helpers when the same rule appears in multiple places or when a low-level expression hides domain intent. The helper name should explain the business or UI meaning, not just the syntax.

Do not extract one-off logic only to make code shorter. Extract when the rule is reused, likely to change, or meaningful enough to deserve a name.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS="$(printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d "$dir" ] && printf '%s ' "$dir"; done)"
```

Find repeated inline predicates and transformations:

```sh
rg -n "(typeof .* ===|Array\.isArray|instanceof |\.includes\(|\.startsWith\(|\.endsWith\(|\.replace\(|\.split\(|\.filter\(|\.map\()" $CODE_PATHS -g '*.ts'
```

Count exact repeated logic lines:

```sh
rg -n "(typeof |Array\.isArray|\.replace\(|\.split\(|\.includes\(|\.filter\(|\.map\()" $CODE_PATHS -g '*.ts' \
  | sed 's/^[^:]*:[0-9]*:[[:space:]]*//' \
  | sort | uniq -c | sort -nr | head -100
```

Find repeated boundary messages and status returns:

```sh
rg -n "not initialized|not a .*repository|return [01];|console\.(log|error)\(`?(error|warning):" $CODE_PATHS -g '*.ts'
```

Find repeated parser and formatter helpers:

```sh
rg -n "function (is|has|get|normalize|format|parse|resolve|require|escape)[A-Z]|const (is|has|get|normalize|format|parse|resolve|require|escape)[A-Z]" $CODE_PATHS -g '*.ts'
```

Find repeated JSON and unknown-input guards:

```sh
rg -n "JSON\.parse|JSON\.stringify|value: unknown|as Record|typeof .* === 'object'|typeof .* === 'string'" $CODE_PATHS -g '*.ts'
```

Find repeated markdown, shell, URL, regex, or path escaping:

```sh
rg -n "escape|replace\(/\[|encodeURIComponent|quote|split\(sep\)|join\('/'\)" $CODE_PATHS -g '*.ts'
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

Work one helper family at a time.

1. Group matches by intent, not by syntax.
2. Extract the smallest helper that names the repeated rule.
3. Keep the helper local if only one file uses it.
4. Put app-specific side-effect helpers in the app, such as `apps/<app>/helpers`.
5. Put app-local pure helpers in the app, such as `apps/<app>/lib`.
6. Keep domain helpers near the domain module that owns the rule.
7. Export from a shared package only when the helper is a real cross-package contract.
8. Preserve behavior at boundary call sites before improving naming or return shapes.
9. Delete the old local helper copies after moving behavior.
10. Run focused typecheck and tests after each helper family.
11. Rerun the scan and leave intentional one-offs alone.

## Patterns

Repeated command boundary:

```ts
function requireWorkspace() {
  const workspace = findWorkspace();
  if (!workspace) {
    printError('not in a workspace');
  }
  return workspace;
}
```

Boundary with optional side effect:

```ts
function requireWorkspace(options: { silent?: boolean } = {}) {
  const workspace = findWorkspace();
  if (!workspace && !options.silent) {
    printError('not in a workspace');
  }
  return workspace;
}
```

Use this when some callers need user-facing output and others need a pure failure signal.

Repeated answer parsing:

```ts
function normalizePromptAnswer(answer: string) {
  return answer.trim().toLowerCase();
}

function isYesAnswer(answer: string) {
  const normalized = normalizePromptAnswer(answer);
  return normalized === 'y' || normalized === 'yes';
}
```

Repeated string-value guard:

```ts
function isStringValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
```

Use this when guards differ only by the accepted value set. Keep domain guard names at call sites, but delegate the repeated membership check:

```ts
function isViewMode(value: unknown): value is ViewMode {
  return isStringValue(viewModeValues, value);
}
```

Repeated rendering escape:

```ts
function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}
```

Repeated formatted line:

```ts
function markdownField(label: string, value: string) {
  return `**${label}:** ${escapeMarkdown(value)}`;
}
```

Repeated unknown-value boundary:

```ts
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
```

## Edge Cases

Do not merge helpers from different domains just because the implementation matches. Escaping markdown, escaping regex, escaping shell args, and escaping URLs are different contracts.

Do not create a broad generic helper when a domain-specific name would explain intent better.

Do not export helpers across package boundaries unless the owning package should support that behavior as public API.

When extracting a boundary helper, move the duplicated user-facing message into the helper. Keeping the same string at each call site defeats the extraction.

Use a mode option such as `{ silent: true }` when the same boundary exists in both interactive and non-interactive paths.

Keep compatibility shims local when migrating old saved values or external input names.

After moving shared formatting or guard logic, delete the original local functions. Do not leave dead helpers behind.

Repeated parsing of external command output deserves extra care. Extract it only with tests that cover malformed, empty, and legacy lines.

Tests may keep inline literals when they assert rendered output. Domain behavior assertions should use the same helper or domain constant as production code.
