import { join } from 'node:path';
import { DynMarkdown, getJson } from 'markdown-helper';
import { READMES, ROOT_DIR } from './shared';

type TFields = 'CONFIG_JSON';

export function updateConfig() {
  const config = getJson(join(ROOT_DIR, 'packages/core/resources/config.json')) as {
    template_rules?: unknown[];
  };
  if (Array.isArray(config.template_rules)) {
    config.template_rules = config.template_rules.slice(0, 2);
  }
  const content = ['```json', JSON.stringify(config, null, 2), '```'].join('\n');

  for (const path of Object.values(READMES)) {
    const md = new DynMarkdown<TFields>(path);
    md.updateField('CONFIG_JSON', content);
    md.saveFile();
  }

  console.log('✓ Updated CONFIG_JSON in 3 readmes');
}
