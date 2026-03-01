from __future__ import annotations

from branchctx.cmd_registry import get_public_commands
from branchctx.constants import CLI_ALIASES, CLI_NAME


def _get_zsh_completion() -> str:
    commands = get_public_commands()
    cmd_lines = "\n        ".join(f"'{name}:{info['desc']}'" for name, info in commands.items())
    aliases_str = " ".join(CLI_ALIASES)

    return f"""#compdef {CLI_NAME}

_{CLI_NAME}() {{
    local -a commands
    local git_root templates_dir

    commands=(
        {cmd_lines}
    )

    _get_templates() {{
        git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
        if [[ -n "$git_root" ]]; then
            templates_dir="$git_root/.bctx/templates"
            if [[ -d "$templates_dir" ]]; then
                _values 'template' $(ls "$templates_dir" 2>/dev/null)
            fi
        fi
    }}

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
        branches)
            if (( CURRENT == 3 )); then
                _values 'subcommand' 'list' 'prune'
            fi
            ;;
        *)
            if (( CURRENT == 2 )); then
                _describe -t commands 'command' commands
            fi
            ;;
    esac
}}

compdef _{CLI_NAME} {aliases_str}
"""


def _get_bash_completion() -> str:
    commands = get_public_commands()
    cmd_names = " ".join(commands.keys())
    complete_lines = "\n".join(f"complete -F _{CLI_NAME} {alias}" for alias in CLI_ALIASES)
    case_aliases = "|".join(CLI_ALIASES)

    return f'''_{CLI_NAME}() {{
    local cur prev commands git_root templates_dir
    COMPREPLY=()
    cur="${{COMP_WORDS[COMP_CWORD]}}"
    prev="${{COMP_WORDS[COMP_CWORD-1]}}"
    commands="{cmd_names}"

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
        branches)
            COMPREPLY=( $(compgen -W "list prune" -- "$cur") )
            return 0
            ;;
        {case_aliases})
            COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            return 0
            ;;
    esac
}}

{complete_lines}
'''


def _get_fish_completion() -> str:
    commands = get_public_commands()

    cmd_lines = "\n".join(
        "\n".join(f'complete -c {a} -n "__fish_use_subcommand" -a {name} -d "{info["desc"]}"' for a in CLI_ALIASES)
        for name, info in commands.items()
    )

    init_lines = "\n".join(f"complete -c {a} -f" for a in CLI_ALIASES)
    completion_lines = "\n".join(
        f'complete -c {a} -n "__fish_seen_subcommand_from completion" -a "zsh bash fish"' for a in CLI_ALIASES
    )
    template_lines = "\n".join(
        f'complete -c {a} -n "__fish_seen_subcommand_from template" -a "(__branchctx_templates)"' for a in CLI_ALIASES
    )
    branches_lines = "\n".join(
        f'complete -c {a} -n "__fish_seen_subcommand_from branches" -a "list prune"' for a in CLI_ALIASES
    )

    return f"""{init_lines}

{cmd_lines}

{completion_lines}

{branches_lines}

function __branchctx_templates
    set -l git_root (git rev-parse --show-toplevel 2>/dev/null)
    if test -n "$git_root"
        set -l templates_dir "$git_root/.bctx/templates"
        if test -d "$templates_dir"
            ls "$templates_dir" 2>/dev/null
        end
    end
end

{template_lines}
"""


def cmd_completion(args: list[str]) -> int:
    if not args:
        print(f"usage: {CLI_NAME} completion <shell>")
        print("shells: zsh, bash, fish")
        print()
        print("Add to your shell config:")
        print(f'  zsh:  eval "$({CLI_NAME} completion zsh)"')
        print(f'  bash: eval "$({CLI_NAME} completion bash)"')
        print(f"  fish: {CLI_NAME} completion fish | source")
        return 1

    shell = args[0].lower()

    generators = {
        "zsh": _get_zsh_completion,
        "bash": _get_bash_completion,
        "fish": _get_fish_completion,
    }

    if shell not in generators:
        print(f"error: unknown shell '{shell}'")
        print("supported: zsh, bash, fish")
        return 1

    print(generators[shell]())
    return 0
