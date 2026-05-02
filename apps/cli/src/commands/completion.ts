import type { Command, Program } from '@caporal/core';

type CompletionItem = {
  current: string;
  description?: string;
  name: string;
};

const GLOBAL_OPTIONS = [
  '--help',
  '--version',
  '--no-color',
  '--quiet',
  '--silent',
  '--install-completion',
  '--uninstall-completion',
];

export function registerCompletionCommand(program: Program) {
  program
    .command('completion', 'Shell completion plumbing', { visible: false })
    .strict(false)
    .action(async ({ program }) => {
      const items = await getCompletionItems(program);
      for (const item of items.filter((item) => item.name.startsWith(item.current))) {
        console.log(item.description ? `${item.name}:${item.description}` : item.name);
      }
      return 0;
    });
}

async function getCompletionItems(program: Program): Promise<CompletionItem[]> {
  const state = getCompletionState(program.getBin());
  if (state.current.startsWith('-')) {
    return GLOBAL_OPTIONS.map((name) => ({ current: state.current, name }));
  }

  const commands = (await program.getAllCommands()).filter((command) => command.visible);
  const items =
    state.previous.length === 0
      ? getRootItems(commands)
      : getSubcommandItems(commands, state.previous);

  return items.map((item) => ({ ...item, current: state.current }));
}

function getRootItems(commands: Command[]) {
  const seen = new Set<string>();
  const items: Array<{ name: string; description?: string }> = [];

  for (const command of commands) {
    const [name] = command.name.split(' ');
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    items.push({ name, description: command.name === name ? command.description : undefined });
  }

  return items;
}

function getSubcommandItems(commands: Command[], previous: string[]) {
  const prefix = previous.join(' ');
  const prefixWithSpace = `${prefix} `;
  return commands
    .filter((command) => command.name.startsWith(prefixWithSpace))
    .map((command) => ({
      name: command.name.slice(prefixWithSpace.length).split(' ')[0] ?? '',
      description: command.description,
    }))
    .filter(
      (item, index, items) =>
        item.name && items.findIndex((next) => next.name === item.name) === index,
    );
}

function getCompletionState(binName: string) {
  const line = process.env.COMP_LINE ?? '';
  const point = Number(process.env.COMP_POINT ?? line.length);
  const partial = line.slice(0, Number.isNaN(point) ? line.length : point);
  const words = partial.trim().length > 0 ? partial.trim().split(/\s+/) : [];

  if (words[0] === binName) {
    words.shift();
  }

  if (/\s$/.test(partial)) {
    return { current: '', previous: words };
  }

  const current = words.pop() ?? '';
  return { current, previous: words };
}
