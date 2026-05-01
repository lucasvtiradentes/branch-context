import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_DIR, CONFIG_FILE } from './constants';
import type { BranchContextConfigFile } from './data/config-schema';

const RESOURCE_CONFIG_FILE = 'config.json';
const RESOURCE_HOOKS_DIR = 'hooks';
const RESOURCE_TEMPLATES_DIR = 'templates';
const RESOURCE_HOOK_FILES = {
  'post-checkout': 'post-checkout.sh',
  'post-commit': 'post-commit.sh',
} as const;

export function getResourcesDir() {
  for (const startDir of getStartDirs()) {
    let current = startDir;
    for (let index = 0; index < 10; index += 1) {
      for (const candidate of getResourceCandidates(current)) {
        if (existsSync(join(candidate, RESOURCE_CONFIG_FILE))) {
          return candidate;
        }
      }
      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return join(process.cwd(), 'packages', 'core', 'resources');
}

export function getDefaultConfigResourcePath() {
  return join(getResourcesDir(), RESOURCE_CONFIG_FILE);
}

export function getDefaultTemplatesResourceDir() {
  return join(getResourcesDir(), RESOURCE_TEMPLATES_DIR);
}

export function loadHookTemplateResource(hookType: keyof typeof RESOURCE_HOOK_FILES) {
  return readFileSync(join(getResourcesDir(), RESOURCE_HOOKS_DIR, RESOURCE_HOOK_FILES[hookType]), {
    encoding: 'utf8',
  });
}

export function loadDefaultConfigResource(): BranchContextConfigFile {
  return JSON.parse(
    readFileSync(getDefaultConfigResourcePath(), 'utf8'),
  ) as BranchContextConfigFile;
}

export function copyInitConfigResource(workspace: string) {
  const configDir = join(workspace, CONFIG_DIR);
  mkdirSync(configDir, { recursive: true });
  copyFileSync(getDefaultConfigResourcePath(), join(configDir, CONFIG_FILE));
}

export function copyInitTemplatesResource(dest: string) {
  copyDirectory(getDefaultTemplatesResourceDir(), dest);
}

export function copyResources(dest: string) {
  rmSync(dest, { recursive: true, force: true });
  copyDirectory(getResourcesDir(), dest);
}

function getStartDirs() {
  return Array.from(
    new Set(
      [
        process.env.BCTX_RESOURCES_DIR,
        process.cwd(),
        process.argv[1] ? dirname(process.argv[1]) : null,
        typeof __dirname === 'string' ? __dirname : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function getResourceCandidates(root: string) {
  return [
    root,
    join(root, 'resources'),
    join(root, 'resources', 'bctx'),
    join(root, 'packages', 'core', 'resources'),
    join(root, 'node_modules', '@branch-context', 'core', 'resources'),
  ];
}

function copyDirectory(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}
