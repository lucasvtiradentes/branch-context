import type {
  AgentSession,
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
  BranchContextStatus,
  BranchGitSummary,
} from '@branch-context/core';
import type { CliCompatibilityState } from '../cli/compatibility';

export type BranchContextExtensionState = {
  workspaceRoot: string | null;
  initialized: boolean;
  cliCompatibility: CliCompatibilityState;
  status: BranchContextStatus | null;
  currentBranch: string | null;
  currentContextDir: string | null;
  currentContextFile: string | null;
  recentContexts: BranchContextContextSummary[];
  archivedContexts: BranchContextArchivedContextSummary[];
  agentSessions: AgentSession[];
  gitSummary: BranchGitSummary | null;
  templates: string[];
  configPath: string | null;
};
