import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageJson = {
  name?: string;
  publisher?: string;
  displayName?: string;
  description?: string;
  version?: string;
  repository?: unknown;
  keywords?: unknown;
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{ command?: string; title?: string }>;
    viewsContainers?: Record<string, Array<{ id?: string; title?: string; icon?: string }>>;
    views?: Record<string, Array<{ id?: string; name?: string; icon?: string }>>;
    menus?: Record<string, Array<{ command?: string; when?: string; group?: string }>>;
  };
};

const APP_ID = 'branch-context';
const DEV_APP_ID = `${APP_ID}-dev`;
const REPO_ROOT_PLACEHOLDER = '__BCTX_REPO_ROOT__';
const PACKAGE_SCOPE_PLACEHOLDER = '__BCTX_PACKAGE_SCOPE__';
const EXTENSION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(EXTENSION_DIR, '../..');
const DIST_DIR = path.join(EXTENSION_DIR, 'dist-dev');
const PACKAGE_JSON_PATH = path.join(EXTENSION_DIR, 'package.json');
const DIST_JS_PATH = path.join(DIST_DIR, 'dist', 'extension.js');
const DIST_MAP_PATH = path.join(DIST_DIR, 'dist', 'extension.js.map');

function main() {
  if (process.env.CI) {
    return;
  }

  setupDistDir();
  copyBuildArtifacts();
  patchDevFiles();
  installDevCli();
  installIntoEditors();
}

function setupDistDir() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyBuildArtifacts() {
  copyRecursive(path.join(EXTENSION_DIR, 'dist'), path.join(DIST_DIR, 'dist'));
  copyRecursive(path.join(EXTENSION_DIR, 'resources'), path.join(DIST_DIR, 'resources'));
  copyIfExists(path.join(EXTENSION_DIR, 'README.md'), path.join(DIST_DIR, 'README.md'));
  copyIfExists(path.join(EXTENSION_DIR, 'CHANGELOG.md'), path.join(DIST_DIR, 'CHANGELOG.md'));
  copyIfExists(path.join(EXTENSION_DIR, 'LICENSE'), path.join(DIST_DIR, 'LICENSE'));
  fs.copyFileSync(PACKAGE_JSON_PATH, path.join(DIST_DIR, 'package.json'));
}

