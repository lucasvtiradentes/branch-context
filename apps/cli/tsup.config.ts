import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/commands/*.ts'],
  format: ['esm'],
  dts: true,
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  external: ['readline/promises'],
  noExternal: [/^@branch-context\/core/, /^zod/],
  clean: true,
  splitting: true,
  sourcemap: true,
});
