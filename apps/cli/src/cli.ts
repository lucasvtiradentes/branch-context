import { CLI_NAME, DIST_NAME, VERSION } from '@branch-context/core/constants';
import { COMMANDS, getAllCommandNames, getCommandHandler } from './cmd-registry';

export function printHelp() {
  const cmdLines = Object.entries(COMMANDS).map(([name, info]) => {
    const args = info.args ? ` ${info.args}` : '';
    const label = `${name}${args}`;
    return `  ${label.padEnd(20)} ${info.desc}`;
  });

  console.log(`${CLI_NAME} - Git branch context manager

Commands:
${cmdLines.join('\n')}

Options:
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  ${CLI_NAME} init                             # initialize + install hook
  ${CLI_NAME} status                           # show status, health, and branches
  ${CLI_NAME} agents status                    # show agent integration status
  ${CLI_NAME} prune                            # archive orphan contexts + delete branches
  ${CLI_NAME} template                         # select template interactively
  ${CLI_NAME} template feature                 # apply feature template
  ${CLI_NAME} completion zsh                   # generate zsh completion

Exit codes:
  0 - success
  1 - error`);
}

export async function runCli(args = process.argv.slice(2)) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    return 0;
  }

  const cmd = args[0];
  const cmdArgs = args.slice(1);
  if (!cmd) {
    printHelp();
    return 0;
  }
  if (getAllCommandNames().has(cmd)) {
    return await getCommandHandler(cmd)(cmdArgs);
  }

  console.log(`error: unknown command '${cmd}'`);
  console.log(`Run '${CLI_NAME} --help' for usage`);
  return 1;
}

export { DIST_NAME };
