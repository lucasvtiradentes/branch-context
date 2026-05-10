import { DynMarkdown } from 'markdown-helper';
import { CONFIG_DIR } from '../../packages/core/src/constants';
import { READMES } from './shared';

type TFields = 'COMMANDS';

const COMMANDS: Array<[string, string]> = [
  ['bctx init', `set up ${CONFIG_DIR}/ and Git hooks`],
  ['bctx sync', 'refresh commit/file summaries'],
  ['bctx status', 'check setup health and list branch contexts'],
  ['bctx base', 'get/set base branch'],
  ['bctx template [name]', 'apply a template (e.g. fix, feature)'],
  ['bctx prune', 'archive contexts of deleted branches'],
  ['bctx agents status', 'show indexed AI session pointers for the branch'],
  ['bctx uninstall', `remove ${CONFIG_DIR}/ and hooks`],
];

export function updateCommands() {
  const pad = Math.max(...COMMANDS.map(([cmd]) => cmd.length));
  const lines = COMMANDS.map(([cmd, desc]) => `${cmd.padEnd(pad)}  # ${desc}`);
  const content = ['```sh', ...lines, '```'].join('\n');

  for (const path of [READMES.main, READMES.cli]) {
    const md = new DynMarkdown<TFields>(path);
    md.updateField('COMMANDS', content);
    md.saveFile();
  }

  console.log('✓ Updated COMMANDS in main + cli readmes');
}
