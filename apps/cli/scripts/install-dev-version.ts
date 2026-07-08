import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDevCommand } from 'unicommand';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');

installDevCommand({
  binDirEnvName: 'BCTX_DEV_BIN_DIR',
  cliPath: resolve(appDir, 'src', 'cli.ts'),
  commandName: 'bctxd',
  packageDir: appDir,
  programNameEnvName: 'BCTX_PROG_NAME',
});
