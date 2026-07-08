import type {
  AgentSession,
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
  BranchContextStatus,
  BranchGitSummary,
} from '@branch-context/core';
import type { CliDetectionState } from '../cli/detection';

export type BranchContextExtensionState = {
  workspaceRoot: string | null;
  initialized: boolean;
  cliDetection: CliDetectionState;
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
