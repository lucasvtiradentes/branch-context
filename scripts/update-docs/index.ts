import { updateCommands } from './update-commands';
import { updateConfig } from './update-config';
import { updateFooter } from './update-footer';
import { updateHeader } from './update-header';

type UpdateFn = { name: string; fn: () => void };

const updates: UpdateFn[] = [
  { name: 'header', fn: updateHeader },
  { name: 'commands', fn: updateCommands },
  { name: 'config', fn: updateConfig },
  { name: 'footer', fn: updateFooter },
];

const errors: { name: string; error: string }[] = [];

for (const update of updates) {
  try {
    update.fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ name: update.name, error: message });
    console.error(`\n✗ ERROR in [${update.name}]:\n  ${message}\n`);
  }
}

if (errors.length > 0) {
  console.error(`\nFAILED: ${errors.length} update(s) had errors`);
  process.exit(1);
}

console.log('\n✓ All updates completed\n');
