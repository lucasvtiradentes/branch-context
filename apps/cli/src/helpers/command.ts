import type { Program } from '@caporal/core';
import type { CommandDefinition } from 'unicommand';
import { commandDefinitionToZodInputSchema, z } from 'unicommand';

type CliCommandDefinition = Omit<CommandDefinition, 'config' | 'inputSchema' | 'outputSchema'> & {
  config?: Parameters<Program['command']>[2];
  inputSchema?: CommandDefinition['inputSchema'];
  outputSchema?: CommandDefinition['outputSchema'];
};

export const defineCliCommand = (definition: CliCommandDefinition): CommandDefinition => {
  const command = {
    outputSchema: z.unknown(),
    ...definition,
  } as CommandDefinition;

  return {
    ...command,
    inputSchema: definition.inputSchema ?? commandDefinitionToZodInputSchema(command),
  };
};
