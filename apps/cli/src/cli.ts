#!/usr/bin/env node
import { type CommandModule, createPackageCommandCliRunner } from 'unicommand';

const cli = createPackageCommandCliRunner({
  importCommandModule: (file) => import(file) as Promise<CommandModule>,
  importMetaUrl: import.meta.url,
});

export const runCli = cli.runCli;

if (cli.isDirectRun()) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
