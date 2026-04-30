import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/constants.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
});
