import { join } from 'node:path';
import { generateReadmeCommandDocs } from 'unicommand';
import { READMES } from './shared';

export async function updateCommands() {
  for (const readmePath of [READMES.main, READMES.cli]) {
    await generateReadmeCommandDocs({
      binName: 'bctx',
      commandsDir: join(process.cwd(), 'apps', 'cli', 'src', 'commands'),
      readmePath,
    });
  }

  console.log('✓ Updated COMMANDS in main + cli readmes');
}
