import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/constants.ts',
    'src/data/config-schema.ts',
    'src/services/index.ts',
    'src/services/status.ts',
    'src/services/actions.ts',
    'src/services/agents.ts',
    'src/services/git-summary.ts',
    'src/utils/git.ts',
  ],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
});