function patchDevFiles() {
  const packageJsonPath = path.join(DIST_DIR, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  const patchedPackageJson = JSON.parse(JSON.stringify(packageJson)) as PackageJson;
  patchedPackageJson.name = `${packageJson.name ?? APP_ID}-dev`;
  patchedPackageJson.displayName = `${packageJson.displayName ?? 'Branch Context'} [dev]`;
  if (packageJson.description) {
    patchedPackageJson.description = `${packageJson.description} [dev]`;
  }
  patchedPackageJson.repository = packageJson.repository;
  patchedPackageJson.keywords = packageJson.keywords;
  patchPackageContributions(patchedPackageJson);
  patchActivationEvents(patchedPackageJson);
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(patchedPackageJson, null, 2)}\n`);
  patchFile(DIST_JS_PATH);
  patchFile(DIST_MAP_PATH);
}

function patchPackageContributions(packageJson: PackageJson) {
  if (packageJson.contributes?.commands) {
    packageJson.contributes.commands = packageJson.contributes.commands.map((command) => ({
      ...command,
      command: patchExtensionId(command.command),
      title: command.title ? `${command.title} [dev]` : command.title,
    }));
  }

  if (packageJson.contributes?.viewsContainers) {
    packageJson.contributes.viewsContainers = Object.fromEntries(
      Object.entries(packageJson.contributes.viewsContainers).map(([location, containers]) => [
        location,
        containers.map((container) => ({
          ...container,
          id: patchExtensionId(container.id),
          title: container.title ? `${container.title} [dev]` : container.title,
        })),
      ]),
    );
  }

  if (packageJson.contributes?.views) {
    packageJson.contributes.views = Object.fromEntries(
      Object.entries(packageJson.contributes.views).map(([containerId, views]) => [
        patchExtensionId(containerId),
        views.map((view) => ({
          ...view,
          id: patchExtensionId(view.id),
        })),
      ]),
    );
  }

  if (packageJson.contributes?.menus) {
    packageJson.contributes.menus = Object.fromEntries(
      Object.entries(packageJson.contributes.menus).map(([menuId, items]) => [
        menuId,
        items.map((item) => ({
          ...item,
          command: patchExtensionId(item.command),
          when: patchWhenClause(item.when),
        })),
      ]),
    );
  }
}

function patchActivationEvents(packageJson: PackageJson) {
  if (!packageJson.activationEvents) {
    return;
  }

  packageJson.activationEvents = packageJson.activationEvents.map((event) => {
    if (event.startsWith('onCommand:')) {
      return `onCommand:${patchExtensionId(event.slice('onCommand:'.length))}`;
    }

    if (event.startsWith('onView:')) {
      return `onView:${patchExtensionId(event.slice('onView:'.length))}`;
    }

    return event;
  });
}

function patchExtensionId(value: string | undefined) {
  if (!value) {
    return value;
  }

  if (value === APP_ID) {
    return DEV_APP_ID;
  }

  if (value.startsWith(`${APP_ID}.`)) {
    return `${DEV_APP_ID}${value.slice(APP_ID.length)}`;
  }

  if (value === `workbench.view.extension.${APP_ID}`) {
    return `workbench.view.extension.${DEV_APP_ID}`;
  }

  return value;
}

function patchWhenClause(value: string | undefined) {
  if (!value) {
    return value;
  }

  return value.replaceAll(APP_ID, DEV_APP_ID);
}

function installIntoEditors() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(DIST_DIR, 'package.json'), 'utf8'),
  ) as PackageJson;
  const publisher = packageJson.publisher ?? 'lucasvtiradentes';
  const name = packageJson.name ?? `${APP_ID}-dev`;
  const extensionId = `${publisher}.${name}`;

  for (const extensionDir of getEditorExtensionDirs()) {
    if (!shouldInstall(extensionDir)) {
      continue;
    }

    fs.mkdirSync(extensionDir, { recursive: true });
    removeStaleDevInstalls(extensionDir, publisher);
    const targetDir = path.join(extensionDir, extensionId);
    fs.rmSync(targetDir, { recursive: true, force: true });
    copyRecursive(DIST_DIR, targetDir);
    syncExtensionRegistry(extensionDir, extensionId, targetDir, packageJson.version);
  }
}

function removeStaleDevInstalls(extensionDir: string, publisher: string) {
  for (const staleId of [`${publisher}.${DEV_APP_ID}-vscode-extension-dev`]) {
    fs.rmSync(path.join(extensionDir, staleId), { recursive: true, force: true });
  }
}

function syncExtensionRegistry(
  extensionDir: string,
  extensionId: string,
  targetDir: string,
  version = '0.0.0',
) {
  const staleExtensionIds = [extensionId, `lucasvtiradentes.${DEV_APP_ID}-vscode-extension-dev`];
  removeObsoleteEntries(extensionDir, staleExtensionIds);
  upsertExtensionsJson(extensionDir, extensionId, targetDir, version, staleExtensionIds);
}

function removeObsoleteEntries(extensionDir: string, extensionIds: string[]) {
  const obsoletePath = path.join(extensionDir, '.obsolete');
  const obsolete = readJsonRecord(obsoletePath);

  for (const key of Object.keys(obsolete)) {
    if (extensionIds.some((extensionId) => key.startsWith(`${extensionId}-`))) {
      delete obsolete[key];
    }
  }

  writeJsonFile(obsoletePath, obsolete);
}

function upsertExtensionsJson(
  extensionDir: string,
  extensionId: string,
  targetDir: string,
  version: string,
  staleExtensionIds: string[],
) {
  const extensionsJsonPath = path.join(extensionDir, 'extensions.json');
  const entries = readJsonArray(extensionsJsonPath).filter((entry) => {
    const id = getExtensionEntryId(entry);
    return id ? !staleExtensionIds.includes(id) : true;
  });

  entries.push({
    identifier: {
      id: extensionId,
    },
    version,
    location: {
      $mid: 1,
      path: targetDir,
      scheme: 'file',
    },
    relativeLocation: path.basename(targetDir),
  });

  writeJsonFile(extensionsJsonPath, entries);
}

function getExtensionEntryId(entry: unknown) {
  if (!entry || typeof entry !== 'object' || !('identifier' in entry)) {
    return null;
  }

  const identifier = (entry as { identifier?: unknown }).identifier;
  if (!identifier || typeof identifier !== 'object' || !('id' in identifier)) {
    return null;
  }

  const id = (identifier as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  const parsed = readJson(filePath, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function readJsonArray(filePath: string): unknown[] {
  const parsed = readJson(filePath, []);
  return Array.isArray(parsed) ? parsed : [];
}

function readJson(filePath: string, fallback: unknown): unknown {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

function getEditorExtensionDirs() {
  const home = os.homedir();
  return [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.cursor', 'extensions'),
    path.join(home, '.windsurf', 'extensions'),
    path.join(home, '.vscode-oss', 'extensions'),
    path.join(home, '.vscodium', 'extensions'),
  ];
}

function shouldInstall(extensionDir: string) {
  return fs.existsSync(extensionDir) || fs.existsSync(path.dirname(extensionDir));
}

function patchFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, patchDevContent(fs.readFileSync(filePath, 'utf8')));
}

function patchDevContent(content: string) {
  return content
    .split('@branch-context/')
    .join(PACKAGE_SCOPE_PLACEHOLDER)
    .split('"@branch-context"')
    .join(`"${PACKAGE_SCOPE_PLACEHOLDER}"`)
    .split(APP_ID)
    .join(DEV_APP_ID)
    .split(REPO_ROOT_PLACEHOLDER)
    .join(REPO_ROOT)
    .split(`"${PACKAGE_SCOPE_PLACEHOLDER}"`)
    .join('"@branch-context"')
    .split(PACKAGE_SCOPE_PLACEHOLDER)
    .join('@branch-context/');
}

function installDevCli() {
  const result = spawnSync(
    'pnpm',
    ['--dir', REPO_ROOT, '--filter', 'branch-context', 'bctxd:install'],
    {
      encoding: 'utf8',
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error('failed to install bctxd dev CLI');
  }
}

function copyIfExists(source: string, target: string) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyRecursive(source: string, target: string) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.cpSync(source, target, { recursive: true });
}

main();
