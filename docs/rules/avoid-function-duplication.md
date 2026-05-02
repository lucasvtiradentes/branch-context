---
title: Avoid Function Duplication
description: Extract repeated behavior into named helpers when functions or callback bodies share the same intent and failure semantics.
---

# Avoid Function Duplication

## Motivation

Repeated functions drift faster than repeated types. The same parser, formatter, command flow, storage mutation, or boundary check can become subtly different after a few edits.

Prefer a named helper when duplicated behavior has the same intent, same inputs, and same failure semantics. Keep code inline when it is only structurally similar or when extraction hides important domain differences.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS="$(printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d "$dir" ] && printf '%s ' "$dir"; done)"
```

List function declarations, methods, and arrow functions:

```sh
rg -n "^\s*(export\s+)?(async\s+)?function\s+[A-Za-z0-9_]+|^\s*(export\s+)?const\s+[A-Za-z0-9_]+\s*=\s*(async\s*)?(\([^=]*\)|[A-Za-z0-9_]+)\s*=>|^\s*(private|protected|public)?\s*(async\s+)?[A-Za-z0-9_]+\([^)]*\)\s*[:{]" $CODE_PATHS -g '*.ts'
```

Find repeated function names:

```sh
rg -o "function\s+[A-Za-z0-9_]+|const\s+[A-Za-z0-9_]+\s*=\s*(async\s*)?(\([^=]*\)|[A-Za-z0-9_]+)\s*=>" $CODE_PATHS -g '*.ts' \
  | sed -E 's/.*function ([A-Za-z0-9_]+).*/\1/; s/.*const ([A-Za-z0-9_]+).*/\1/' \
  | sort | uniq -c | sort -nr
```

Find repeated callback-heavy flows:

```sh
rg -n "(map|filter|find|sort|reduce)\([^\n]*=>|\.then\([^\n]*=>|\.catch\([^\n]*=>" $CODE_PATHS -g '*.ts'
```

Find repeated boundary and UI command flows:

```sh
rg -n "try \{|catch \(error\)|return null;|return \[\];|return 1;|show[A-Za-z0-9_]*\(|prompt[A-Za-z0-9_]*\(|select[A-Za-z0-9_]*\(" $CODE_PATHS -g '*.ts'
```

Find repeated parser, formatter, and storage helpers:

```sh
rg -n "function (parse|format|normalize|clean|extract|read|write|save|delete|archive|restore|move)[A-Z]|const (parse|format|normalize|clean|extract|read|write|save|delete|archive|restore|move)[A-Z]" $CODE_PATHS -g '*.ts'
```

Find exact repeated lines that often indicate missing helpers:

```sh
rg -n "(JSON\.parse|JSON\.stringify|spawnSync|execFileSync|state\.(get|set|update)|storage\.(get|set|update)|description: .*current|\.trim\(\)\.replace|Math\.round|toFixed)" $CODE_PATHS -g '*.ts' \
  | sed 's/^[^:]*:[0-9]*:[[:space:]]*//' \
  | sort | uniq -c | sort -nr | head -100
