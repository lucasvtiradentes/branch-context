import { z } from 'zod';

export const BranchContextConfigSchema = z
  .object({
    $schema: z.string().optional().describe('JSON Schema reference'),
    default_base_branch: z
      .string()
      .optional()
      .describe('Default branch or ref used to compute commits and changed files'),
    sound: z.boolean().optional().describe('Play a sound when branch context sync runs'),
    sound_file: z.string().optional().describe('Custom sound file path'),
    commit_description: z
      .boolean()
      .optional()
      .describe('Include commit body text in the generated commits section'),
  })
  .describe('Branch Context configuration file');

export type BranchContextConfigFile = z.infer<typeof BranchContextConfigSchema>;

export function createBranchContextConfigJsonSchema() {
  return z.toJSONSchema(BranchContextConfigSchema, { target: 'draft-7' });
}
