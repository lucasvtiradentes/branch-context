import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageJson = {
  name?: string;
  publisher?: string;
  displayName?: string;
  description?: string;
  repository?: unknown;
  keywords?: unknown;
};

const APP_ID = 'branch-context';
const DEV_APP_ID = `${APP_ID}-dev`;
const EXTENSION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  const patchedPackageJson = JSON.parse(replaceAppId(JSON.stringify(packageJson))) as PackageJson;
  patchedPackageJson.name = `${packageJson.name ?? APP_ID}-dev`;
  patchedPackageJson.displayName = `${packageJson.displayName ?? 'Branch Context'} [dev]`;
  if (packageJson.description) {
    patchedPackageJson.description = `${packageJson.description} [dev]`;
  }
  patchedPackageJson.repository = packageJson.repository;
  patchedPackageJson.keywords = packageJson.keywords;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(patchedPackageJson, null, 2)}\n`);
  patchFile(DIST_JS_PATH);
  patchFile(DIST_MAP_PATH);
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
    const targetDir = path.join(extensionDir, extensionId);
    fs.rmSync(targetDir, { recursive: true, force: true });
    copyRecursive(DIST_DIR, targetDir);
  }
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

  fs.writeFileSync(filePath, replaceAppId(fs.readFileSync(filePath, 'utf8')));
}

function replaceAppId(content: string) {
  return content.split(APP_ID).join(DEV_APP_ID);
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
