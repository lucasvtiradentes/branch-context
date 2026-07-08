#!/usr/bin/env node
import { VERSION } from '@branch-context/core';
import { createPackageCommandCliRunner } from 'unicommand';

const cli = createPackageCommandCliRunner({
  description: 'Git branch context manager',
  importMetaUrl: import.meta.url,
  version: VERSION,
});

export const runCli = cli.runCli;

if (cli.isDirectRun()) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
