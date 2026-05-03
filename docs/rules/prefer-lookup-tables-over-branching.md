---
title: Prefer Lookup Tables Over Branching
description: Replace repeated value-to-value branching with typed lookup tables when each case maps to static data.
---

# Prefer Lookup Tables Over Branching

## Motivation

Branching is useful for control flow. It is noisy for static mappings.

When each enum member or stable value maps to one label, icon, command, color, formatter, or handler, a lookup table keeps the mapping visible and makes missing cases easier to catch.

Prefer lookup tables when the branch only selects data or a small pure function. Keep branching when cases perform different control flow, mutate state, return early, throw, or depend on multiple runtime conditions.

## Commands

Identify source folders first. Keep only folders that exist in the current repo:

```sh
CODE_PATHS=()
for dir in src tests app apps package packages lib libs; do
  [ -d "$dir" ] && CODE_PATHS+=("$dir")
done
```

Find branch chains that may return static values:

```sh
rg -n "if \([^)]*(===|!==)[^)]*\)|else if \([^)]*(===|!==)[^)]*\)|switch \(|case .*:" "${CODE_PATHS[@]}" -g '*.ts'
```

Find mapping-like functions by name:

```sh
rg -n "function (get|format|create|render)[A-Z][A-Za-z0-9_]+\(" "${CODE_PATHS[@]}" -g '*.ts'
```

Find static return branches:

```sh
rg -n "return ['\"`]|return new |return [A-Za-z0-9_]+\\[" "${CODE_PATHS[@]}" -g '*.ts'
```

Find existing lookup tables that may need stronger typing:

```sh
rg -n "as const|Record<|Partial<Record<|satisfies Record" "${CODE_PATHS[@]}" -g '*.ts'
```

Identify available verification commands:

```sh
node -e "const p=require('./package.json'); for (const name of ['typecheck','test','build','lint','check']) if (p.scripts?.[name]) console.log(name)"
```

## Process

Convert one mapping family at a time.

1. Confirm the branch maps one input value to static output.
2. Identify the input domain, preferably an enum or string literal union.
3. Create a table near the function that consumes it.
4. Use `as const satisfies Record<Domain, Value>` for exhaustive closed domains.
5. Use `Partial<Record<Domain, Value>>` when unsupported values are valid and should fall back.
6. Keep computed values in small functions inside the table when one case needs parameters.
7. Add a boundary guard when the input comes from external data before indexing a closed table.
8. Replace the branch with a direct table lookup and an explicit fallback if needed.
9. Wrap lookup plus null handling in one helper when the table can intentionally skip output.
10. Run typecheck after each conversion.
11. Leave branches alone when cases perform different effects or control flow.

For small repositories, no change is often the right outcome. Convert only static value-to-value mappings where a table makes the domain clearer or more exhaustive. Keep straightforward branching when the table would be farther away from its only use.

If no applicable mapping exists, do not commit by default. Create an empty validation commit only when the surrounding workflow explicitly requires a marker commit for every rule.

## Patterns

Enum to label:

```ts
const statusLabels = {
  [Status.Ready]: 'Ready',
  [Status.Failed]: 'Failed',
  [Status.Pending]: 'Pending',
} as const satisfies Record<Status, string>;

function getStatusLabel(status: Status) {
  return statusLabels[status];
}
```

Enum to view model:

```ts
const statusView = {
  [Status.Ready]: { label: 'Ready', icon: 'check', color: 'green' },
  [Status.Failed]: { label: 'Failed', icon: 'x', color: 'red' },
  [Status.Pending]: { label: 'Pending', icon: 'clock', color: 'yellow' },
} as const satisfies Record<Status, { label: string; icon: string; color: string }>;

function getStatusView(status: Status) {
  return statusView[status];
}
```

Use one combined view model when attributes are usually read together or edited together. Keep separate tables when consumers read different attributes independently:

```ts
const statusIcons = {
  [Status.Ready]: 'check',
  [Status.Failed]: 'x',
  [Status.Pending]: 'clock',
} as const satisfies Record<Status, string>;

const statusLabels = {
  [Status.Ready]: 'Ready',
  [Status.Failed]: 'Failed',
  [Status.Pending]: 'Pending',
} as const satisfies Record<Status, string>;
```

Enum to handler:

```ts
const renderers = {
  [ViewMode.List]: renderList,
  [ViewMode.Grid]: renderGrid,
  [ViewMode.Table]: renderTable,
} as const satisfies Record<ViewMode, () => string>;

function renderView(mode: ViewMode) {
  return renderers[mode]();
}
```

Partial external-domain mapping:

```ts
const platformCommands: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'open',
  linux: 'xdg-open',
  win32: 'start',
};

function getOpenCommand(platform: NodeJS.Platform) {
  return platformCommands[platform] ?? null;
}
```

Use `??` when absence should produce a default value. Use an optional handler check when absence means nothing should happen:

```ts
const optionalHandlers: Partial<Record<NodeJS.Platform, (path: string) => void>> = {
  darwin: openOnMac,
  linux: openOnLinux,
};

function openIfSupported(platform: NodeJS.Platform, path: string) {
  const handler = optionalHandlers[platform];
  if (handler) {
    handler(path);
  }
}
```

Validate before lookup when the input is external:

```ts
const commandModes = Object.values(CommandMode);
const modeHandlers = {
  [CommandMode.Start]: start,
  [CommandMode.Stop]: stop,
} as const satisfies Record<CommandMode, () => void>;

function isCommandMode(value: string): value is CommandMode {
  return (commandModes as readonly string[]).includes(value);
}

function runCommand(mode: string) {
  if (!isCommandMode(mode)) {
    return false;
  }

  modeHandlers[mode]();
  return true;
}
```

Mapping with case-specific parameters:

```ts
const messageFactories = {
  [Result.Created]: (name: string) => `Created ${name}`,
  [Result.Updated]: (name: string) => `Updated ${name}`,
  [Result.Skipped]: () => null,
} as const satisfies Record<Result, (name: string) => string | null>;

function getMessage(result: Result, name: string) {
  return messageFactories[result](name);
}
```

Wrap lookup plus skip handling when factories can return `null`:

```ts
function printResult(result: Result, name: string) {
  const message = messageFactories[result](name);
  if (message) {
    print(message);
  }
}
```

Layer pure data tables and behavior tables when useful:

```ts
const platformCommands = {
  darwin: 'open',
  linux: 'xdg-open',
} as const;

const platformOpeners = {
  darwin: (path: string) => run(platformCommands.darwin, [path]),
  linux: (path: string) => run(platformCommands.linux, [path]),
} as const;
```

## Edge Cases

Do not replace branching that performs side effects, early returns, throws, awaits, or mutates state in each branch.

Do not force a lookup table when the condition depends on multiple variables. A table works best for one input domain.

Use `Record<Domain, Value>` for closed domains where every value must be handled. Use `Partial<Record<Domain, Value>>` for platform, protocol, or external domains where unsupported values are expected.

Keep an explicit fallback when the input comes from external data or is typed as `Enum | string`.

If converting an if-chain into a table removes several comparisons against external input, keep one reusable guard at the boundary instead of reintroducing comparisons near the lookup.

Use a handler table only when every handler shares the same signature. If signatures diverge, keep branching or normalize the inputs first.

If one case depends on local state outside the input domain, keep that stateful branch near the call site. Do not force every condition into the table.

Do not create a lookup table that is farther away from its only use unless the mapping is reused across files.

Tests should cover the fallback path for partial lookup tables and at least one representative table entry for behavior-sensitive mappings.
