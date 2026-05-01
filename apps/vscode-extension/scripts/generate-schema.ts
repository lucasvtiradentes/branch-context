import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBranchContextConfigJsonSchema } from '@branch-context/core';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(scriptDir, '..', 'resources', 'schema.json');
const jsonSchema = createBranchContextConfigJsonSchema();

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
