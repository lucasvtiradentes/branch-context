import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  external: ['vscode', 'readline/promises'],
  noExternal: [/^@branch-context\/core/],
  clean: true,
  sourcemap: true,
});
