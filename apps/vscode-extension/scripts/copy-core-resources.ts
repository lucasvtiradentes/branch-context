import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyResources } from '@branch-context/core';

const scriptDir = dirname(fileURLToPath(import.meta.url));

copyResources(join(scriptDir, '..', 'dist', 'resources', 'bctx'));