```

For higher signal, run an AST duplicate scan if the repo has TypeScript installed:

```sh
node --input-type=module <<'NODE'
import ts from 'typescript';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const roots = execSync("printf '%s\n' src tests app apps package packages lib libs | while read -r dir; do [ -d \"$dir\" ] && printf '%s ' \"$dir\"; done", { encoding: 'utf8' }).trim();
const files = roots
  ? execSync(`rg --files -g '*.ts' -g '!**/dist/**' -g '!**/out/**' -g '!**/node_modules/**' ${roots}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  : [];

function normalize(text) {
  return text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

const bodies = [];
for (const file of files) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body) {
      const body = normalize(node.body.getText(sf));
      if (body.length >= 80) {
        bodies.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, body });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

for (const [body, items] of Map.groupBy(bodies, (item) => item.body)) {
  if (items.length > 1) {
    console.log(`\n${items.length}x ${body.slice(0, 120)}`);
    for (const item of items) console.log(`  ${item.file}:${item.line}`);
  }
}
NODE
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

Work one duplicate family at a time.

1. Group duplicate functions by behavior and owner, not only by syntax.
2. Confirm inputs, outputs, side effects, and failure semantics match.
3. Extract same-file helpers first when reuse is local.
4. Move pure app-local helpers into an app `lib` or feature helper module.
5. Move domain helpers near the module that owns the domain rule.
6. Export cross-package helpers only when the behavior is a stable contract.
7. Parameterize real differences instead of hiding them in separate copies.
8. Delete local wrappers if they only call the new helper.
9. Use a tiny adapter when a generic helper returns generic names but the call site needs domain vocabulary.
10. Run focused typecheck and tests after each helper family.
11. Rerun duplicate scans and leave intentional symmetry alone.

## Patterns

Repeated option picker:

```ts
type PickerOption<T extends string> = {
  label: string;
  description?: string;
  value: T;
};

type ShowPicker = <T extends string>(
  items: Array<PickerOption<T>>,
  options: { placeholder: string },
) => Promise<PickerOption<T> | null>;

export async function showModePicker<T extends string>(
  showPicker: ShowPicker,
  options: Array<{ label: string; value: T }>,
  current: T,
  placeholder: string,
) {
  return showPicker(
    options.map((option) => ({
      label: option.label,
      description: option.value === current ? 'current' : undefined,
      value: option.value,
    })),
    { placeholder },
  );
}
```

Repeated parser boundary:

```ts
export function parseJsonRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}
```

Repeated formatter with a real parameter:

```ts
export function formatBytes(value: number, fractionDigits = 1) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(fractionDigits)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
```

Generic helper from concrete copies:

```ts
export type LabelGroup<T> = {
  label: string;
  items: T[];
};

export function createOrderedGroups<T>(
  items: T[],
  labels: string[],
  getLabel: (item: T) => string,
): LabelGroup<T>[] {
  return labels
    .map((label) => ({
      label,
      items: items.filter((item) => getLabel(item) === label),
    }))
    .filter((group) => group.items.length > 0);
}
```

Use this when repeated helpers differ only by the item type. Keep the helper generic and let each domain decide whether to adapt `items` into a local field name.

Repeated external command output:

```ts
type CommandOutputOptions = {
  maxBuffer?: number;
};

function commandOutput(command: string, args: string[], options: CommandOutputOptions = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return result.status === 0 ? result.stdout : null;
}
```

Use an options bag when one caller needs optional config and the common callers should stay quiet.

Comparator over shared fields:

```ts
type RowOrderSource = Pick<Row, 'name' | 'updatedAt'>;

function compareRowOrder(left: RowOrderSource, right: RowOrderSource) {
  return compareUpdatedAt(left.updatedAt, right.updatedAt) || left.name.localeCompare(right.name);
}
```

Use `Pick<>` on helper parameters when two domain types share only the fields the helper needs.

Repeated storage mutation:

```ts
function moveEntry(key: string, fromPath: string, toPath: string) {
  const from = loadFile(fromPath);
  const value = from[key];
  if (!value) return;

  delete from[key];
  saveFile(fromPath, from);

  const to = loadFile(toPath);
  to[key] = value;
  saveFile(toPath, to);
}
```

## Edge Cases

Do not extract functions from different domains only because their bodies match. A markdown formatter, CLI formatter, and telemetry formatter can have different contracts.

Do not merge behavior with different failure semantics. Returning `null`, returning `[]`, throwing, logging, and showing UI messages are different boundaries.

Do not hide meaningful thresholds. If two size helpers use different cutoffs or precision, extract only when the threshold or precision becomes an explicit parameter.

Do not export a helper only to satisfy one unrelated caller. Prefer local duplication over a fake public API.

Do not keep thin local wrappers after extraction unless the wrapper name adds domain meaning.

When a generic helper uses generic names such as `items`, a small call-site mapper is acceptable if the local domain name is clearer, such as `contexts` or `sessions`.

Put standalone helpers with clear names in dedicated files. Add helpers to an existing module when they belong to the same family, such as unknown-value guards, parsers, or formatters.

Temporary wrappers can be useful during large migrations, but remove them before finishing the cleanup unless they preserve a public API.

Do not prioritize test duplication before production duplication unless test setup drift is already causing maintenance cost.
