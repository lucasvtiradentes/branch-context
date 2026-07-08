import type { Command, Program } from '@caporal/core';

type CompletionGroup = {
  description?: string;
  name: string;
};

enum CompletionShell {
  Bash = 'bash',
  Fish = 'fish',
  Zsh = 'zsh',
}

const PARENT_DESCRIPTIONS: Record<string, string> = {};
const completionShells = Object.values(CompletionShell);
const completionScriptGenerators = {
  [CompletionShell.Bash]: getBashCompletionScript,
  [CompletionShell.Fish]: getFishCompletionScript,
  [CompletionShell.Zsh]: getZshCompletionScript,
} as const satisfies Record<
  CompletionShell,
  (binName: string, roots: CompletionGroup[], subcommands: Map<string, CompletionGroup[]>) => string
>;

export function registerCompletionCommand(program: Program) {
  program
    .command('completion', 'Generate shell completion scripts')
    .argument('[shell]', 'Shell to generate completion for')
    .strict(false)
    .action(async ({ args, program }) => {
      const shell = args.shell ? String(args.shell) : '';
      if (isCompletionShell(shell)) {
        console.log(await getCompletionScript(program, shell));
        return 0;
      }
      console.log(`error: unsupported shell '${shell || '<empty>'}'`);
      console.log('supported: zsh, bash, fish');
      return 1;
    });
}

function isCompletionShell(value: string): value is CompletionShell {
  return (completionShells as readonly string[]).includes(value);
}

async function getCompletionScript(program: Program, shell: CompletionShell) {
  const binName = program.getBin();
  const commands = (await program.getAllCommands()).filter(
    (command) => command.visible && command.name !== 'completion',
  );
  const roots = getRootCommands(commands);
  const subcommands = getSubcommandGroups(commands);

  return completionScriptGenerators[shell](binName, roots, subcommands);
}

function getZshCompletionScript(
  binName: string,
  roots: CompletionGroup[],
  subcommands: Map<string, CompletionGroup[]>,
) {
  return `#compdef ${binName}

_${binName}() {
  local -a commands
  local git_root templates_dir
  commands=(
${formatZshItems(roots)}
  )
${formatSubcommandArrays(subcommands)}

  _${binName}_templates() {
    git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    if [[ -n "$git_root" ]]; then
      templates_dir="$(${binName} template source 2>/dev/null | sed -n 's/^Templates folder: //p' | tail -n 1)"
      if [[ -d "$templates_dir" ]]; then
        _values 'template' $(ls "$templates_dir" 2>/dev/null)
      fi
    fi
  }

  _arguments -C \\
    '1:command:->command' \\
    '2:subcommand:->subcommand' \\
    '3:template_arg:->template_arg' \\
    '*::arg:->arg'

  case $state in
    command)
      _describe '${binName} commands' commands
      ;;
    subcommand)
      case $words[2] in
${formatSubcommandCases(binName, subcommands)}
      esac
      ;;
    template_arg)
      case "$words[2] $words[3]" in
        'template apply')
          _${binName}_templates
          ;;
      esac
      ;;
  esac
}

compdef _${binName} ${binName}`;
}

function getBashCompletionScript(
  binName: string,
  roots: CompletionGroup[],
  subcommands: Map<string, CompletionGroup[]>,
) {
  return `_${binName}_completion() {
  local cur git_root templates_dir
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=()

  case "$COMP_CWORD" in
    1)
      COMPREPLY=($(compgen -W "${roots.map((item) => item.name).join(' ')}" -- "$cur"))
      ;;
    2)
      case "\${COMP_WORDS[1]}" in
${formatBashSubcommandCases(subcommands)}
      esac
      ;;
    3)
      if [[ "\${COMP_WORDS[1]}" == "template" && "\${COMP_WORDS[2]}" == "apply" ]]; then
        git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
        if [[ -n "$git_root" ]]; then
          templates_dir="$(${binName} template source 2>/dev/null | sed -n 's/^Templates folder: //p' | tail -n 1)"
          if [[ -d "$templates_dir" ]]; then
            COMPREPLY=($(compgen -W "$(ls "$templates_dir" 2>/dev/null)" -- "$cur"))
          fi
        fi
      fi
      ;;
  esac
}

complete -F _${binName}_completion ${binName}`;
}

