import type { CommandCompletionDefinition } from 'unicommand';

export const completeTemplatesCommand = (): CommandCompletionDefinition => ({
  zsh: (binName) => ({
    functions: `  _${binName}_templates() {
    _values 'template' $(${binName} template --list 2>/dev/null)
  }`,
    complete: `          _${binName}_templates`,
  }),
  bash: (binName) =>
    `          COMPREPLY=($(compgen -W "$(${binName} template --list 2>/dev/null)" -- "$cur"))`,
  fish: (binName) => ({
    functions: `function __${binName}_templates
  ${binName} template --list 2>/dev/null
end`,
    complete: `complete -c ${binName} -f -n "__${binName}_using_command 'template'" -a "(__${binName}_templates)"`,
  }),
});
