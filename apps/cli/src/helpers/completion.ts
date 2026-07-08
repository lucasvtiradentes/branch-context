import type { CommandCompletionDefinition } from 'unicommand';

export const completeTemplatesCommand = (): CommandCompletionDefinition => ({
  zsh: (binName) => ({
    functions: `  _${binName}_templates() {
    local git_root templates_dir
    git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    if [[ -n "$git_root" ]]; then
      templates_dir="$(${binName} status 2>/dev/null | sed -n 's/^Templates:   //p' | head -n 1)"
      if [[ -d "$templates_dir" ]]; then
        _values 'template' $(ls "$templates_dir" 2>/dev/null)
      fi
    fi
  }`,
    complete: `          _${binName}_templates`,
  }),
  bash: (binName) => `          git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
          if [[ -n "$git_root" ]]; then
            templates_dir="$(${binName} status 2>/dev/null | sed -n 's/^Templates:   //p' | head -n 1)"
            if [[ -d "$templates_dir" ]]; then
              COMPREPLY=($(compgen -W "$(ls "$templates_dir" 2>/dev/null)" -- "$cur"))
            fi
          fi`,
  fish: (binName) => ({
    functions: `function __${binName}_templates
  set -l git_root (git rev-parse --show-toplevel 2>/dev/null)
  if test -n "$git_root"
    set -l templates_dir (${binName} status 2>/dev/null | sed -n 's/^Templates:   //p' | head -n 1)
    if test -d "$templates_dir"
      ls "$templates_dir" 2>/dev/null
    end
  end
end`,
    complete: `complete -c ${binName} -f -n "__${binName}_using_command 'template'" -a "(__${binName}_templates)"`,
  }),
});
