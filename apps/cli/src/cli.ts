#!/usr/bin/env node
import { CLI_NAME, VERSION } from '@branch-context/core';
import { createCommandCliRunner } from 'unicommand';

const cli = createCommandCliRunner({
  defaultBinName: CLI_NAME,
  description: 'Git branch context manager',
  envBinName: 'BCTX_PROG_NAME',
  importMetaUrl: import.meta.url,
  version: VERSION,
});

export const runCli = cli.runCli;

if (cli.isDirectRun()) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