function getFishCompletionScript(
  binName: string,
  roots: CompletionGroup[],
  subcommands: Map<string, CompletionGroup[]>,
) {
  const rootNames = roots.map((item) => item.name).join(' ');
  return `function __${binName}_seen_command
  set -l tokens (commandline -opc)
  for token in $tokens[2..-1]
    switch $token
      case ${rootNames}
        return 0
    end
  end
  return 1
end

function __${binName}_using_command
  set -l tokens (commandline -opc)
  test (count $tokens) -ge 2; and test "$tokens[2]" = "$argv[1]"
end

function __${binName}_using_subcommand
  set -l tokens (commandline -opc)
  test (count $tokens) -ge 3; and test "$tokens[2]" = "$argv[1]"; and test "$tokens[3]" = "$argv[2]"
end

function __${binName}_templates
  set -l git_root (git rev-parse --show-toplevel 2>/dev/null)
  if test -n "$git_root"
    set -l templates_dir (${binName} template source 2>/dev/null | sed -n 's/^Templates folder: //p' | tail -n 1)
    if test -d "$templates_dir"
      ls "$templates_dir" 2>/dev/null
    end
  end
end

complete -c ${binName} -f
${formatFishRootCompletions(binName, roots)}
${formatFishSubcommandCompletions(binName, subcommands)}
complete -c ${binName} -f -n "__${binName}_using_subcommand 'template' 'apply'" -a "(__${binName}_templates)"`;
}

function getRootCommands(commands: Command[]) {
  const roots = new Map<string, CompletionGroup>();

  for (const command of commands) {
    const parts = command.name.split(' ');
    const root = parts[0];
    if (!root || roots.has(root)) {
      continue;
    }

    roots.set(root, {
      name: root,
      description: parts.length === 1 ? command.description : getParentDescription(root),
    });
  }

  return [...roots.values()];
}

function getParentDescription(root: string) {
  return PARENT_DESCRIPTIONS[root] ?? `${root} commands`;
}

function getSubcommandGroups(commands: Command[]) {
  const groups = new Map<string, CompletionGroup[]>();

  for (const command of commands) {
    const [root, subcommand] = command.name.split(' ');
    if (!root || !subcommand) {
      continue;
    }

    const group = groups.get(root) ?? [];
    if (!group.some((item) => item.name === subcommand)) {
      group.push({ name: subcommand, description: command.description });
    }
    groups.set(root, group);
  }

  return groups;
}

function formatZshItems(items: CompletionGroup[]) {
  return items.map((item) => `    '${escapeZshItem(item)}'`).join('\n');
}

function formatSubcommandArrays(groups: Map<string, CompletionGroup[]>) {
  return [...groups.entries()]
    .map(
      ([root, items]) => `
  local -a ${root}_commands
  ${root}_commands=(
${formatZshItems(items)}
  )`,
    )
    .join('\n');
}

function formatSubcommandCases(binName: string, groups: Map<string, CompletionGroup[]>) {
  return [...groups.keys()]
    .map(
      (root) => `        ${root})
          _describe '${binName} ${root} commands' ${root}_commands
          ;;`,
    )
    .join('\n');
}

function formatBashSubcommandCases(groups: Map<string, CompletionGroup[]>) {
  return [...groups.entries()]
    .map(
      ([root, items]) => `        ${root})
          COMPREPLY=($(compgen -W "${items.map((item) => item.name).join(' ')}" -- "$cur"))
          ;;`,
    )
    .join('\n');
}

function formatFishRootCompletions(binName: string, roots: CompletionGroup[]) {
  return roots
    .map(
      (item) =>
        `complete -c ${binName} -f -n "not __${binName}_seen_command" -a ${quoteFish(item.name)} -d ${quoteFish(item.description ?? '')}`,
    )
    .join('\n');
}

function formatFishSubcommandCompletions(binName: string, groups: Map<string, CompletionGroup[]>) {
  return [...groups.entries()]
    .flatMap(([root, items]) =>
      items.map(
        (item) =>
          `complete -c ${binName} -f -n "__${binName}_using_command ${quoteFish(root)}" -a ${quoteFish(item.name)} -d ${quoteFish(item.description ?? '')}`,
      ),
    )
    .join('\n');
}

function escapeZshItem(item: CompletionGroup) {
  const text = item.description ? `${item.name}:${item.description}` : item.name;
  return text.replace(/'/g, "'\\''");
}

function quoteFish(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
