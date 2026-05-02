import { DynMarkdown } from 'markdown-helper';
import { READMES } from './shared';

type TFields = 'HEADER_LOGO' | 'TOP_DIVIDER';

const LOGO = `<img height="80" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/apps/vscode-extension/resources/icon-colored.png" alt="branch-context logo">`;

const TOP_DIVIDER = `<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>`;

export function updateHeader() {
  for (const path of Object.values(READMES)) {
    const md = new DynMarkdown<TFields>(path);
    md.updateField('HEADER_LOGO', LOGO);
    md.updateField('TOP_DIVIDER', TOP_DIVIDER);
    md.saveFile();
  }

  console.log('✓ Updated HEADER_LOGO + TOP_DIVIDER in 3 readmes');
}
