---
title: Avoid Type Duplication
description: Reuse, derive, and compose TypeScript types instead of repeating object shapes and utility types.
---

# Avoid Type Duplication

## Motivation

Repeated type shapes drift over time. If the same subset, inline object, or option shape appears in multiple places, name it once and reuse it.

Prefer deriving from existing domain types with `Pick`, `Omit`, `Extract`, `ReturnType`, and intersections before writing a new object shape manually.

Do not extract every one-off object. Extract when the name clarifies intent, the type is reused, or the shape represents a domain contract.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS="$(printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d "$dir" ] && printf '%s ' "$dir"; done)"
```

List declared types:

```sh
rg -n "\b(type|interface|class|enum)\s+[A-Za-z0-9_]+" $CODE_PATHS -g '*.ts'
```

Find utility types:

```sh
rg -n "Pick<|Omit<|Partial<|Required<|Record<|Extract<|Exclude<|ReturnType<|Parameters<|Awaited<" $CODE_PATHS -g '*.ts'
```

Count repeated utility type expressions:

```sh
rg -o "(Pick|Omit|Partial|Record|Extract|ReturnType|Awaited)<[^>]+>" $CODE_PATHS -g '*.ts' | sort | uniq -c | sort -nr
```

Inspect object type aliases across files:

```sh
rg -nU "type\s+\w+\s*=\s*\{[^}]+\}" $CODE_PATHS -g '*.ts'
```

Search for repeated object fields when a concrete shape seems duplicated:

```sh
rg -n "label:\s*string|value:\s*[A-Za-z0-9_<>]+|provider:\s*[A-Za-z0-9_<>]+" $CODE_PATHS -g '*.ts'
```

Find inline object parameters and return shapes:

```sh
rg -n "function\s+[A-Za-z0-9_]+\([^)]*:\s*\{|:\s*\{\s*$|\):\s*\{" $CODE_PATHS -g '*.ts'
```

Find inline array object shapes:

```sh
rg -n "Array<\{|:\s*\{[^}]+}\[]" $CODE_PATHS -g '*.ts'
```

Run verification commands that exist in the repo:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

Work one repeated shape at a time.

1. Start with repeated utility types in the same file.
2. Extract a local type alias when reuse is file-local.
3. Export the type only when reuse crosses module boundaries.
4. Prefer deriving from the source domain type instead of copying fields.
5. Put domain-derived aliases near the source domain type.
6. Put generic cross-file helpers near the consumers, such as a local `types.ts` or feature-specific helper file.
7. Run typecheck after each extraction.
8. Rerun the duplicate scan and decide if remaining matches are intentional.

## Patterns

Repeated subset:

```ts
type SessionKeySource = Pick<Session, 'provider' | 'sessionId'>;
type ActiveSessionSource = SessionKeySource & Pick<Session, 'path'>;
```

Repeated partial node:

```ts
export type TreeNodeDraft = Partial<TreeNode>;
```

Repeated option shape:

```ts
export type SelectOption<T extends string> = {
  label: string;
  value: T;
};
```

Use this when multiple files share the same shape and only the value type changes.

Repeated cast boundary:

```ts
export type TreeNodeDraft = Partial<TreeNode>;

const node = value as TreeNodeDraft | undefined;
```

Use `Draft` for repeated partial casts at unknown-input boundaries.

Repeated nested result:

```ts
type SuccessResult = Extract<Result, { ok: true }>;
type FailureResult = Extract<Result, { ok: false }>;
```

Repeated timer handle:

```ts
type TimeoutHandle = ReturnType<typeof setTimeout>;
```

## Edge Cases

Do not extract a one-off inline object just because it exists. A named type should either remove duplication or make a domain concept clearer.

Do not replace `Record<string, unknown>` everywhere by default. It is often a generic parser boundary, not domain duplication.

Prefer local aliases over exported aliases until another module needs the type.

If a type is derived from public data, keep it near that data model. If it is UI-only or command-only, keep it local to that area.

Use suffixes to clarify intent, not as a rigid convention. Common suffixes: `Source`, `Draft`, `Candidate`, `Stats`, `Group`, `Option`.

Tests should reuse domain types when asserting domain values, but inline fixture shapes are fine when the test data is intentionally local.
