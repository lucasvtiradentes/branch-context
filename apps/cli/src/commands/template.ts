import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { stdin as input } from 'node:process';
import readline from 'node:readline/promises';
import {
  applyTemplateToCurrentBranch,
  BranchContextActionErrorReason,
  CLI_NAME,
  Config,
  configExists,
  getCurrentBranch,
  getTemplatesDir,
  listAvailableTemplates,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

const CANCEL_TEMPLATE_SELECTION_INPUTS = new Set(['c', 'cancel']);
const templateErrorMessages = {
  [BranchContextActionErrorReason.NotInitialized]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.NoCurrentBranch]: () =>
    'error: could not determine current branch',
  [BranchContextActionErrorReason.MissingContext]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.BaseBranchNotFound]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.NoTemplates]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.TemplateNotFound]: () => 'error: template not found',
  [BranchContextActionErrorReason.InvalidPath]: (message: string) => `error: ${message}`,
} as const satisfies Record<BranchContextActionErrorReason, (message: string) => string>;

export function registerTemplateCommand(program: Program) {
  program
    .command('template apply', 'Apply template to current branch')
    .argument('[name]', 'Template name')
    .action(({ args }) => cmdTemplate(stringArgs(args.name)));

  program
    .command('template source', 'Show or set the templates folder')
    .argument('[path]', 'Templates folder path')
    .action(({ args }) => cmdTemplateSource(stringArg(args.path)));
}

async function selectTemplate(templates: string[]) {
  console.log('Templates:\n');
  templates.forEach((template, index) => {
    console.log(`  ${index + 1}. ${template}`);
  });
  console.log();

  const rl = readline.createInterface({ input, output: process.stdout });
  try {
    const choice = (await rl.question(`Select [1-${templates.length}, c=cancel]: `)).trim();
    if (!choice || CANCEL_TEMPLATE_SELECTION_INPUTS.has(choice.toLowerCase())) {
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

function stringArgs(value: unknown) {
  return value == null || value === '' ? [] : [String(value)];
}

function stringArg(value: unknown) {
  return value == null || value === '' ? null : String(value);
}

function normalizeFolderArg(path: string) {
  return path.trim();
}

function resolveFolderArg(gitRoot: string, path: string) {
  return isAbsolute(path) ? path : resolve(gitRoot, path);
}

async function cmdTemplateSource(path: string | null) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  if (!configExists(gitRoot)) {
    console.log(`error: ${CLI_NAME} not initialized (run '${CLI_NAME} init')`);
    return 1;
  }

  if (!path) {
    const config = Config.load(gitRoot);
    console.log(`Templates folder: ${config.templatesFolder}`);
    console.log(`Resolved: ${getTemplatesDir(gitRoot)}`);
    return 0;
  }

  const templatesFolder = normalizeFolderArg(path);
  const resolvedTemplatesFolder = resolveFolderArg(gitRoot, templatesFolder);
  if (!existsSync(resolvedTemplatesFolder)) {
    console.log(`error: templates folder does not exist: ${resolvedTemplatesFolder}`);
    return 1;
  }

  const config = Config.load(gitRoot);
  config.templatesFolder = templatesFolder;
  config.save(gitRoot);
  console.log(`Templates folder: ${templatesFolder}`);
  console.log(`Resolved: ${getTemplatesDir(gitRoot)}`);
  return 0;
}

async function cmdTemplate(args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
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
      console.log(`usage: ${CLI_NAME} template apply <name>`);
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
    console.log(templateErrorMessages[result.reason](result.message));
    return 1;
  }

  console.log(`Applied template '${result.template}' to '${result.branch}'`);
  return 0;
}
