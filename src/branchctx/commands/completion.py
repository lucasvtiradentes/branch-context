from __future__ import annotations

from branchctx.constants import CLI_NAME
from branchctx.registry import get_public_commands


def _get_zsh_completion() -> str:
    commands = get_public_commands()
    cmd_lines = "\n        ".join(f"'{name}:{info['desc']}'" for name, info in commands.items())

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
            templates_dir="$git_root/.branchctx/templates"
            if [[ -d "$templates_dir" ]]; then
                _values 'template' $(ls "$templates_dir" 2>/dev/null)
            fi
        fi
    }}

    case "$words[2]" in
        reset)
            if (( CURRENT == 3 )); then
                _get_templates
            fi
            ;;
        completion)
            if (( CURRENT == 3 )); then
                _values 'shell' 'zsh' 'bash' 'fish'
            fi
            ;;
        *)
            if (( CURRENT == 2 )); then
                _describe -t commands 'command' commands
            fi
            ;;
    esac
}}

_{CLI_NAME}
"""


def _get_bash_completion() -> str:
    commands = get_public_commands()
    cmd_names = " ".join(commands.keys())

    return f'''_{CLI_NAME}() {{
    local cur prev commands git_root templates_dir
    COMPREPLY=()
    cur="${{COMP_WORDS[COMP_CWORD]}}"
    prev="${{COMP_WORDS[COMP_CWORD-1]}}"
    commands="{cmd_names}"

    case "$prev" in
        reset)
            git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
            if [[ -n "$git_root" ]]; then
                templates_dir="$git_root/.branchctx/templates"
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
        {CLI_NAME})
            COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            return 0
            ;;
    esac
}}

complete -F _{CLI_NAME} {CLI_NAME}
'''


def _get_fish_completion() -> str:
    commands = get_public_commands()
    cmd_lines = "\n".join(
        f'complete -c {CLI_NAME} -n "__fish_use_subcommand" -a {name} -d "{info["desc"]}"'
        for name, info in commands.items()
    )

    return f"""complete -c {CLI_NAME} -f

{cmd_lines}

complete -c {CLI_NAME} -n "__fish_seen_subcommand_from completion" -a "zsh bash fish"

function __branchctx_templates
    set -l git_root (git rev-parse --show-toplevel 2>/dev/null)
    if test -n "$git_root"
        set -l templates_dir "$git_root/.branchctx/templates"
        if test -d "$templates_dir"
            ls "$templates_dir" 2>/dev/null
        end
    end
end

complete -c {CLI_NAME} -n "__fish_seen_subcommand_from reset" -a "(__branchctx_templates)"
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
