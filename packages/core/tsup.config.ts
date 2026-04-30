import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/constants.ts',
    'src/services/index.ts',
    'src/services/status.ts',
    'src/services/actions.ts',
  ],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
});
