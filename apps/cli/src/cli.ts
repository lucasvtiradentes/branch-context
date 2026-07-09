#!/usr/bin/env node
import { createPackageCommandCliRunner } from 'unicommand';

const cli = createPackageCommandCliRunner({
  importMetaUrl: import.meta.url,
});

export const runCli = cli.runCli;

if (cli.isDirectRun()) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
