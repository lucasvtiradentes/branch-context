import { stdin as input } from 'node:process';
import readline from 'node:readline/promises';
import { CLI_NAME } from '../constants';
import { getCurrentBranch, getGitRoot } from '../core/hooks';
import { applyTemplateToCurrentBranch, listAvailableTemplates } from '../services/actions';

async function selectTemplate(templates: string[]) {
  console.log('Templates:\n');
  templates.forEach((template, index) => {
    console.log(`  ${index + 1}. ${template}`);
  });
  console.log();

  const rl = readline.createInterface({ input, output: process.stdout });
  try {
    const choice = (await rl.question(`Select [1-${templates.length}, c=cancel]: `)).trim();
    if (!choice || choice.toLowerCase() === 'c' || choice.toLowerCase() === 'cancel') {
      return null;
    }
    const index = Number.parseInt(choice, 10) - 1;
    if (index >= 0 && index < templates.length) {
      return templates[index];
    }
    console.log('error: invalid selection');
    return null;
  } catch {
    console.log();
    return null;
  } finally {
    rl.close();
  }
}

export async function cmdTemplate(args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  const templatesResult = listAvailableTemplates(gitRoot);
  if (!templatesResult.ok) {
    console.log(`error: ${CLI_NAME} not initialized (run '${CLI_NAME} init')`);
    return 1;
  }

  if (!getCurrentBranch(gitRoot)) {
    console.log('error: could not determine current branch');
    return 1;
  }

  const templates = templatesResult.templates;
  if (templates.length === 0) {
    console.log('error: no templates found');
    return 1;
  }

  let template = args[0];
  if (!template) {
    if (!input.isTTY) {
      console.log(`usage: ${CLI_NAME} template <name>`);
      console.log(`available: ${templates.join(', ')}`);
      return 1;
    }
    template = (await selectTemplate(templates)) ?? undefined;
    if (!template) {
      console.log('cancelled');
      return 1;
    }
  }

  if (!templates.includes(template)) {
    console.log(`error: template '${template}' not found`);
    console.log(`available: ${templates.join(', ')}`);
    return 1;
  }

  const result = applyTemplateToCurrentBranch(gitRoot, template);
  if (!result.ok) {
    if (result.reason === 'no_current_branch') {
      console.log('error: could not determine current branch');
    } else if (result.reason === 'template_not_found') {
      console.log('error: template not found');
    } else {
      console.log(`error: ${result.message}`);
    }
    return 1;
  }

  console.log(`Applied template '${result.template}' to '${result.branch}'`);
  return 0;
}
