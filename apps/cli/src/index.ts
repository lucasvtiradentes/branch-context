#!/usr/bin/env node
import { runCli } from '@branch-context/core';

const exitCode = await runCli();
process.exit(exitCode);
