import { basename } from 'node:path';
import { getPublicCommands } from '../cmd-registry';

export function safeFuncName(prog: string) {
  return prog.replace(/[^a-zA-Z0-9]/g, '_');
}

export function getZshCompletion(prog: string) {
  const commands = getPublicCommands();
  const cmdLines = Object.entries(commands)
    .map(([name, info]) => `'${name}:${info.desc}'`)
    .join('\n        ');
  const subcommandLines = Object.entries(commands)
    .filter(([, info]) => info.subcommands)
    .map(([name, info]) => {
      const values = Object.entries(info.subcommands ?? {})
        .map(([subcommand, desc]) => `'${subcommand}:${desc}'`)
        .join(' ');
      return `        ${name}) _values '${name} command' ${values} ;;`;
    })
    .join('\n');
  const func = safeFuncName(prog);

  return `#compdef ${prog}

_${func}() {
    local -a commands
    local git_root templates_dir

    commands=(
        ${cmdLines}
    )

    _get_templates() {
        git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
        if [[ -n "$git_root" ]]; then
            templates_dir="$git_root/.bctx/templates"
            if [[ -d "$templates_dir" ]]; then
                _values 'template' $(ls "$templates_dir" 2>/dev/null)
            fi
        fi
    }

    case "$words[2]" in
        template)
            if (( CURRENT == 3 )); then
                _get_templates
            fi
            ;;
        completion)
            if (( CURRENT == 3 )); then
                _values 'shell' 'zsh' 'bash' 'fish'
            fi
            ;;
${subcommandLines}
        *)
            if (( CURRENT == 2 )); then
                _describe -t commands 'command' commands
            fi
            ;;
    esac
}

compdef _${func} ${prog}
`;
}

export function getBashCompletion(prog: string) {
  const commands = getPublicCommands();
  const cmdNames = Object.keys(commands).join(' ');
  const subcommandCases = Object.entries(commands)
    .filter(([, info]) => info.subcommands)
    .map(
      ([name, info]) =>
        `        ${name})\n            COMPREPLY=( $(compgen -W "${Object.keys(info.subcommands ?? {}).join(' ')}" -- "$cur") )\n            return 0\n            ;;`,
    )
    .join('\n');
  const func = safeFuncName(prog);

  return `_${func}() {
    local cur prev commands git_root templates_dir
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="${cmdNames}"

    case "$prev" in
        template)
            git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
            if [[ -n "$git_root" ]]; then
                templates_dir="$git_root/.bctx/templates"
                if [[ -d "$templates_dir" ]]; then
                    COMPREPLY=( $(compgen -W "$(ls "$templates_dir" 2>/dev/null)" -- "$cur") )
                fi
            fi
            return 0
            ;;
        completion)
            COMPREPLY=( $(compgen -W "zsh bash fish" -- "$cur") )
            return 0
            ;;
${subcommandCases}
        ${prog})
            COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            return 0
            ;;
    esac
}

complete -F _${func} ${prog}
`;
}

export function getFishCompletion(prog: string) {
  const commands = getPublicCommands();
  const cmdLines = Object.entries(commands)
    .map(
      ([name, info]) =>
        `complete -c ${prog} -n "__fish_use_subcommand" -a ${name} -d "${info.desc}"`,
    )
    .join('\n');
  const completionLines = `complete -c ${prog} -n "__fish_seen_subcommand_from completion" -a "zsh bash fish"`;
  const templateLines = `complete -c ${prog} -n "__fish_seen_subcommand_from template" -a "(__branchctx_templates)"`;
  const subcommandLines = Object.entries(commands)
    .filter(([, info]) => info.subcommands)
    .flatMap(([name, info]) =>
      Object.entries(info.subcommands ?? {}).map(
        ([subcommand, desc]) =>
          `complete -c ${prog} -n "__fish_seen_subcommand_from ${name}; and not __fish_seen_subcommand_from ${Object.keys(info.subcommands ?? {}).join(' ')}" -a ${subcommand} -d "${desc}"`,
      ),
    )
    .join('\n');

  return `complete -c ${prog} -f

${cmdLines}

${completionLines}

${subcommandLines}

function __branchctx_templates
    set -l git_root (git rev-parse --show-toplevel 2>/dev/null)
    if test -n "$git_root"
        set -l templates_dir "$git_root/.bctx/templates"
        if test -d "$templates_dir"
            ls "$templates_dir" 2>/dev/null
        end
    end
end

${templateLines}
`;
}

export function cmdCompletion(
  args: string[],
  prog = process.env.BCTX_PROG_NAME ?? basename(process.argv[1] ?? 'bctx'),
) {
  if (args.length === 0) {
    console.log(`usage: ${prog} completion <shell>`);
    console.log('shells: zsh, bash, fish');
    console.log();
    console.log('Add to your shell config:');
    console.log(`  zsh:  eval "$(${prog} completion zsh)"`);
    console.log(`  bash: eval "$(${prog} completion bash)"`);
    console.log(`  fish: ${prog} completion fish | source`);
    return 1;
  }

  const shell = (args[0] ?? '').toLowerCase();
  const generators = {
    zsh: getZshCompletion,
    bash: getBashCompletion,
    fish: getFishCompletion,
  };

  if (!(shell in generators)) {
    console.log(`error: unknown shell '${shell}'`);
    console.log('supported: zsh, bash, fish');
    return 1;
  }

  console.log(generators[shell as keyof typeof generators](prog));
  return 0;
}
