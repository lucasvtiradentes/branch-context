import type {
  AgentSession,
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
  BranchContextStatus,
  BranchGitSummary,
} from '@branch-context/core';

export type BranchContextExtensionState = {
  workspaceRoot: string | null;
  initialized: boolean;
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
