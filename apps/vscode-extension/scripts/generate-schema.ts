import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyResources } from '@branch-context/core';
import { createBranchContextConfigJsonSchema } from '@branch-context/core/config-schema';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(scriptDir, '..', 'resources');
const schemaPath = join(scriptDir, '..', 'resources', 'schema.json');
const jsonSchema = createBranchContextConfigJsonSchema();

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
copyResources(join(resourcesDir, 'bctx'));
