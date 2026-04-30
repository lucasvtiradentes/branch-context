#!/usr/bin/env node
import { add } from '@branch-context/core';

process.stdout.write(`core sum: ${add(1, 2)}\n`);
