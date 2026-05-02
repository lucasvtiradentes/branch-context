import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  external: ['readline/promises'],
  noExternal: [/^@branch-context\/core/, /^zod/],
  clean: true,
  sourcemap: true,
});
