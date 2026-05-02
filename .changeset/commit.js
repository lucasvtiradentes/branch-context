const { execSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

function syncCoreVersionConstant() {
  const packageJsonPath = join(process.cwd(), 'packages', 'core', 'package.json');
  const constantsPath = join(process.cwd(), 'packages', 'core', 'src', 'constants.ts');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const content = readFileSync(constantsPath, 'utf8');
  const nextContent = content.replace(
    /export const VERSION = '[^']+';/,
    `export const VERSION = '${packageJson.version}';`,
  );

  if (nextContent !== content) {
    writeFileSync(constantsPath, nextContent, 'utf8');
    execSync('git add packages/core/src/constants.ts', { stdio: 'inherit' });
  }
}

async function getVersionMessage() {
  syncCoreVersionConstant();

  return 'Version Packages';
}

module.exports = {
  getVersionMessage,
};
